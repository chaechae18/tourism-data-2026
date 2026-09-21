from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
import pymysql

from ..home import resolve_language
from ..models.translations import TranslationResponse, TranslationTarget
from ..mysql import get_mysql
from ..spot_translation import (
    TranslationFailedError,
    TranslationNotNeededError,
    TranslationTargetNotFoundError,
    openai_translate,
    translate_target,
)


router = APIRouter(prefix="/api/v1/translations", tags=["translations"])

LanguageQuery = Annotated[str | None, Query(alias="lang", max_length=20)]
AcceptLanguage = Annotated[str | None, Header(alias="Accept-Language")]


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
    lang: LanguageQuery = None,
    accept_language: AcceptLanguage = None,
    database: pymysql.Connection = Depends(get_mysql),
    translate_text: Callable[[dict, str], tuple[dict, str]] = Depends(get_translate_text),
) -> TranslationResponse:
    try:
        return translate_target(
            database,
            target_type=target_type,
            target_id=target_id,
            language=resolve_language(lang, accept_language),
            translate_text=translate_text,
        )
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
