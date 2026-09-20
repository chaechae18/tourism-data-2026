"""Red-team tests run only through the isolated Docker runner."""
import os
import socket
from dataclasses import replace

import pytest

from app.config import get_settings
from app.main import app


def pytest_configure(config):
    config.addinivalue_line("markers", "redteam(risk, expected): security scenario metadata")
    if os.environ.get("REDTEAM_ISOLATED") != "1" or os.environ.get("DB_HOST") != "127.0.0.1":
        raise pytest.UsageError("Run backend/scripts/redteam.py; do not target a shared database.")
    if os.environ.get("TEST_DB_NAME") != "play_gyeongju_redteam":
        raise pytest.UsageError("Red-team database must be play_gyeongju_redteam.")


@pytest.fixture(scope="session", autouse=True)
def local_network_only():
    """Allow only the runner's disposable MySQL port, including worker threads."""
    original = socket.socket.connect
    port = int(os.environ["DB_PORT"])

    def connect(sock, address):
        if not isinstance(address, tuple) or address[:2] != ("127.0.0.1", port):
            raise RuntimeError("Red-team network guard blocked a non-test connection")
        return original(sock, address)

    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(socket.socket, "connect", connect)
        yield


@pytest.fixture(autouse=True)
def isolated_settings(tmp_path, request, record_property):
    settings = replace(get_settings(), upload_dir=tmp_path / "uploads", admin_api_key="redteam-admin-only")
    previous = dict(app.dependency_overrides)
    app.dependency_overrides[get_settings] = lambda: settings
    marker = request.node.get_closest_marker("redteam")
    if marker:
        record_property("risk", marker.args[0])
        record_property("expected", marker.args[1])
    try:
        yield
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
