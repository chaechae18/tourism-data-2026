from collections.abc import Callable, Iterator

from fastapi.testclient import TestClient
import pymysql
import pytest

from app.main import app
from app.routers.journey import docent_audio_cache, get_tts_client
from app.tts import TtsNotConfiguredError, TtsUpstreamError, split_for_request


SCRIPT = "동궁과 월지는 신라 왕궁의 별궁 터다. 연못에 비친 전각이 밤에 특히 아름답다."


class FakeTts:
    """구글을 부르지 않고 음성을 만든 척한다."""

    def __init__(self, error: Exception | None = None) -> None:
        self.calls: list[str] = []
        # 어떤 언어 목소리로 읽으라고 했는지
        self.languages: list[str | None] = []
        self.error = error

    async def synthesize(self, text: str, language: str | None = None) -> bytes:
        if self.error:
            raise self.error
        self.calls.append(text)
        self.languages.append(language)
        return b"fake-mp3-bytes"


@pytest.fixture(autouse=True)
def clear_audio_cache() -> Iterator[None]:
    # 메모리 캐시가 테스트끼리 이어지지 않게 비운다.
    docent_audio_cache.clear()
    yield
    docent_audio_cache.clear()


@pytest.fixture
def tts() -> Iterator[FakeTts]:
    fake = FakeTts()
    app.dependency_overrides[get_tts_client] = lambda: fake
    try:
        yield fake
    finally:
        app.dependency_overrides.pop(get_tts_client)


def add_place(insert: Callable[..., int], text: str | None = SCRIPT) -> int:
    return insert(
        "PLACE",
        SOURCE="TOUR_API",
        CONTENT_ID="9001",
        TYPE="TOUR",
        NAME="경주 동궁과 월지",
        TEXT=text,
        LATITUDE="35.8352",
        LONGITUDE="129.2284",
    )


def test_docent_script_comes_from_the_place_text(
    client: TestClient,
    insert: Callable[..., int],
) -> None:
    place_id = add_place(insert)

    response = client.get(f"/api/v1/journey/docent/{place_id}")

    assert response.status_code == 200
    assert response.json() == {
        "placeId": place_id,
        "name": "경주 동궁과 월지",
        "text": SCRIPT,
        "source": "한국관광공사",
    }


def test_place_without_a_description_has_no_docent(
    client: TestClient,
    insert: Callable[..., int],
) -> None:
    place_id = add_place(insert, text=None)

    response = client.get(f"/api/v1/journey/docent/{place_id}")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "DOCENT_NOT_FOUND"


def test_docent_audio_is_returned_as_mp3_and_synthesized_once(
    client: TestClient,
    insert: Callable[..., int],
    tts: FakeTts,
) -> None:
    place_id = add_place(insert)

    first = client.get(f"/api/v1/journey/docent/{place_id}/audio")
    second = client.get(f"/api/v1/journey/docent/{place_id}/audio")

    assert first.status_code == 200
    assert first.headers["content-type"] == "audio/mpeg"
    assert first.content == b"fake-mp3-bytes"
    assert "max-age" in first.headers["cache-control"]
    # 두 번째 요청은 메모리 캐시에서 나가므로 구글을 다시 부르지 않는다.
    assert second.content == first.content
    assert tts.calls == [SCRIPT]


def test_docent_audio_reports_a_missing_tts_key(
    client: TestClient,
    insert: Callable[..., int],
) -> None:
    place_id = add_place(insert)
    app.dependency_overrides[get_tts_client] = lambda: FakeTts(TtsNotConfiguredError())

    try:
        response = client.get(f"/api/v1/journey/docent/{place_id}/audio")
    finally:
        app.dependency_overrides.pop(get_tts_client)

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "TTS_NOT_CONFIGURED"


def test_docent_audio_reports_an_upstream_failure(
    client: TestClient,
    insert: Callable[..., int],
) -> None:
    place_id = add_place(insert)
    app.dependency_overrides[get_tts_client] = lambda: FakeTts(TtsUpstreamError(500))

    try:
        response = client.get(f"/api/v1/journey/docent/{place_id}/audio")
    finally:
        app.dependency_overrides.pop(get_tts_client)

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "TTS_UPSTREAM_ERROR"


def test_long_scripts_are_split_into_requests_within_the_google_limit() -> None:
    long_text = " ".join(f"신라의 이야기 {index}번째 문장이다." for index in range(400))

    chunks = split_for_request(long_text)

    assert len(chunks) > 1
    assert all(len(chunk.encode("utf-8")) <= 4000 for chunk in chunks)
    # 잘라도 문장이 사라지지 않는다.
    assert "".join(chunks).replace(" ", "") == long_text.replace(" ", "")


ENGLISH_SCRIPT = "Donggung Palace was a secondary palace of the Silla royal court."


def add_translation(
    database: pymysql.Connection,
    place_id: int,
    language: str,
    text: str | None = ENGLISH_SCRIPT,
) -> None:
    with database.cursor() as cursor:
        cursor.execute(
            """INSERT INTO PLACE_I18N (PLACE_IDX, LANGUAGE_CODE, NAME, TEXT)
               VALUES (%s, %s, 'Donggungggwa Wolji', %s)""",
            (place_id, language, text),
        )


def test_docent_script_follows_the_requested_language(
    client: TestClient,
    database: pymysql.Connection,
    insert: Callable[..., int],
) -> None:
    place_id = add_place(insert)
    add_translation(database, place_id, "en")

    response = client.get(f"/api/v1/journey/docent/{place_id}?lang=en")

    assert response.status_code == 200
    assert response.json()["text"] == ENGLISH_SCRIPT


def test_docent_script_falls_back_to_korean(
    client: TestClient,
    insert: Callable[..., int],
) -> None:
    place_id = add_place(insert)

    # 일본어 원고가 없으니 빈칸 대신 한국어를 읽어 준다.
    response = client.get(f"/api/v1/journey/docent/{place_id}?lang=ja")

    assert response.status_code == 200
    assert response.json()["text"] == SCRIPT


def test_docent_audio_is_read_by_the_voice_of_the_script(
    client: TestClient,
    database: pymysql.Connection,
    insert: Callable[..., int],
    tts: FakeTts,
) -> None:
    place_id = add_place(insert)
    add_translation(database, place_id, "en")

    client.get(f"/api/v1/journey/docent/{place_id}/audio?lang=en")

    assert tts.calls == [ENGLISH_SCRIPT]
    assert tts.languages == ["en"]


def test_docent_audio_uses_a_korean_voice_when_it_falls_back(
    client: TestClient,
    insert: Callable[..., int],
    tts: FakeTts,
) -> None:
    place_id = add_place(insert)

    # 영어 원고가 없어 한국어로 내려갔다. 영어 목소리로 읽히면 발음이 무너진다.
    client.get(f"/api/v1/journey/docent/{place_id}/audio?lang=en")

    assert tts.calls == [SCRIPT]
    assert tts.languages == ["ko"]


def test_each_language_gets_its_own_cached_audio(
    client: TestClient,
    database: pymysql.Connection,
    insert: Callable[..., int],
    tts: FakeTts,
) -> None:
    place_id = add_place(insert)
    add_translation(database, place_id, "en")

    client.get(f"/api/v1/journey/docent/{place_id}/audio?lang=ko")
    client.get(f"/api/v1/journey/docent/{place_id}/audio?lang=en")
    client.get(f"/api/v1/journey/docent/{place_id}/audio?lang=en")

    # 언어마다 따로 캐시되고, 같은 언어를 다시 부르면 만들지 않는다.
    assert tts.calls == [SCRIPT, ENGLISH_SCRIPT]
