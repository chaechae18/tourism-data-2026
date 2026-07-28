from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    kakao_rest_api_key: str
    database_path: Path
    cors_origins: tuple[str, ...]


@lru_cache
def get_settings() -> Settings:
    configured_path = Path(
        os.getenv("DATABASE_PATH", "./data/play_gyeongju.db")
    ).expanduser()
    database_path = (
        configured_path
        if configured_path.is_absolute()
        else (BACKEND_DIR / configured_path).resolve()
    )
    cors_origins = tuple(
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    )
    return Settings(
        kakao_rest_api_key=os.getenv("KAKAO_REST_API_KEY", "").strip(),
        database_path=database_path,
        cors_origins=cors_origins,
    )
