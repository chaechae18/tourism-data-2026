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
    monkeypatch.setattr(sync, "read_last_sync", lambda: sync.datetime.now(sync.KST))
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


def test_daily_schedule_boundaries():
    from datetime import datetime
    import sync_tourapi as sync

    def at(day, hour, minute=0):
        return datetime(2026, 9, day, hour, minute, tzinfo=sync.KST)

    assert sync.next_sync_at(at(29, 6, 59), at(28, 7)) == at(29, 7)
    assert sync.next_sync_at(at(29, 7), at(28, 7)) == at(29, 7)
    assert sync.next_sync_at(at(29, 12), at(14, 22)) == at(29, 7)
    assert sync.next_sync_at(at(29, 12), at(29, 8)) == at(30, 7)
    assert sync.next_sync_at(at(29, 6), None) == at(29, 7)
    assert sync.next_sync_at(at(29, 12), None) == at(30, 7)


def test_legacy_success_timestamp_is_utc(monkeypatch, tmp_path):
    import sync_tourapi as sync

    path = tmp_path / "last_sync.txt"
    path.write_text("2026-09-29T00:30:00")
    monkeypatch.setenv("SYNC_STATE_PATH", str(path))
    last = sync.read_last_sync().astimezone(sync.KST)
    assert last.hour == 9
    assert last.minute == 30
    sync.write_last_sync(last)
    assert sync.read_last_sync() == last


def test_wait_rechecks_clock_after_resume(monkeypatch):
    from datetime import datetime, timedelta
    from unittest.mock import Mock
    import sync_tourapi as sync

    start = datetime(2026, 9, 29, 6, tzinfo=sync.KST)
    clock = Mock()
    clock.now.side_effect = [start, start + timedelta(hours=5)]
    monkeypatch.setattr(sync, "datetime", clock)
    sleep = Mock()
    monkeypatch.setattr(sync.time, "sleep", sleep)
    sync.wait_until(start + timedelta(hours=1))
    sleep.assert_called_once_with(60)


def test_failed_run_retries_without_waiting_for_next_morning(monkeypatch):
    from unittest.mock import Mock
    import pytest
    import sync_tourapi as sync

    monkeypatch.setattr(sync, "bootstrap_status", lambda _: (False, "ready"))
    monkeypatch.setattr(sync, "sync_persona_scores", Mock())
    monkeypatch.setattr(sync, "read_last_sync", lambda: None)
    wait = Mock()
    monkeypatch.setattr(sync, "wait_until", wait)
    sleep = Mock()
    monkeypatch.setattr(sync.time, "sleep", sleep)
    run = Mock(side_effect=[RuntimeError("temporary failure"), InterruptedError()])
    monkeypatch.setattr(sync, "run_once", run)
    write = Mock()
    monkeypatch.setattr(sync, "write_last_sync", write)
    with pytest.raises(InterruptedError):
        sync.run_forever(sync.parse_arguments([]))
    assert run.call_count == 2
    wait.assert_called_once()
    sleep.assert_called_once_with(3600)
    write.assert_not_called()
