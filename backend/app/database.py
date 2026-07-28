from collections.abc import Iterator
from pathlib import Path
import sqlite3

from .config import BACKEND_DIR, get_settings


SCHEMA_PATH = BACKEND_DIR / "db" / "schema.sqlite.sql"


def connect(database_path: Path | None = None) -> sqlite3.Connection:
    path = database_path or get_settings().database_path
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database(database_path: Path | None = None) -> None:
    with connect(database_path) as connection:
        connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))


def get_database() -> Iterator[sqlite3.Connection]:
    connection = connect()
    try:
        yield connection
    finally:
        connection.close()
