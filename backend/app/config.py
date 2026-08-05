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
    naver_client_id: str
    naver_client_secret: str
    upload_dir: Path
    max_upload_bytes: int
    search_cache_ttl_seconds: int
    search_rate_limit: int
    search_rate_window_seconds: int
    admin_api_key: str
    cors_origins: tuple[str, ...]


@lru_cache
def get_settings() -> Settings:
    configured_upload_dir = Path(
        os.getenv("UPLOAD_DIR", "./uploads")
    ).expanduser()
    upload_dir = (
        configured_upload_dir
        if configured_upload_dir.is_absolute()
        else (BACKEND_DIR / configured_upload_dir).resolve()
    )
    cors_origins = tuple(
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    )
    return Settings(
        kakao_rest_api_key=os.getenv("KAKAO_REST_API_KEY", "").strip(),
        naver_client_id=os.getenv("NAVER_CLIENT_ID", "").strip(),
        naver_client_secret=os.getenv("NAVER_CLIENT_SECRET", "").strip(),
        upload_dir=upload_dir,
        max_upload_bytes=int(os.getenv("MAX_UPLOAD_BYTES", "10485760")),
        search_cache_ttl_seconds=int(
            os.getenv("SEARCH_CACHE_TTL_SECONDS", "300")
        ),
        search_rate_limit=int(os.getenv("SEARCH_RATE_LIMIT", "30")),
        search_rate_window_seconds=int(
            os.getenv("SEARCH_RATE_WINDOW_SECONDS", "60")
        ),
        admin_api_key=os.getenv("ADMIN_API_KEY", "").strip(),
        cors_origins=cors_origins,
    )
