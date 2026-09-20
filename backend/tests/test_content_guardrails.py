from dataclasses import replace
import json

import httpx
import pytest

from app import content_guardrails as guardrails
from app.config import get_settings


@pytest.fixture
def settings(monkeypatch, tmp_path):
    settings = replace(get_settings(), openai_api_key="test-key", upload_dir=tmp_path)
    monkeypatch.setattr(guardrails, "get_settings", lambda: settings)
    return settings


@pytest.fixture
def api(monkeypatch, settings):
    calls = []
    responses = [
        {"id": "modr-test", "results": [{"categories": {key: False for key in guardrails.BLOCKED_CATEGORIES}}]},
        {"choices": [{"message": {"content": '{"profanity":false}'}}]},
    ]
    def handle(request):
        calls.append(json.loads(request.content))
        value = responses[len(calls) - 1]
        if isinstance(value, Exception):
            raise value
        if isinstance(value, int):
            return httpx.Response(value, json={"error": "test failure"})
        return httpx.Response(200, json=value)
    real_client = httpx.Client
    monkeypatch.setattr(guardrails.httpx, "Client", lambda **kwargs: real_client(transport=httpx.MockTransport(handle), **kwargs))
    return calls, responses


def test_allowed_text_and_blob_photo_are_checked_together(api):
    calls, _ = api
    photo = "https://test.public.blob.vercel-storage.com/spots/travel.png"
    approval = guardrails.check_content("경주 야경이 좋아요", photo)
    assert approval.moderation_id == "modr-test"
    assert calls[0]["model"] == "omni-moderation-latest"
    assert calls[0]["input"] == [{"type": "text", "text": "경주 야경이 좋아요"}, {"type": "image_url", "image_url": {"url": photo}}]
    assert calls[1]["messages"][1]["content"] == "경주 야경이 좋아요"
    assert calls[1]["response_format"]["json_schema"]["strict"] is True


def test_local_upload_is_sent_as_image_bytes(api, settings):
    calls, _ = api
    name = "a" * 32 + ".png"
    (settings.upload_dir / name).write_bytes(b"image bytes")
    guardrails.check_content("여행 사진", "http://localhost:8001/uploads/" + name)
    assert calls[0]["input"][1]["image_url"]["url"] == "data:image/png;base64,aW1hZ2UgYnl0ZXM="


@pytest.mark.parametrize("category", guardrails.BLOCKED_CATEGORIES)
def test_flagged_content_is_rejected_before_publication(api, category):
    calls, responses = api
    responses[0]["results"][0]["categories"][category] = True
    with pytest.raises(guardrails.ContentRejectedError):
        guardrails.check_content("blocked input")
    assert len(calls) == 1


def test_profanity_is_rejected_even_if_moderation_allows_it(api):
    _, responses = api
    responses[1]["choices"][0]["message"]["content"] = '{"profanity":true}'
    with pytest.raises(guardrails.ContentRejectedError):
        guardrails.check_content("욕설 변형")


def test_historical_violence_alone_does_not_block_travel_review(api):
    _, responses = api
    responses[0]["results"][0]["categories"]["violence"] = True
    assert guardrails.check_content("전쟁의 역사를 배웠어요").moderation_id == "modr-test"


@pytest.mark.parametrize("stage,value", [
    (0, 429), (0, 500), (0, httpx.ReadTimeout("timeout")), (0, {}),
    (0, {"id": "test", "results": [{"categories": {}}]}),
    (0, {"id": "test", "results": [{"categories": None}]}),
    (1, 401), (1, {"choices": [{"message": {"content": "not json"}}]}),
    (1, {"choices": [{"message": {"content": '{"profanity":"false"}'}}]}),
])
def test_failed_or_invalid_verdict_never_approves(api, stage, value):
    _, responses = api
    responses[stage] = value
    with pytest.raises(guardrails.ModerationUnavailableError):
        guardrails.check_content("정상 후기")


def test_missing_key_does_not_approve(monkeypatch, settings):
    monkeypatch.setattr(guardrails, "get_settings", lambda: replace(settings, openai_api_key=""))
    with pytest.raises(guardrails.ModerationUnavailableError):
        guardrails.check_content("정상 후기")


@pytest.mark.parametrize("url", [
    "http://169.254.169.254/latest/meta-data", "file:///etc/passwd", "/uploads/../../.env",
    "https://example.com/photo.png", "https://test.public.blob.vercel-storage.com.evil.test/spots/a.png",
    "http://localhost:8001/uploads/" + "b" * 32 + ".png",
])
def test_untrusted_or_missing_image_is_not_silently_skipped(api, url):
    calls, _ = api
    with pytest.raises(guardrails.InvalidModerationImageError):
        guardrails.check_content("사진 후기", url)
    assert calls == []
