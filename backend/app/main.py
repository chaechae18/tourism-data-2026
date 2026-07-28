from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .database import initialize_database
from .routers.places import router as places_router
from .routers.spots import router as spots_router
from .routers.uploads import router as uploads_router


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


def error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}},
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
        )
    return error_response(error.status_code, "HTTP_ERROR", str(detail))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

app.include_router(places_router)
app.include_router(spots_router)
app.include_router(uploads_router)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
