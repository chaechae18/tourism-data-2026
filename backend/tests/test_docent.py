from collections.abc import Callable, Iterator

from fastapi.testclient import TestClient
import pytest

from app.main import app
from app.routers.journey import docent_audio_cache, get_tts_client
from app.tts import TtsNotConfiguredError, TtsUpstreamError, split_for_request


SCRIPT = "동궁과 월지는 신라 왕궁의 별궁 터다. 연못에 비친 전각이 밤에 특히 아름답다."


class FakeTts:
    """구글을 부르지 않고 음성을 만든 척한다."""

    def __init__(self, error: Exception | None = None) -> None:
        self.calls: list[str] = []
        self.error = error

    async def synthesize(self, text: str) -> bytes:
        if self.error:
            raise self.error
        self.calls.append(text)
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
