from collections.abc import Iterator

import pymysql
import pytest

from app.main import app
from app.routers.translations import get_translate_text


@pytest.fixture
def translations(client) -> Iterator[tuple]:
    calls = []

    def fake_translate(fields: dict, language: str) -> tuple[dict, str]:
        calls.append((fields, language))
        return {field: f"[{language}] {value}" for field, value in fields.items()}, "test-model"

    app.dependency_overrides[get_translate_text] = lambda: fake_translate
    yield client, calls
    app.dependency_overrides.pop(get_translate_text)


def add_spot(insert, **overrides) -> int:
    return insert(
        "SPOTS",
        **{
            "USER_NO": 1,
            "MAP_PLACE_ID": "kakao-1",
            "PLACE_NAME": "첨성대",
            "LAT": 35.8347,
            "LNG": 129.2194,
            "MODERATION_STATUS": 1,
            **overrides,
        },
    )


def test_spot_translation_is_cached_and_refreshed_on_edit(
    translations, insert, database: pymysql.Connection, rows
) -> None:
    client, calls = translations
    spot_id = add_spot(insert, CAPTION="すばらしい眺め", LANGUAGE_CODE="ja")

    first = client.post(f"/api/v1/translations/spot/{spot_id}", headers={"X-User-No": "1"})
    assert first.status_code == 200
    assert first.json() == {
        "targetType": "spot",
        "targetId": spot_id,
        "language": "ko",
        "text": "[ko] すばらしい眺め",
        "placeName": "[ko] 첨성대",
    }
    # 이름과 본문을 한 번의 호출로 같이 번역하고 각각 캐시한다.
    assert calls == [({"text": "すばらしい眺め", "name": "첨성대"}, "ko")]
    assert {row["TARGET_TYPE"] for row in rows("SELECT * FROM SPOT_TRANSLATION_CACHE")} == {
        "spot", "spot_name",
    }

    client.post(f"/api/v1/translations/spot/{spot_id}", headers={"X-User-No": "1"})
    assert len(calls) == 1

    with database.cursor() as cursor:
        cursor.execute("UPDATE SPOTS SET CAPTION = %s WHERE IDX = %s", ("新しい眺め", spot_id))
    again = client.post(f"/api/v1/translations/spot/{spot_id}", headers={"X-User-No": "1"})
    assert again.json()["text"] == "[ko] 新しい眺め"
    # 이름은 그대로라 본문만 다시 번역한다.
    assert calls[1] == ({"text": "新しい眺め"}, "ko")


def test_comment_translation_follows_viewer_language(
    translations, insert, database: pymysql.Connection
) -> None:
    client, calls = translations
    spot_id = add_spot(insert, CAPTION="좋은 곳", LANGUAGE_CODE="ko")
    comment_id = insert(
        "SPOT_COMMENT",
        SPOT_IDX=spot_id,
        USER_NO=1,
        CONTENT="여기 정말 좋아요",
        LANGUAGE_CODE="ko",
        MODERATION_STATUS=1,
    )
    with database.cursor() as cursor:
        cursor.execute("UPDATE USERS SET LANGUAGE_CODE = 'en' WHERE NO = 1")

    response = client.post(
        f"/api/v1/translations/comment/{comment_id}", headers={"X-User-No": "1"}
    )
    assert response.status_code == 200
    assert response.json()["language"] == "en"
    # 댓글에는 장소 이름이 없다.
    assert response.json()["placeName"] is None
    assert calls == [({"text": "여기 정말 좋아요"}, "en")]


def test_same_language_target_is_rejected(translations, insert) -> None:
    client, calls = translations
    spot_id = add_spot(insert, CAPTION="여기 좋아요", LANGUAGE_CODE="ko")

    response = client.post(f"/api/v1/translations/spot/{spot_id}", headers={"X-User-No": "1"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "TRANSLATION_NOT_NEEDED"
    assert calls == []
