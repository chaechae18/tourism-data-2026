from dataclasses import dataclass
from hashlib import md5
import json
import logging

import httpx
import pymysql

from .personas import PERSONA_KEYS, PERSONA_PROFILES


logger = logging.getLogger(__name__)

OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
# 한 번에 이만큼씩 묶어 보낸다. 너무 많이 담으면 답이 잘리고, 적으면 호출 수가 늘어난다.
BATCH_SIZE = 10
# 채점에 넣는 설명문 길이. 앞부분만으로도 성격은 충분히 드러나고 토큰을 아낀다.
DESCRIPTION_LIMIT = 400
MAX_SCORE = 5

# 채점 대상: 좌표가 있어 코스에 쓸 수 있고, 판단할 설명이 있는 장소.
# 설명이 없으면 채점기가 이름만 보고 아무 점수나 매기므로(예: 이름만 있는 테스트 데이터)
# 아예 후보에서 뺀다. 점수가 없는 장소는 코스에도 뽑히지 않는다.
CANDIDATE_SQL = """
    SELECT p.IDX, p.NAME, p.TYPE, p.CATEGORY_SUB, p.MENU, p.TEXT,
           s.TEXT_HASH AS SAVED_HASH
    FROM PLACE p
    LEFT JOIN PLACE_PERSONA_SCORE s
      ON s.PLACE_IDX = p.IDX AND s.PERSONA_KEY = %s
    WHERE p.LATITUDE IS NOT NULL AND p.LATITUDE <> ''
      AND p.LONGITUDE IS NOT NULL AND p.LONGITUDE <> ''
      AND p.TEXT IS NOT NULL AND p.TEXT <> ''
    ORDER BY p.IDX
"""

# 점수 기준을 다 적어 주지 않으면 모델이 0 과 5 만 쓴다. 그러면 후보가 좁아져
# 코스가 매번 비슷해지므로, 각 점수의 뜻과 예시를 함께 준다.
SYSTEM_PROMPT = f"""너는 경주 여행 코스를 짜는 사람이다. 신라 시대 인물 여섯 명이 각자 하루 코스를 도는데,
주어진 장소가 각 인물에게 얼마나 어울리는지 0~{MAX_SCORE}으로 매겨라.

[점수 기준]
5 = 이 인물을 대표하는 장소
4 = 아주 잘 어울린다
3 = 어울린다. 코스에 넣어도 자연스럽다
2 = 약간 관련이 있다
1 = 거의 관계없지만 아주 무관하지는 않다
0 = 전혀 무관하다

[매기는 법]
- 5점은 아껴 써라. 한 장소가 5점을 받는 인물은 많아야 한두 명이다.
- 대부분의 장소는 여러 인물에게서 1~3점을 받는다. 한 인물만 높고 나머지가 전부 0인 경우는 드물다.
- 관광지는 인물의 관심사와, 음식점은 그 인물이 먹었을 법한 상차림과 맞춰 판단해라.
- 놀이시설·숙박·캠핑장처럼 신라와 상관없는 현대 시설은 모든 인물에게 0에 가깝다.
- 설명이 비어 있거나 무엇인지 알 수 없는 장소는 모든 인물에게 0을 줘라. 추측하지 마라.
- 설명에 없는 사실을 지어내지 말고 주어진 정보만으로 판단해라.

[예시] 경주 내물왕릉 (고분, 능)
→ king 5, court_lady 3, scholar 2, hwarang 1, monk 0, merchant 0
  왕의 무덤이라 왕에게 대표적이고, 궁녀에게는 궁 주변의 자취로 이어지며,
  학자에게는 답사할 만한 옛터다. 화랑과는 관련이 옅고 나머지는 무관하다."""


@dataclass
class ScoringResult:
    scored: int = 0
    skipped: int = 0
    failed: int = 0

    def __str__(self) -> str:
        return f"채점={self.scored} 건너뜀={self.skipped} 실패={self.failed}"


class PersonaScoringError(RuntimeError):
    pass


def text_hash(place: dict) -> str:
    # 채점 근거가 되는 값들이 바뀌면 해시도 바뀐다 → 그 장소만 다시 채점한다.
    raw = "|".join(
        str(place.get(field) or "") for field in ("NAME", "CATEGORY_SUB", "MENU", "TEXT")
    )
    return md5(raw.encode("utf-8")).hexdigest()


def describe(place: dict) -> dict:
    # LLM 에 보낼 장소 한 건. 필요한 것만 담아 토큰을 아낀다.
    described = {
        "id": place["IDX"],
        "name": place["NAME"],
        "종류": "음식점" if place["TYPE"] == "FOOD" else "관광지",
        "분류": place["CATEGORY_SUB"] or "",
        "설명": (place["TEXT"] or "")[:DESCRIPTION_LIMIT],
    }
    if place.get("MENU"):
        described["메뉴"] = place["MENU"][:120]
    return described


def build_user_prompt(places: list[dict]) -> str:
    roles = "\n".join(f"- {p.key} ({p.name}): {p.guide}" for p in PERSONA_PROFILES)
    payload = json.dumps([describe(place) for place in places], ensure_ascii=False, indent=1)
    example = ", ".join(f'"{key}": 0' for key in PERSONA_KEYS)
    return (
        f"[인물]\n{roles}\n\n"
        f"[장소]\n{payload}\n\n"
        "[출력 형식]\n"
        '{"scores": [{"id": 장소id, ' + example + "}, ...]}\n"
        f"장소 {len(places)}건 전부에 대해, 위 인물 {len(PERSONA_KEYS)}명의 점수를 모두 채워라. "
        "JSON 만 출력해라."
    )


def request_scores(
    places: list[dict],
    *,
    api_key: str,
    model: str,
    client: httpx.Client | None = None,
    timeout: float = 90.0,
) -> dict[int, dict[str, int]]:
    if not api_key:
        raise PersonaScoringError(
            "OPENAI_API_KEY 가 없습니다. backend/.env 에 키를 넣어 주세요."
        )

    body = {
        "model": model,
        # 매번 같은 답이 나오도록 무작위성을 없앤다.
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_prompt(places)},
        ],
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    try:
        if client:
            response = client.post(OPENAI_CHAT_URL, json=body, headers=headers, timeout=timeout)
        else:
            with httpx.Client(timeout=timeout) as http:
                response = http.post(OPENAI_CHAT_URL, json=body, headers=headers)
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        raise PersonaScoringError(
            f"OpenAI 응답 {error.response.status_code}: {error.response.text[:200]}"
        ) from error
    except httpx.HTTPError as error:
        raise PersonaScoringError(f"OpenAI 연결 실패: {error}") from error

    content = response.json()["choices"][0]["message"]["content"]
    return parse_scores(content)


def parse_scores(content: str) -> dict[int, dict[str, int]]:
    try:
        payload = json.loads(content)
    except ValueError as error:
        raise PersonaScoringError(f"JSON 을 읽지 못했습니다: {content[:200]}") from error

    rows = payload.get("scores") if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        raise PersonaScoringError(f"scores 목록이 없습니다: {content[:200]}")

    scores: dict[int, dict[str, int]] = {}
    for row in rows:
        place_id = row.get("id")
        if place_id is None:
            continue
        # 모르는 키는 버리고, 빠진 역할은 0 으로 채운다.
        scores[int(place_id)] = {
            key: clamp(row.get(key, 0)) for key in PERSONA_KEYS
        }
    return scores


def clamp(value: object) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return 0
    return max(0, min(MAX_SCORE, number))


def save_scores(
    connection: pymysql.Connection,
    place_id: int,
    scores: dict[str, int],
    hashed: str,
) -> None:
    # 사람이 손으로 고친 점수(SOURCE='manual')는 덮어쓰지 않는다.
    with connection.cursor() as cursor:
        cursor.executemany(
            """INSERT INTO PLACE_PERSONA_SCORE (PLACE_IDX, PERSONA_KEY, SCORE, SOURCE, TEXT_HASH)
               VALUES (%s, %s, %s, 'llm', %s) AS new
               ON DUPLICATE KEY UPDATE
                   SCORE = IF(PLACE_PERSONA_SCORE.SOURCE = 'manual',
                              PLACE_PERSONA_SCORE.SCORE, new.SCORE),
                   TEXT_HASH = new.TEXT_HASH""",
            [(place_id, key, score, hashed) for key, score in scores.items()],
        )


def score_places(
    connection: pymysql.Connection,
    *,
    api_key: str,
    model: str,
    limit: int | None = None,
    refresh: bool = False,
    client: httpx.Client | None = None,
) -> ScoringResult:
    result = ScoringResult()
    with connection.cursor() as cursor:
        cursor.execute(CANDIDATE_SQL, (PERSONA_KEYS[0],))
        places = cursor.fetchall()

    pending = []
    for place in places:
        hashed = text_hash(place)
        # 이미 같은 내용으로 채점해 둔 장소는 건너뛴다. (다시 돌려도 돈이 안 나간다)
        if not refresh and place["SAVED_HASH"] == hashed:
            result.skipped += 1
            continue
        pending.append((place, hashed))
        if limit is not None and len(pending) >= limit:
            break

    for start in range(0, len(pending), BATCH_SIZE):
        batch = pending[start:start + BATCH_SIZE]
        try:
            scores = request_scores(
                [place for place, _ in batch], api_key=api_key, model=model, client=client
            )
        except PersonaScoringError as error:
            logger.warning("[채점 실패] %s", error)
            result.failed += len(batch)
            continue

        for place, hashed in batch:
            place_scores = scores.get(place["IDX"])
            if not place_scores:
                result.failed += 1
                continue
            save_scores(connection, place["IDX"], place_scores, hashed)
            result.scored += 1

    return result
