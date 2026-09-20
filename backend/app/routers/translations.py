from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
import pymysql

from ..models.translations import TranslationResponse, TranslationTarget
from ..mysql import get_mysql
from ..spot_translation import (
    TranslationFailedError,
    TranslationNotNeededError,
    TranslationTargetNotFoundError,
    openai_translate,
    translate_target,
)
from ..users import UserNotFoundError, get_user_preferences


router = APIRouter(prefix="/api/v1/translations", tags=["translations"])


def get_translate_text() -> Callable[[dict, str], tuple[dict, str]]:
    return openai_translate


@router.post(
    "/{target_type}/{target_id}",
    response_model=TranslationResponse,
    response_model_by_alias=True,
)
def translate(
    target_type: TranslationTarget,
    target_id: int,
    user_no: Annotated[int, Header(alias="X-User-No", ge=1)],
    database: pymysql.Connection = Depends(get_mysql),
    translate_text: Callable[[dict, str], tuple[dict, str]] = Depends(get_translate_text),
) -> TranslationResponse:
    try:
        preferences = get_user_preferences(database, user_no=user_no)
        return translate_target(
            database,
            target_type=target_type,
            target_id=target_id,
            language=preferences.language,
            translate_text=translate_text,
        )
    except UserNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "USER_NOT_FOUND",
                "message": "사용자를 찾을 수 없습니다.",
            },
        ) from error
    except TranslationTargetNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "TRANSLATION_TARGET_NOT_FOUND",
                "message": "번역할 글을 찾을 수 없습니다.",
            },
        ) from error
    except TranslationNotNeededError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "TRANSLATION_NOT_NEEDED",
                "message": "이미 같은 언어로 쓰인 글입니다.",
            },
        ) from error
    except TranslationFailedError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "TRANSLATION_FAILED",
                "message": "번역하지 못했습니다. 잠시 후 다시 시도해 주세요.",
            },
        ) from error
