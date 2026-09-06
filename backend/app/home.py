from datetime import datetime, timedelta
from functools import lru_cache
import logging
import os
import re

import pymysql

from .models.home import (
    BannerResponse,
    FestivalResponse,
    PopupResponse,
    RecommendedPlaceResponse,
)
from .mysql import fetch_all
from .search_controls import TTLCache
from .tourapi import SOURCE_TOUR_API, TourApiClient, TourApiError, fetch_festivals


logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = ("ko", "en", "ja", "zh")
DEFAULT_LANGUAGE = "ko"
TRANSLATED_COLUMNS = ("NAME", "CONTENT", "LOCATION")
OVERRIDE_COLUMNS = ("URL", "IMG")

# 상세 조회가 행사 1건당 2회라, 홈 화면에 걸리는 시간을 건수로 막는다.
FESTIVAL_LIMIT = int(os.getenv("FESTIVAL_LIMIT", "12"))
FESTIVAL_CACHE_TTL_SECONDS = int(os.getenv("FESTIVAL_CACHE_TTL_SECONDS", "60"))
FESTIVAL_WINDOW_DAYS = int(os.getenv("FESTIVAL_WINDOW_DAYS", "60"))

festival_cache = TTLCache(max_entries=8)

# PLACE 에 정렬 컬럼이 없어 홈 노출 순서를 여기서 고정한다. 목록에 없는 곳은 조회수 순으로 뒤에 붙는다.
# PLACE.TEXT 와 번역 행은 홈 카드에 담기엔 길어서, 아래 요약을 대신 내려보낸다.
# 카드가 두 줄 고정이라 문장마다 줄을 바꿔 적는다.
RECOMMENDED_PLACES = {
    "경주 불국사 [유네스코 세계유산]": {
        "ko": "석가탑과 다보탑이 마주 선 신라 불교 예술의 정수.\n돌계단과 석축까지 국보로 지정돼 있습니다.",
        "en": "Silla Buddhist art at its peak, where the Seokgatap and Dabotap pagodas face each other.\nEven the stone stairways and terraces are national treasures.",
        "ja": "釈迦塔と多宝塔が向かい合う、新羅仏教美術の頂点。\n石段や石垣まで国宝に指定されています。",
        "zh": "释迦塔与多宝塔相对而立，新罗佛教艺术的巅峰。\n连石阶与石墙都被列为国宝。",
    },
    "경주 석굴암 [유네스코 세계유산]": {
        "ko": "토함산 인공 석굴에서 동해를 바라보는 본존불.\n해 뜰 무렵 얼굴에 빛이 닿도록 설계했습니다.",
        "en": "A grotto carved into Tohamsan, its Buddha gazing toward the East Sea.\nIt was built so the dawn light would reach his face.",
        "ja": "吐含山の人工石窟から東海を望む本尊仏。\n日の出の光が顔に届くよう設計されています。",
        "zh": "吐含山人工石窟中的本尊佛，遥望东海。\n当初的设计让日出之光正好照在佛面上。",
    },
    "경주 첨성대": {
        "ko": "신라가 별을 읽던 자리, 동양에서 가장 오래된 천문대.\n1400년을 무너지지 않고 그대로 서 있습니다.",
        "en": "The oldest surviving observatory in East Asia, where Silla read the stars.\nIt has stood unmoved for fourteen centuries.",
        "ja": "新羅が星を読んだ場所、東洋最古の天文台。\n1400年のあいだ崩れることなく立ち続けています。",
        "zh": "新罗人观星之处，东亚现存最古老的天文台。\n历经一千四百年依然屹立不倒。",
    },
    "경주 대릉원 일원": {
        "ko": "신라 고분 스물세 기가 이어지는 능선.\n천마총은 무덤 안까지 걸어 들어갈 수 있습니다.",
        "en": "A skyline of twenty-three Silla royal mounds.\nAt Cheonmachong you can walk right inside the tomb.",
        "ja": "新羅の古墳23基が連なる稜線。\n天馬塚は墓の内部まで歩いて入れます。",
        "zh": "二十三座新罗古坟连成的起伏天际线。\n天马冢可以一直走进墓室内部。",
    },
    "경주 동궁과 월지": {
        "ko": "신라 왕궁의 별궁과 연못.\n해가 지면 물 위에 전각이 통째로 비칩니다.",
        "en": "The detached palace and pond of the Silla court.\nAfter sunset the halls reflect whole on the water.",
        "ja": "新羅王宮の別宮と池。\n日が暮れると水面に楼閣がまるごと映ります。",
        "zh": "新罗王宫的别宫与莲池。\n日落之后，楼阁完整倒映在水面上。",
    },
    "월정교": {
        "ko": "왕궁과 남산을 잇던 신라의 다리.\n밤에는 조명이 켜져 강물에 반쯤 잠긴 듯 보입니다.",
        "en": "The Silla bridge that linked the palace to Namsan.\nLit at night, it looks half-sunk in the river.",
        "ja": "王宮と南山を結んでいた新羅の橋。\n夜は照明がともり、川に半ば沈んだように見えます。",
        "zh": "曾连接王宫与南山的新罗桥梁。\n入夜亮灯，宛如半沉在河水之中。",
    },
    "경주 황리단길": {
        "ko": "대릉원 돌담을 따라 이어진 한옥 골목.\n카페와 공방, 사진관이 촘촘히 모여 있습니다.",
        "en": "A hanok lane running along the Daereungwon wall.\nCafes, craft studios and photo shops sit shoulder to shoulder.",
        "ja": "大陵苑の石垣沿いに続く韓屋の路地。\nカフェや工房、写真館が軒を連ねています。",
        "zh": "沿着大陵苑石墙延伸的韩屋小巷。\n咖啡馆、手作工坊与照相馆紧挨在一起。",
    },
    "경주 양동마을 [유네스코 세계유산]": {
        "ko": "500년 넘게 사람이 살아온 조선 시대 씨족 마을.\n기와집과 초가집이 언덕을 따라 앉아 있습니다.",
        "en": "A Joseon clan village lived in for more than five hundred years.\nTiled and thatched houses sit along the hillside.",
        "ja": "500年以上人が暮らし続ける朝鮮時代の同族村。\n瓦屋根と藁葺きの家が丘に沿って並びます。",
        "zh": "延续五百多年、至今仍有人居住的朝鲜时代同族村落。\n瓦房与草屋沿着山坡错落而建。",
    },
    "천마총(대릉원)": {
        "ko": "천마도가 나온 신라 고분.\n무덤 속으로 들어가 금관과 부장품을 볼 수 있습니다.",
        "en": "The Silla tomb that yielded the painting of the heavenly horse.\nStep inside to see the gold crown and burial goods.",
        "ja": "天馬図が出土した新羅の古墳。\n墓の中に入り、金冠や副葬品を見られます。",
        "zh": "出土天马图的新罗古坟。\n可以走进墓室，看到金冠与随葬品。",
    },
    "경주 포석정지": {
        "ko": "물길에 술잔을 띄우던 신라 귀족의 연회터.\n지금은 굽이치는 돌 수로만 남아 있습니다.",
        "en": "Where Silla nobles floated wine cups down a winding channel.\nOnly the curving stone waterway remains today.",
        "ja": "水路に杯を浮かべた新羅貴族の宴の跡。\n今は曲がりくねった石の水路だけが残ります。",
        "zh": "新罗贵族在水道上流觞饮酒的宴游之地。\n如今只剩下蜿蜒的石制水渠。",
    },
    "경주엑스포대공원": {
        "ko": "경주타워와 정원이 있는 문화 공원.\n밤에는 타워 벽면에 미디어 아트를 띄웁니다.",
        "en": "A culture park built around Gyeongju Tower and its gardens.\nAt night media art plays across the tower wall.",
        "ja": "慶州タワーと庭園がある文化公園。\n夜はタワーの壁面にメディアアートが映し出されます。",
        "zh": "以庆州塔和园林为中心的文化公园。\n夜间塔身墙面会上演媒体艺术秀。",
    },
    "경주 배동 삼릉": {
        "ko": "소나무 숲에 신라 왕릉 세 기가 나란합니다.\n새벽 안개가 내리면 사진가들이 모입니다.",
        "en": "Three Silla royal tombs lined up in a pine forest.\nPhotographers gather here when the dawn mist settles.",
        "ja": "松林の中に新羅の王陵が三基並びます。\n明け方に霧が立つと写真家が集まります。",
        "zh": "松林之中并排着三座新罗王陵。\n清晨起雾时，摄影师们纷纷聚集于此。",
    },
}
RECOMMENDED_ORDER = tuple(RECOMMENDED_PLACES)

SENTENCE_END = re.compile(r"[.。!?！？\n]")
SUMMARY_SENTENCES = 2


def normalize_language(raw: str | None) -> str:
    if not raw:
        return DEFAULT_LANGUAGE
    primary = raw.split(",")[0].split(";")[0].split("-")[0].strip().lower()
    return primary if primary in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE


def resolve_language(lang: str | None, accept_language: str | None) -> str:
    return normalize_language(lang or accept_language)


# 번역은 요청 언어 행 → 한국어 행 → 원본 컬럼 순으로 고른다.
# 빈 문자열도 "번역 없음" 으로 본다.
def _translated(column: str, source_alias: str) -> str:
    return (
        f"COALESCE(NULLIF(t.{column}, ''), NULLIF(k.{column}, ''), {source_alias}.{column})"
        f" AS {column}"
    )


def list_banners(connection: pymysql.Connection) -> list[BannerResponse]:
    now = datetime.now()
    rows = fetch_all(
        connection,
        """
        SELECT IMG, TITLE, SUB_TITLE, LINK
        FROM MAIN_BANNER
        WHERE IS_TRASH = 0
          AND IS_DISPLAY = 1
          AND (START_DATE IS NULL OR START_DATE <= %s)
          AND (END_DATE IS NULL OR END_DATE >= %s)
        ORDER BY SORT, IDX
        """,
        (now, now),
    )
    return [
        BannerResponse(
            img=row["IMG"],
            title=row["TITLE"],
            sub_title=row["SUB_TITLE"],
            link=row["LINK"],
        )
        for row in rows
    ]


def list_popups(connection: pymysql.Connection, *, language: str) -> list[PopupResponse]:
    now = datetime.now()
    rows = fetch_all(
        connection,
        f"""
        SELECT
            {_translated("TITLE", "p")},
            {_translated("CONTENT", "p")},
            p.IMG,
            p.LINK
        FROM POPUP p
        LEFT JOIN POPUP_I18N t ON t.POPUP_IDX = p.IDX AND t.LANGUAGE_CODE = %s
        LEFT JOIN POPUP_I18N k ON k.POPUP_IDX = p.IDX AND k.LANGUAGE_CODE = %s
        WHERE p.IS_DISPLAY = 1
          AND (p.START_DATE IS NULL OR p.START_DATE <= %s)
          AND (p.END_DATE IS NULL OR p.END_DATE >= %s)
        ORDER BY p.IDX DESC
        """,
        (language, DEFAULT_LANGUAGE, now, now),
    )
    return [
        PopupResponse(
            title=row["TITLE"],
            content=row["CONTENT"],
            img=row["IMG"],
            link=row["LINK"],
        )
        for row in rows
    ]


@lru_cache
def _tour_api_client() -> TourApiClient:
    # 홈 화면 요청 안에서 도니 sync 스크립트보다 짧게 끊는다.
    return TourApiClient(timeout=5, max_retries=2, retry_backoff=0.5)


def get_tour_api_client() -> TourApiClient | None:
    try:
        return _tour_api_client()
    except TourApiError as exc:
        logger.warning("TourAPI 클라이언트를 만들지 못했습니다: %s", exc)
        return None


def _festival_response(fields: dict) -> FestivalResponse:
    return FestivalResponse(
        name=fields["NAME"],
        content=fields["CONTENT"],
        location=fields["LOCATION"],
        start_date=fields["START_DATE"],
        end_date=fields["END_DATE"],
        img=fields["IMG"],
        url=fields["URL"],
    )


# 오늘부터 FESTIVAL_WINDOW_DAYS 일 사이에 걸치는 행사를 진행중인 것부터 보여준다.
# 경주 행사는 한 달 넘게 비는 구간이 있어, 창이 짧으면 홈이 통째로 비어 보인다.
# 캐시 키가 오늘 날짜라 자정이 지나면 다음 요청에서 저절로 새 구간을 잡는다.
def _festival_window(client: TourApiClient, now: datetime) -> list[dict] | None:
    today = now.strftime("%Y%m%d")
    cached = festival_cache.get(today)
    if cached is not None:
        return cached

    last = now + timedelta(days=FESTIVAL_WINDOW_DAYS)
    try:
        festivals = fetch_festivals(
            client, today, limit=FESTIVAL_LIMIT, event_end_date=last.strftime("%Y%m%d")
        )
    except TourApiError as exc:
        logger.warning("TourAPI 행사 조회 실패, FESTIVAL 테이블로 대체합니다: %s", exc)
        return None

    # 날짜는 자정으로 파싱되므로 날짜끼리 비교해야 오늘 끝나는 행사가 남는다.
    upcoming = [
        fields
        for fields in festivals
        if (fields["END_DATE"] is None or fields["END_DATE"].date() >= now.date())
        and (fields["START_DATE"] is None or fields["START_DATE"].date() <= last.date())
    ]
    # 시작일 오름차순이라 이미 시작한 행사가 앞에 온다.
    upcoming.sort(key=lambda fields: fields["START_DATE"] or datetime.max)
    festival_cache.set(today, upcoming, FESTIVAL_CACHE_TTL_SECONDS)
    return upcoming


# 숨김 여부와 링크·사진은 항상, 번역은 한국어가 아닐 때만 읽는다. 왕복을 늘리지 않으려고
# 한 쿼리에서 컬럼만 붙인다. TourAPI 는 한국어 서비스만 활용신청되어 있다.
def _festival_overrides(
    connection: pymysql.Connection,
    content_ids: list[str],
    language: str,
) -> dict[str, dict]:
    if not content_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(content_ids))
    columns = "f.CONTENT_ID, f.IS_TRASH, f.URL, f.IMG"
    join = ""
    parameters: tuple = ()
    if language != DEFAULT_LANGUAGE:
        columns += ", t.NAME, t.CONTENT, t.LOCATION"
        join = (
            "LEFT JOIN FESTIVAL_I18N t"
            " ON t.FESTIVAL_IDX = f.IDX AND t.LANGUAGE_CODE = %s"
        )
        parameters = (language,)
    try:
        rows = fetch_all(
            connection,
            f"""
            SELECT {columns}
            FROM FESTIVAL f
            {join}
            WHERE f.SOURCE = %s AND f.CONTENT_ID IN ({placeholders})
            """,
            (*parameters, SOURCE_TOUR_API, *content_ids),
        )
    except pymysql.Error as exc:
        logger.warning("행사 DB 조회에 실패해 TourAPI 원문만 내려보냅니다: %s", exc)
        return {}
    return {row["CONTENT_ID"]: row for row in rows}


def list_festivals(
    connection: pymysql.Connection,
    client: TourApiClient | None,
    *,
    language: str,
) -> list[FestivalResponse]:
    now = datetime.now()
    festivals = _festival_window(client, now) if client else None
    if festivals is None:
        return list_stored_festivals(connection, language=language)

    overrides = _festival_overrides(
        connection,
        [fields["CONTENT_ID"] for fields in festivals if fields["CONTENT_ID"]],
        language,
    )
    responses = []
    for fields in festivals:
        override = overrides.get(fields["CONTENT_ID"]) or {}
        if override.get("IS_TRASH"):
            continue
        # TourAPI 링크·사진이 엉뚱한 행사가 있어, 운영자가 채워 넣은 값을 우선한다.
        edited = {
            column: override[column]
            for column in TRANSLATED_COLUMNS + OVERRIDE_COLUMNS
            if override.get(column)
        }
        responses.append(_festival_response({**fields, **edited}))
    return responses


def list_stored_festivals(
    connection: pymysql.Connection,
    *,
    language: str,
) -> list[FestivalResponse]:
    now = datetime.now()
    rows = fetch_all(
        connection,
        f"""
        SELECT
            {_translated("NAME", "f")},
            {_translated("CONTENT", "f")},
            {_translated("LOCATION", "f")},
            f.START_DATE,
            f.END_DATE,
            f.IMG,
            f.URL
        FROM FESTIVAL f
        LEFT JOIN FESTIVAL_I18N t ON t.FESTIVAL_IDX = f.IDX AND t.LANGUAGE_CODE = %s
        LEFT JOIN FESTIVAL_I18N k ON k.FESTIVAL_IDX = f.IDX AND k.LANGUAGE_CODE = %s
        WHERE f.IS_TRASH = 0
          AND (f.END_DATE IS NULL OR f.END_DATE >= %s)
          AND (f.START_DATE IS NULL OR f.START_DATE <= %s)
        ORDER BY f.START_DATE, f.IDX
        """,
        (language, DEFAULT_LANGUAGE, now, now + timedelta(days=FESTIVAL_WINDOW_DAYS)),
    )
    return [_festival_response(row) for row in rows]


def _recommended_rank(row: dict) -> int:
    name = row["SOURCE_NAME"]
    return RECOMMENDED_ORDER.index(name) if name in RECOMMENDED_ORDER else len(RECOMMENDED_ORDER)


def _summary(row: dict, language: str) -> str | None:
    written = RECOMMENDED_PLACES.get(row["SOURCE_NAME"])
    if written:
        return written.get(language) or written[DEFAULT_LANGUAGE]
    text = row["TEXT"]
    if not text:
        return text
    lines = []
    rest = text.strip()
    while rest and len(lines) < SUMMARY_SENTENCES:
        end = SENTENCE_END.search(rest)
        cut = end.end() if end else len(rest)
        lines.append(rest[:cut].strip())
        rest = rest[cut:].strip()
    return "\n".join(lines)


def list_recommended_places(
    connection: pymysql.Connection,
    *,
    language: str,
) -> list[RecommendedPlaceResponse]:
    rows = fetch_all(
        connection,
        f"""
        SELECT
            {_translated("NAME", "p")},
            {_translated("TEXT", "p")},
            {_translated("ADDRESS", "p")},
            {_translated("ADMISSION_FEE", "p")},
            p.NAME AS SOURCE_NAME,
            p.LATITUDE,
            p.LONGITUDE
        FROM PLACE p
        LEFT JOIN PLACE_I18N t ON t.PLACE_IDX = p.IDX AND t.LANGUAGE_CODE = %s
        LEFT JOIN PLACE_I18N k ON k.PLACE_IDX = p.IDX AND k.LANGUAGE_CODE = %s
        WHERE p.IS_RECOMMENDED = 1
          AND p.IS_DISPLAY = 1
        ORDER BY p.VIEW_COUNT DESC, p.IDX
        """,
        (language, DEFAULT_LANGUAGE),
    )
    # PyMySQL 은 결과가 없으면 list 가 아니라 빈 tuple 을 준다.
    rows = sorted(rows, key=_recommended_rank)
    return [
        RecommendedPlaceResponse(
            name=row["NAME"],
            text=_summary(row, language),
            address=row["ADDRESS"],
            latitude=row["LATITUDE"],
            longitude=row["LONGITUDE"],
            admission_fee=row["ADMISSION_FEE"],
        )
        for row in rows
    ]
