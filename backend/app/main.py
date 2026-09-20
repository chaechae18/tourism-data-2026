from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import os

from fastapi import FastAPI, HTTPException, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from .content_guardrails import ContentRejectedError, ModerationUnavailableError, InvalidModerationImageError
from .config import get_settings
from .mysql import connect, initialize_database
from .routers.admin import router as admin_router
from .routers.auth import router as auth_router
from .routers.donggyeong import router as donggyeong_router
from .routers.home import router as home_router
from .routers.interactions import router as interactions_router
from .routers.journey import router as journey_router
from .routers.notifications import router as notifications_router
from .routers.places import router as places_router
from .routers.spots import router as spots_router
from .routers.translations import router as translations_router
from .routers.uploads import router as uploads_router
from .routers.users import router as users_router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if not os.getenv("VERCEL"):
        if os.getenv("DB_AUTO_MIGRATE", "true").lower() == "true":
            initialize_database()
        else:
            # 운영 DB 연결만 확인한다. 스키마 변경은 alembic 명령으로 따로 실행한다.
            with connect() as connection:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT 1")
    yield


app = FastAPI(
    title="Play Gyeongju API",
    version="0.1.0",
    lifespan=lifespan,
    # Vercel forwards the service prefix; local requests use the original paths.
    # root_path="/api/backend" if os.getenv("VERCEL") == "1" else "",
)
settings = get_settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret_key,
    session_cookie="session",
    max_age=60 * 60 * 24,
    same_site="lax",
    https_only=False,
)


def error_response(
    status_code: int,
    code: str,
    message: str,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}},
        headers=headers,
    )


@app.exception_handler(ContentRejectedError)
async def content_rejected_handler(_, __):
    return error_response(422, "CONTENT_REJECTED", "욕설이나 선정적인 내용은 게시할 수 없습니다. 내용을 수정해 주세요.")


@app.exception_handler(ModerationUnavailableError)
async def moderation_unavailable_handler(_, __):
    return error_response(503, "MODERATION_UNAVAILABLE", "검수를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.")


@app.exception_handler(InvalidModerationImageError)
async def invalid_moderation_image_handler(_, __):
    return error_response(422, "INVALID_MODERATION_IMAGE", "검수할 사진을 확인할 수 없습니다. 사진을 다시 업로드해 주세요.")


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    _,
    __: RequestValidationError,
) -> JSONResponse:
    return error_response(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "VALIDATION_ERROR",
        "요청 값을 확인해 주세요.",
    )


@app.exception_handler(HTTPException)
async def http_error_handler(_, error: HTTPException) -> JSONResponse:
    detail = error.detail
    if isinstance(detail, dict):
        return error_response(
            error.status_code,
            detail.get("code", "HTTP_ERROR"),
            detail.get("message", "요청을 처리할 수 없습니다."),
            error.headers,
        )
    return error_response(
        error.status_code,
        "HTTP_ERROR",
        str(detail),
        error.headers,
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(home_router)
app.include_router(donggyeong_router)
app.include_router(places_router)
app.include_router(journey_router)
app.include_router(spots_router)
app.include_router(interactions_router)
app.include_router(translations_router)
app.include_router(notifications_router)
app.include_router(admin_router)
app.include_router(uploads_router)
app.include_router(users_router)
app.include_router(auth_router)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
