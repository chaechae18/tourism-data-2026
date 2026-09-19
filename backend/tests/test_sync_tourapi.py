import pymysql

from sync_tourapi import database_needs_place_bootstrap


FIELDS = {
    "NAME": "첨성대",
    "TEXT": "설명",
    "ADDRESS": "경주시",
    "OPERATING_HOURS": "09:00~18:00",
    "REST_DATE": "연중무휴",
    "PARKING": "가능",
    "MENU": "대표 메뉴",
}


def test_empty_database_needs_automatic_bootstrap(database: pymysql.Connection) -> None:
    assert database_needs_place_bootstrap(database, ["en", "ja", "zh"]) == (
        True,
        "TourAPI PLACE가 비어 있음",
    )


def test_complete_database_skips_automatic_bootstrap(database, insert) -> None:
    place_idx = insert(
        "PLACE", SOURCE="TOUR_API", CONTENT_ID="place-1", TYPE="TOUR", **FIELDS,
    )
    insert("PLACE_I18N", PLACE_IDX=place_idx, LANGUAGE_CODE="ko", **FIELDS)
    for language in ("en", "ja", "zh"):
        insert("PLACE_I18N", PLACE_IDX=place_idx, LANGUAGE_CODE=language, **FIELDS)

    needed, reason = database_needs_place_bootstrap(database, ["en", "ja", "zh"])

    assert needed is False
    assert "이미 준비됨" in reason


def test_missing_translated_field_forces_automatic_bootstrap(database, insert) -> None:
    place_idx = insert(
        "PLACE", SOURCE="TOUR_API", CONTENT_ID="place-1", TYPE="TOUR", **FIELDS,
    )
    insert("PLACE_I18N", PLACE_IDX=place_idx, LANGUAGE_CODE="ko", **FIELDS)
    for language in ("en", "ja", "zh"):
        values = {**FIELDS}
        if language == "en":
            values["OPERATING_HOURS"] = None
        insert("PLACE_I18N", PLACE_IDX=place_idx, LANGUAGE_CODE=language, **values)

    needed, reason = database_needs_place_bootstrap(database, ["en", "ja", "zh"])

    assert needed is True
    assert reason == "en 장소/번역 1건 누락"


def test_import_runs_scoring_after_data(monkeypatch):
    import sync_tourapi as sync
    from unittest.mock import Mock

    events = []
    connection = Mock()
    monkeypatch.setattr(sync, "connect", lambda: connection)
    monkeypatch.setattr(sync, "TourApiClient", Mock())
    monkeypatch.setattr(sync, "report", Mock())
    monkeypatch.setattr(sync, "sync_places", lambda *a, **kw: events.append("places"))
    monkeypatch.setattr(sync, "sync_translations", lambda *a: events.append("translations"))
    monkeypatch.setattr(sync, "sync_festivals", lambda *a, **kw: events.append("festivals"))
    monkeypatch.setattr(sync, "sync_persona_scores", lambda *a: events.append("scores"))

    sync.run_once(sync.parse_arguments([]), "20260919")

    assert events == ["places", "translations", "festivals", "scores"]
    connection.close.assert_called_once()


def test_startup_scores_existing_database_before_waiting(monkeypatch):
    import sync_tourapi as sync
    import pytest
    from unittest.mock import Mock

    events = []
    monkeypatch.setattr(sync, "bootstrap_status", lambda _: (False, "ready"))
    monkeypatch.setattr(sync, "read_last_sync", lambda: sync.datetime.now())
    monkeypatch.setattr(sync, "sync_persona_scores", lambda _: events.append("scores"))
    run_once = Mock()
    monkeypatch.setattr(sync, "run_once", run_once)

    def stop_at_wait(seconds):
        events.append("wait")
        assert seconds > 0
        raise InterruptedError

    monkeypatch.setattr(sync.time, "sleep", stop_at_wait)
    with pytest.raises(InterruptedError):
        sync.run_forever(sync.parse_arguments([]))
    assert events == ["scores", "wait"]
    run_once.assert_not_called()


def test_partial_scoring_failure_is_retried_without_marking_success(monkeypatch):
    import sync_tourapi as sync
    import pytest
    from app.persona_scoring import ScoringResult
    from unittest.mock import Mock

    connection = Mock()
    monkeypatch.setattr(sync, "connect", lambda: connection)
    monkeypatch.setattr(sync, "get_settings", lambda: Mock(openai_api_key="test", openai_model="test"))
    scoring = Mock(return_value=ScoringResult(scored=1, failed=1))
    monkeypatch.setattr(sync, "score_places", scoring)
    monkeypatch.setattr(sync, "bootstrap_status", lambda _: (False, "ready"))
    monkeypatch.setattr(sync, "read_last_sync", lambda: None)
    write = Mock()
    monkeypatch.setattr(sync, "write_last_sync", write)

    def stop_at_retry(seconds):
        assert seconds == sync.RETRY_DELAY.total_seconds()
        raise InterruptedError

    monkeypatch.setattr(sync.time, "sleep", stop_at_retry)
    with pytest.raises(InterruptedError):
        sync.run_forever(sync.parse_arguments([]))
    scoring.assert_called_once()
    connection.close.assert_called_once()
    write.assert_not_called()


def test_festivals_only_does_not_score(monkeypatch):
    import sync_tourapi as sync
    from unittest.mock import Mock

    scoring = Mock()
    monkeypatch.setattr(sync, "score_places", scoring)
    sync.sync_persona_scores(sync.parse_arguments(["--target", "festivals"]))
    scoring.assert_not_called()
