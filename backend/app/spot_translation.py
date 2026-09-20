from collections.abc import Callable
from hashlib import sha256
import json

import httpx
import pymysql

from .config import get_settings
from .models.translations import TranslationResponse, TranslationTarget
from .models.users import LanguageCode


OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
LANGUAGE_NAMES = {
    "ko": "Korean",
    "en": "English",
    "ja": "Japanese",
    "zh": "Simplified Chinese",
}
SOURCE_COLUMNS = {
    TranslationTarget.SPOT: ("SPOTS", {"text": "CAPTION", "name": "PLACE_NAME"}),
    TranslationTarget.COMMENT: ("SPOT_COMMENT", {"text": "CONTENT"}),
}
# 작성 언어를 남기기 전에 올라온 글은 전부 한국어다.
DEFAULT_SOURCE_LANGUAGE = "ko"


class TranslationTargetNotFoundError(LookupError):
    pass


class TranslationNotNeededError(ValueError):
    pass


class TranslationFailedError(RuntimeError):
    pass


def source_hash(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def cache_type(target_type: TranslationTarget, field: str) -> str:
    return target_type.value if field == "text" else f"{target_type.value}_{field}"


def _echoed_source(results: dict, pending: dict) -> bool:
    source = pending.get("text")
    return source is not None and (results.get("text") or "").strip() == source.strip()


def translate_target(
    connection: pymysql.Connection,
    *,
    target_type: TranslationTarget,
    target_id: int,
    language: LanguageCode,
    translate_text: Callable[[dict, str], tuple[dict, str]],
) -> TranslationResponse:
    table, columns = SOURCE_COLUMNS[target_type]
    selected = ", ".join(f"{column} AS {field.upper()}" for field, column in columns.items())
    with connection.cursor() as cursor:
        cursor.execute(
            f"SELECT {selected}, LANGUAGE_CODE FROM {table} "
            "WHERE IDX = %s AND MODERATION_STATUS = 1 AND DELETED_AT IS NULL",
            (target_id,),
        )
        row = cursor.fetchone()
    if row is None or not row["TEXT"]:
        raise TranslationTargetNotFoundError
    if (row["LANGUAGE_CODE"] or DEFAULT_SOURCE_LANGUAGE) == language:
        raise TranslationNotNeededError

    sources = {field: row[field.upper()] for field in columns if row[field.upper()]}
    translated, pending = {}, {}
    for field, source in sources.items():
        cached = _cached_translation(
            connection, target_type, target_id, language, field, source_hash(source)
        )
        if cached is None:
            pending[field] = source
        else:
            translated[field] = cached

    if pending:
        # 이름과 본문을 한 번의 호출로 같이 번역한다.
        results, model = translate_text(pending, language)
        # 모델이 원문을 그대로 돌려주는 입력이 있다. 한 번만 다시 부른다.
        if _echoed_source(results, pending):
            results, model = translate_text(pending, language)
        for field, source in pending.items():
            value = (results.get(field) or "").strip()
            if not value:
                raise TranslationFailedError(f"{field} 번역 결과가 비어 있습니다.")
            # 본문이 원문 그대로면 번역이 안 된 것이다.
            # 장소 이름은 한자가 겹쳐 원문과 같을 수 있어 검사하지 않는다 (瞻星台 → 瞻星台).
            if field == "text" and value == source.strip():
                raise TranslationFailedError("본문이 원문 그대로 돌아왔습니다.")
            _save_translation(
                connection, target_type, target_id, language, field,
                source_hash(source), value, model,
            )
            translated[field] = value

    return TranslationResponse.model_validate(
        {
            "targetType": target_type,
            "targetId": target_id,
            "language": language,
            "text": translated["text"],
            "placeName": translated.get("name"),
        }
    )


def _cached_translation(
    connection: pymysql.Connection,
    target_type: TranslationTarget,
    target_id: int,
    language: str,
    field: str,
    digest: str,
) -> str | None:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT TRANSLATION FROM SPOT_TRANSLATION_CACHE "
            "WHERE TARGET_TYPE = %s AND TARGET_ID = %s AND LANGUAGE_CODE = %s "
            "AND SOURCE_HASH = %s",
            (cache_type(target_type, field), target_id, language, digest),
        )
        row = cursor.fetchone()
    return row["TRANSLATION"] if row else None


def _save_translation(
    connection: pymysql.Connection,
    target_type: TranslationTarget,
    target_id: int,
    language: str,
    field: str,
    digest: str,
    translation: str,
    model: str,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            "INSERT INTO SPOT_TRANSLATION_CACHE "
            "(TARGET_TYPE, TARGET_ID, LANGUAGE_CODE, SOURCE_HASH, TRANSLATION, MODEL) "
            "VALUES (%s, %s, %s, %s, %s, %s) ON DUPLICATE KEY UPDATE "
            "SOURCE_HASH = VALUES(SOURCE_HASH), TRANSLATION = VALUES(TRANSLATION), "
            "MODEL = VALUES(MODEL), TRANSLATED_AT = CURRENT_TIMESTAMP",
            (cache_type(target_type, field), target_id, language, digest, translation, model),
        )


def openai_translate(fields: dict, language: str) -> tuple[dict, str]:
    settings = get_settings()
    if not settings.openai_api_key:
        raise TranslationFailedError("OPENAI_API_KEY 가 없습니다.")
    system = (
        f"Translate each field into {LANGUAGE_NAMES[language]}. "
        "'name' is a place in Gyeongju, Korea: use the name commonly used in the target "
        "language, transliterating when no established name exists. "
        "'text' is a traveler's short caption or comment about that place: keep the casual "
        "tone, emoji and line breaks. Preserve numbers and prices. "
        "Do not add, explain or summarize anything. "
        "Return only JSON with exactly the input keys. "
        f"Every value you return must be written in {LANGUAGE_NAMES[language]}. "
        "Never copy the source text unchanged."
    )
    body = {
        "model": settings.openai_model,
        # 같은 글은 늘 같은 번역이 나오도록 무작위성을 없앤다.
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(fields, ensure_ascii=False)},
        ],
    }
    try:
        with httpx.Client(timeout=30.0) as http:
            response = http.post(
                OPENAI_CHAT_URL,
                json=body,
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        results = json.loads(content)
    except httpx.HTTPStatusError as error:
        raise TranslationFailedError(
            f"OpenAI 응답 {error.response.status_code}"
        ) from error
    except httpx.HTTPError as error:
        raise TranslationFailedError(f"OpenAI 연결 실패: {error}") from error
    except (KeyError, TypeError, ValueError) as error:
        raise TranslationFailedError(f"번역 결과를 읽지 못했습니다: {error}") from error
    if not isinstance(results, dict):
        raise TranslationFailedError("번역 결과를 읽지 못했습니다.")
    return {
        field: value for field, value in results.items() if isinstance(value, str)
    }, settings.openai_model


