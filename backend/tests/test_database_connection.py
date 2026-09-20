import asyncio
import ssl
from unittest.mock import MagicMock

import pytest

from app import main, mysql


def test_tls_verifies_certificate_and_hostname(monkeypatch):
    monkeypatch.setenv("DB_SSL", "true")
    monkeypatch.delenv("DB_SSL_CA", raising=False)

    context = mysql.connection_settings()["ssl"]

    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.check_hostname is True


def test_local_database_can_disable_tls(monkeypatch):
    monkeypatch.setenv("DB_SSL", "false")

    assert "ssl" not in mysql.connection_settings()


def test_missing_ca_does_not_fall_back_to_unverified_connection(monkeypatch, tmp_path):
    monkeypatch.setenv("DB_SSL", "true")
    monkeypatch.setenv("DB_SSL_CA", str(tmp_path / "missing.pem"))

    with pytest.raises(FileNotFoundError):
        mysql.connection_settings()


def test_startup_checks_connection_without_migrating(monkeypatch):
    monkeypatch.setenv("DB_AUTO_MIGRATE", "false")
    connect = MagicMock()
    migrate = MagicMock()
    monkeypatch.setattr(main, "connect", connect)
    monkeypatch.setattr(main, "initialize_database", migrate)

    async def start():
        async with main.lifespan(main.app):
            pass

    asyncio.run(start())

    cursor = connect.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
    cursor.execute.assert_called_once_with("SELECT 1")
    migrate.assert_not_called()


def test_startup_connection_failure_is_not_reported_as_ready(monkeypatch):
    monkeypatch.setenv("DB_AUTO_MIGRATE", "false")
    monkeypatch.setattr(main, "connect", MagicMock(side_effect=ConnectionError("unreachable")))
    migrate = MagicMock()
    monkeypatch.setattr(main, "initialize_database", migrate)

    async def start():
        async with main.lifespan(main.app):
            pytest.fail("DB 연결 실패 시 서버가 시작되면 안 됩니다.")

    with pytest.raises(ConnectionError):
        asyncio.run(start())
    migrate.assert_not_called()
