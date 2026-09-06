from collections.abc import Callable
import json

import httpx
import pymysql
import pytest

from app.persona_scoring import (
    PersonaScoringError,
    clamp,
    parse_scores,
    score_places,
    text_hash,
)
from app.personas import PERSONA_KEYS


def add_place(insert: Callable[..., int], name: str, content_id: str, text: str) -> int:
    return insert(
        "PLACE",
        SOURCE="TOUR_API",
        CONTENT_ID=content_id,
        TYPE="TOUR",
        NAME=name,
        TEXT=text,
        CATEGORY_SUB="고분, 능",
        LATITUDE="35.8352",
        LONGITUDE="129.2284",
    )


def fake_openai(answer: dict, calls: list) -> httpx.Client:
    """OpenAI 를 실제로 부르지 않고 정해진 답을 돌려주는 가짜 클라이언트."""

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(answer)}}]},
        )

    return httpx.Client(transport=httpx.MockTransport(handler))


def scores_for(place_id: int, **overrides: int) -> dict:
    row = {"id": place_id, **{key: 0 for key in PERSONA_KEYS}}
    row.update(overrides)
    return row


def test_scores_are_saved_for_every_persona(
    database: pymysql.Connection,
    insert: Callable[..., int],
    rows: Callable[..., list[dict]],
) -> None:
    place_id = add_place(insert, "경주 김유신묘", "5001", "김유신 장군의 묘로 삼국을 통일한...")
    calls: list = []
    client = fake_openai({"scores": [scores_for(place_id, hwarang=5, king=3)]}, calls)

    result = score_places(database, api_key="test-key", model="gpt-4o-mini", client=client)

    assert result.scored == 1
    saved = {
        row["PERSONA_KEY"]: row["SCORE"]
        for row in rows("SELECT PERSONA_KEY, SCORE FROM PLACE_PERSONA_SCORE")
    }
    # 역할 여섯 개 점수가 모두 저장된다.
    assert set(saved) == set(PERSONA_KEYS)
    assert saved["hwarang"] == 5
    assert saved["king"] == 3
    assert saved["monk"] == 0


def test_already_scored_places_are_skipped(
    database: pymysql.Connection,
    insert: Callable[..., int],
) -> None:
    place_id = add_place(insert, "경주 첨성대", "5002", "별을 읽던 신라의 천문대.")
    calls: list = []
    client = fake_openai({"scores": [scores_for(place_id, scholar=5)]}, calls)

    first = score_places(database, api_key="k", model="m", client=client)
    second = score_places(database, api_key="k", model="m", client=client)

    assert first.scored == 1
    # 두 번째 실행은 LLM 을 다시 부르지 않는다. (돈이 다시 나가면 안 된다)
    assert second.scored == 0
    assert second.skipped == 1
    assert len(calls) == 1


def test_manual_scores_are_not_overwritten(
    database: pymysql.Connection,
    insert: Callable[..., int],
    rows: Callable[..., list[dict]],
) -> None:
    place_id = add_place(insert, "경주 황리단길", "5003", "경주에서 가장 젊은 길.")
    with database.cursor() as cursor:
        cursor.execute(
            """INSERT INTO PLACE_PERSONA_SCORE (PLACE_IDX, PERSONA_KEY, SCORE, SOURCE)
               VALUES (%s, 'monk', 0, 'manual')""",
            (place_id,),
        )
    client = fake_openai({"scores": [scores_for(place_id, monk=5, merchant=5)]}, [])

    score_places(database, api_key="k", model="m", client=client)

    saved = {
        row["PERSONA_KEY"]: (row["SCORE"], row["SOURCE"])
        for row in rows("SELECT PERSONA_KEY, SCORE, SOURCE FROM PLACE_PERSONA_SCORE")
    }
    # 사람이 정한 점수는 그대로 두고, 나머지만 채점 결과로 채운다.
    assert saved["monk"] == (0, "manual")
    assert saved["merchant"] == (5, "llm")


def test_changed_description_is_scored_again(
    database: pymysql.Connection,
    insert: Callable[..., int],
) -> None:
    place_id = add_place(insert, "경주 계림", "5004", "옛 숲.")
    client = fake_openai({"scores": [scores_for(place_id, king=4)]}, [])
    score_places(database, api_key="k", model="m", client=client)

    with database.cursor() as cursor:
        cursor.execute("UPDATE PLACE SET TEXT = %s WHERE IDX = %s", ("설명이 바뀌었다.", place_id))
    again = score_places(database, api_key="k", model="m", client=client)

    assert again.scored == 1


def test_missing_api_key_is_reported(
    database: pymysql.Connection,
    insert: Callable[..., int],
) -> None:
    add_place(insert, "경주 오릉", "5005", "다섯 무덤.")

    result = score_places(database, api_key="", model="m")

    # 키가 없으면 저장하지 않고 실패로 남긴다. (엉뚱한 0점이 들어가면 안 된다)
    assert result.scored == 0
    assert result.failed == 1


def test_scores_outside_the_range_are_clamped() -> None:
    assert clamp(9) == 5
    assert clamp(-3) == 0
    assert clamp("없음") == 0


def test_unreadable_answer_is_reported() -> None:
    with pytest.raises(PersonaScoringError):
        parse_scores("이건 JSON 이 아니다")


def test_hash_changes_with_the_description() -> None:
    place = {"NAME": "가", "CATEGORY_SUB": "나", "MENU": None, "TEXT": "다"}
    assert text_hash(place) == text_hash(dict(place))
    assert text_hash(place) != text_hash({**place, "TEXT": "라"})
