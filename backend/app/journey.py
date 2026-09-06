from datetime import date

import pymysql

from .course_builder import Course, Stop, build_course, distance_km
from .personas import Persona


QUEST_TYPE_VISIT = 1
# USER_QUEST.STATUS (0: 미진행, 1: 진행중, 2: 완료)
QUEST_STATUS_DONE = 2


# 코스의 퀘스트 + 장소(선택 언어) + 사용자의 완료 여부(USER_QUEST)
def course_stops_sql() -> str:
    return """
        SELECT q.IDX AS QUEST_IDX, q.QUEST_ORDER, q.TIME_SLOT,
               p.IDX AS PLACE_IDX,
               COALESCE(NULLIF(t.NAME, ''), NULLIF(k.NAME, ''), p.NAME) AS NAME,
               COALESCE(NULLIF(t.ADDRESS, ''), NULLIF(k.ADDRESS, ''), p.ADDRESS) AS ADDRESS,
               p.IMG, p.MENU, p.REST_DATE, p.OPERATING_HOURS, p.PARKING,
               p.CATEGORY_SUB, p.LATITUDE, p.LONGITUDE, mp.MARKER_ICON_TYPE,
               uq.STATUS AS QUEST_STATUS,
               (p.TEXT IS NOT NULL AND p.TEXT <> '') AS HAS_DOCENT
        FROM QUEST q
        JOIN COURSE c ON c.IDX = q.COURSE_IDX
        JOIN PLACE p ON p.IDX = q.PLACE_IDX
        JOIN MAP_PLACE mp ON mp.PLACE_IDX = p.IDX
        LEFT JOIN PLACE_I18N t ON t.PLACE_IDX = p.IDX AND t.LANGUAGE_CODE = %s
        LEFT JOIN PLACE_I18N k ON k.PLACE_IDX = p.IDX AND k.LANGUAGE_CODE = 'ko'
        LEFT JOIN USER_QUEST uq
          ON uq.QUEST_IDX = q.IDX AND uq.USER_CHARACTER_IDX = c.USER_CHARACTER_IDX
        WHERE q.COURSE_IDX = %s
        ORDER BY q.QUEST_ORDER
    """

# 퀘스트가 정말 이 사용자의 코스에 속하는지 확인하면서 사용자 캐릭터를 찾는다.
QUEST_OWNER_SQL = """
    SELECT c.USER_CHARACTER_IDX, q.TITLE
    FROM QUEST q
    JOIN COURSE c ON c.IDX = q.COURSE_IDX
    JOIN USER_CHARACTER uc ON uc.IDX = c.USER_CHARACTER_IDX
    WHERE q.IDX = %s AND uc.USER_NO = %s
"""


# 사용자가 마지막으로 고른 역할. 역할을 고르면 ensure_user_character 가 여기 표시해 둔다.
SELECTED_PERSONA_SQL = """
    SELECT cm.CHARACTER_TYPE
    FROM USER_CHARACTER uc
    JOIN CHARACTER_MASTER cm ON cm.IDX = uc.CHARACTER_IDX
    WHERE uc.USER_NO = %s AND uc.IS_SELECTED = 1
    ORDER BY uc.IDX DESC LIMIT 1
"""


def find_selected_persona_key(connection: pymysql.Connection, user_no: int) -> str | None:
    # 앱을 다시 열었을 때 고르던 역할을 그대로 보여 주기 위해 쓴다.
    return _scalar(connection, SELECTED_PERSONA_SQL, (user_no,))


class QuestNotFoundError(Exception):
    """요청한 퀘스트가 이 사용자의 코스에 없다."""


def _scalar(connection: pymysql.Connection, sql: str, parameters: tuple = ()) -> int | None:
    with connection.cursor() as cursor:
        cursor.execute(sql, parameters)
        row = cursor.fetchone()
    return next(iter(row.values())) if row else None


def _execute(connection: pymysql.Connection, sql: str, parameters: tuple = ()) -> int:
    with connection.cursor() as cursor:
        cursor.execute(sql, parameters)
        return cursor.lastrowid


def ensure_character(connection: pymysql.Connection, persona: Persona) -> int:
    # 캐릭터 등록 
    found = _scalar(
        connection, "SELECT IDX FROM CHARACTER_MASTER WHERE CHARACTER_TYPE = %s", (persona.key,)
    )
    if found:
        return found
    return _execute(
        connection,
        "INSERT INTO CHARACTER_MASTER (CHARACTER_TYPE, IS_ACTIVE) VALUES (%s, 1)",
        (persona.key,),
    )


def ensure_user_character(
    connection: pymysql.Connection,
    user_no: int,
    character_idx: int,
) -> int:
    # 사용자 캐릭터 등록, 선택 캐릭터로 지정
    found = _scalar(
        connection,
        "SELECT IDX FROM USER_CHARACTER WHERE USER_NO = %s AND CHARACTER_IDX = %s",
        (user_no, character_idx),
    )
    if found is None:
        found = _execute(
            connection,
            "INSERT INTO USER_CHARACTER (USER_NO, CHARACTER_IDX, IS_SELECTED) VALUES (%s, %s, 1)",
            (user_no, character_idx),
        )
    _execute(
        connection,
        "UPDATE USER_CHARACTER SET IS_SELECTED = (IDX = %s) WHERE USER_NO = %s",
        (found, user_no),
    )
    return found


def ensure_map_place(connection: pymysql.Connection, stop: Stop) -> int:
    # 장소 등록, 이미 있으면 아이콘만 업데이트
    found = _scalar(
        connection, "SELECT IDX FROM MAP_PLACE WHERE PLACE_IDX = %s", (stop.place_idx,)
    )
    if found:
        _execute(
            connection,
            "UPDATE MAP_PLACE SET MARKER_ICON_TYPE = %s WHERE IDX = %s",
            (stop.icon, found),
        )
        return found
    return _execute(
        connection,
        "INSERT INTO MAP_PLACE (PLACE_IDX, PLACE_CODE, MARKER_ICON_TYPE) VALUES (%s, %s, %s)",
        (stop.place_idx, f"PLACE-{stop.place_idx}", stop.icon),
    )


def find_active_course(connection: pymysql.Connection, user_character_idx: int) -> int | None:
    return _scalar(
        connection,
        """SELECT IDX FROM COURSE
           WHERE USER_CHARACTER_IDX = %s AND IS_ACTIVE = 1
           ORDER BY IDX DESC LIMIT 1""",
        (user_character_idx,),
    )


def load_course(
    connection: pymysql.Connection,
    course_idx: int,
    persona: Persona,
    visit_date: date,
    language: str = "ko",
) -> Course | None:
    with connection.cursor() as cursor:
        cursor.execute(course_stops_sql(), (language, course_idx))
        rows = cursor.fetchall()
    if not rows:
        return None

    stops: list[Stop] = []
    position: tuple[float, float] | None = None
    for row in rows:
        point = (float(row["LATITUDE"]), float(row["LONGITUDE"]))
        stops.append(
            Stop(
                order=row["QUEST_ORDER"],
                time_slot=row["TIME_SLOT"] or "",
                place_idx=row["PLACE_IDX"],
                name=row["NAME"],
                category=row["CATEGORY_SUB"],
                address=row["ADDRESS"],
                latitude=point[0],
                longitude=point[1],
                menu=row["MENU"],
                rest_date=row["REST_DATE"],
                operating_hours=row["OPERATING_HOURS"],
                parking=row["PARKING"],
                # 이전 장소가 있으면 거리 계산, 없으면 0
                distance_km=round(distance_km(position, point), 2),
                img=row["IMG"],
                icon=row["MARKER_ICON_TYPE"],
                quest_id=row["QUEST_IDX"],
                completed=row["QUEST_STATUS"] == QUEST_STATUS_DONE,
                has_docent=bool(row["HAS_DOCENT"]),
            )
        )
        position = point

    return Course(
        persona_key=persona.key,
        persona_name=persona.name,
        visit_date=visit_date,
        stops=tuple(stops),
        skipped_slots=(),
        course_id=course_idx,
    )


def save_course(
    connection: pymysql.Connection,
    user_character_idx: int,
    persona: Persona,
    course: Course,
) -> int:
    # 코스 저장, 이전 코스는 비활성
    connection.begin()
    try:
        _execute(
            connection,
            "UPDATE COURSE SET IS_ACTIVE = 0 WHERE USER_CHARACTER_IDX = %s",
            (user_character_idx,),
        )
        course_idx = _execute(
            connection,
            """INSERT INTO COURSE (USER_CHARACTER_IDX, COURSE_NAME, DESCRIPTION, REWARD_IMAGE)
               VALUES (%s, %s, %s, '')""",
            (
                user_character_idx,
                f"{persona.name} 코스",
                f"{persona.name}의 하루를 따라 걷는 코스",
            ),
        )
        for stop in course.stops:
            map_place_idx = ensure_map_place(connection, stop)
            _execute(
                connection,
                """INSERT INTO QUEST
                   (COURSE_IDX, MAP_PLACE_IDX, PLACE_IDX, QUEST_ORDER, TIME_SLOT, QUEST_TYPE, TITLE, CONTENT)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    course_idx,
                    map_place_idx,
                    stop.place_idx,
                    stop.order,
                    stop.time_slot,
                    QUEST_TYPE_VISIT,
                    stop.name,
                    stop.category,
                ),
            )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return course_idx


def complete_quest(
    connection: pymysql.Connection,
    *,
    user_no: int,
    quest_id: int,
) -> dict:
    # 방문 완료를 USER_QUEST 에 저장
    with connection.cursor() as cursor:
        cursor.execute(QUEST_OWNER_SQL, (quest_id, user_no))
        owner = cursor.fetchone()
    if not owner:
        raise QuestNotFoundError(quest_id)

    _execute(
        connection,
        """INSERT INTO USER_QUEST (USER_CHARACTER_IDX, QUEST_IDX, STATUS, COMPLETED_AT)
           VALUES (%s, %s, %s, NOW())
           ON DUPLICATE KEY UPDATE
               STATUS = %s,
               COMPLETED_AT = COALESCE(COMPLETED_AT, NOW())""",
        (owner["USER_CHARACTER_IDX"], quest_id, QUEST_STATUS_DONE, QUEST_STATUS_DONE),
    )

    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT STATUS, COMPLETED_AT FROM USER_QUEST
               WHERE USER_CHARACTER_IDX = %s AND QUEST_IDX = %s""",
            (owner["USER_CHARACTER_IDX"], quest_id),
        )
        saved = cursor.fetchone() or {}

    return {
        "quest_id": quest_id,
        "name": owner["TITLE"],
        "completed": saved.get("STATUS") == QUEST_STATUS_DONE,
        "completed_at": saved.get("COMPLETED_AT"),
    }


def get_or_create_course(
    connection: pymysql.Connection,
    *,
    user_no: int,
    persona: Persona,
    visit_date: date | None = None,
    refresh: bool = False,
    language: str = "ko",
) -> Course:
    visit_date = visit_date or date.today()
    character_idx = ensure_character(connection, persona)
    user_character_idx = ensure_user_character(connection, user_no, character_idx)

    if not refresh:
        course_idx = find_active_course(connection, user_character_idx)
        if course_idx:
            saved = load_course(connection, course_idx, persona, visit_date, language)
            if saved:
                return saved

    built = build_course(connection, persona, visit_date=visit_date, language=language)
    course_idx = save_course(connection, user_character_idx, persona, built)
    return load_course(connection, course_idx, persona, visit_date, language) or built
