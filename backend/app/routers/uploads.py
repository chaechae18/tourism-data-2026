from io import BytesIO
from pathlib import Path
from typing import Annotated
from uuid import uuid4
import pymysql

from fastapi import (
    APIRouter,
    Depends,
    File,
    Header,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from PIL import Image, UnidentifiedImageError

from ..config import Settings, get_settings
from ..mysql import get_mysql
from ..models.uploads import ImageUploadResponse


router = APIRouter(prefix="/api/v1/uploads", tags=["uploads"])

ALLOWED_FORMATS = {
    "JPEG": ("jpg", "image/jpeg"),
    "PNG": ("png", "image/png"),
    "WEBP": ("webp", "image/webp"),
}


def validate_active_user(
    database: pymysql.Connection,
    user_no: int,
) -> None:
    with database.cursor() as cursor:
        cursor.execute(
            "SELECT NO FROM USERS WHERE NO = %s AND STATUS = 1 AND DELETED_AT IS NULL",
            (user_no,),
        )
        user = cursor.fetchone()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "USER_NOT_FOUND",
                "message": "사용자를 찾을 수 없습니다.",
            },
        )


def detect_image(content: bytes) -> tuple[str, str]:
    try:
        with Image.open(BytesIO(content)) as image:
            image.verify()
            image_format = image.format
    except (
        UnidentifiedImageError,
        OSError,
        SyntaxError,
        Image.DecompressionBombError,
    ) as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "INVALID_IMAGE",
                "message": "올바른 이미지 파일이 아닙니다.",
            },
        ) from error

    if image_format not in ALLOWED_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "code": "UNSUPPORTED_IMAGE_TYPE",
                "message": "JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.",
            },
        )
    return ALLOWED_FORMATS[image_format]


@router.post(
    "/images",
    response_model=ImageUploadResponse,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
async def upload_image(
    request: Request,
    file: Annotated[UploadFile, File()],
    user_no: Annotated[int, Header(alias="X-User-No", ge=1)],
    database: pymysql.Connection = Depends(get_mysql),
    settings: Settings = Depends(get_settings),
) -> ImageUploadResponse:
    validate_active_user(database, user_no)

    content = await file.read(settings.max_upload_bytes + 1)
    await file.close()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "code": "IMAGE_TOO_LARGE",
                "message": "이미지는 10MB 이하만 업로드할 수 있습니다.",
            },
        )

    extension, content_type = detect_image(content)
    filename = f"{uuid4().hex}.{extension}"
    destination = Path(settings.upload_dir) / filename
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)

    return ImageUploadResponse(
        url=str(request.url_for("uploads", path=filename)),
        filename=filename,
        contentType=content_type,
        size=len(content),
    )
