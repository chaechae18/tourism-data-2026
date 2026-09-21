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
     # 세션
    session_secret_key: str
    # 도슨트 음성(구글 TTS). 키가 없으면 도슨트 재생만 막히고 나머지는 그대로 돈다.
    google_tts_api_key: str = ""
    tts_voice: str = "ko-KR-Neural2-A"
    tts_speaking_rate: float = 0.95
    # 만든 음성은 파일로 남기지 않고 메모리에만 잠깐 들고 있는다.
    tts_cache_entries: int = 32
    tts_cache_ttl_seconds: int = 86400
    # 장소 채점·번역·게시글 및 댓글 검수에 사용하는 서버 전용 OpenAI 설정.
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    # 소셜 로그인이 끝난 뒤 돌려보낼 프론트 주소. CORS_ORIGINS 는 목록이라 그대로 쓸 수 없다.
    frontend_url: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    # Vercel's application directory is read-only; /tmp is ephemeral storage.
    default_upload_dir = "/tmp/uploads" if os.getenv("VERCEL") == "1" else "./uploads"
    configured_upload_dir = Path(
        os.getenv("UPLOAD_DIR", default_upload_dir)
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
    session_secret_key = os.getenv("SESSION_SECRET_KEY", "").strip()
    if not session_secret_key:
        raise ValueError("SESSION_SECRET_KEY 가 비어 있습니다.")
    return Settings(
        kakao_rest_api_key=os.getenv("KAKAO_REST_API_KEY", "").strip(),
        # 검색 API 와 로그인 OAuth 는 발급처가 달라 자격증명이 다르다.
        # NAVER_CLIENT_ID 는 auth.py 가 OAuth 용으로 쓰므로 검색은 전용 이름을 먼저 본다.
        naver_client_id=(
            os.getenv("NAVER_SEARCH_CLIENT_ID") or os.getenv("NAVER_CLIENT_ID", "")
        ).strip(),
        naver_client_secret=(
            os.getenv("NAVER_SEARCH_CLIENT_SECRET") or os.getenv("NAVER_CLIENT_SECRET", "")
        ).strip(),
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
        session_secret_key=session_secret_key,
        google_tts_api_key=os.getenv("GOOGLE_TTS_API_KEY", "").strip(),
        tts_voice=os.getenv("TTS_VOICE", "ko-KR-Neural2-A").strip(),
        tts_speaking_rate=float(os.getenv("TTS_SPEAKING_RATE", "0.95")),
        tts_cache_entries=int(os.getenv("TTS_CACHE_ENTRIES", "32")),
        tts_cache_ttl_seconds=int(os.getenv("TTS_CACHE_TTL_SECONDS", "86400")),
        openai_api_key=os.getenv("OPENAI_API_KEY", "").strip(),
        openai_model=os.getenv("OPENAI_MODEL", "").strip() or "gpt-4o-mini",
        frontend_url=(os.getenv("FRONTEND_URL", "").strip() or cors_origins[0]).rstrip("/"),
    )
