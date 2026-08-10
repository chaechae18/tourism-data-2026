from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from starlette.middleware.sessions import SessionMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .mysql import initialize_database
from .routers.admin import router as admin_router
from .routers.donggyeong import router as donggyeong_router
from .routers.home import router as home_router
from .routers.interactions import router as interactions_router
from .routers.notifications import router as notifications_router
from .routers.places import router as places_router
from .routers.spots import router as spots_router
from .routers.uploads import router as uploads_router
from .routers.auth import router as auth_router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    initialize_database()
    yield


app = FastAPI(
    title="Play Gyeongju API",
    version="0.1.0",
    lifespan=lifespan,
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

# ---------------------------------------------------------
# Session
# ---------------------------------------------------------
app.add_middleware(
    SessionMiddleware,
    secret_key="dev-session-secret-key-change-this",
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
app.include_router(spots_router)
app.include_router(interactions_router)
app.include_router(notifications_router)
app.include_router(admin_router)
app.include_router(uploads_router)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
app.include_router(auth_router)