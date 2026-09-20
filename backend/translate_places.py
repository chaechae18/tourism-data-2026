"""Fill foreign TourAPI gaps through OpenAI and cache results in MySQL."""

import argparse
import json
import os
import re
import time

import httpx

from app.mysql import connect
from app.place_translation_cache import (
    FIELDS, LANGUAGES, cached_fields, is_partially_translated, record_rejected_translation,
    save_machine_translation, source_hash, source_rows,
)

API_URL = "https://api.openai.com/v1/chat/completions"
LANGUAGE_NAMES = {"en": "English", "ja": "Japanese", "zh": "Simplified Chinese"}
MAX_BATCH_PLACES = 10
MAX_BATCH_CHARACTERS = 8_000


def translated_rows(connection, language):
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT p.IDX, " + ", ".join(f"t.{field}" for field in FIELDS)
            + " FROM PLACE p LEFT JOIN PLACE_I18N t ON t.PLACE_IDX = p.IDX "
            "AND t.LANGUAGE_CODE = %s WHERE p.SOURCE = 'TOUR_API'", (language,),
        )
        return {row["IDX"]: row for row in cursor.fetchall()}


def pending_places(connection, language):
    cache = cached_fields(connection, language)
    translated = translated_rows(connection, language)
    pending = []
    for source in source_rows(connection):
        place_idx = source["IDX"]
        current = translated.get(place_idx) or {}
        missing = {}
        for field in FIELDS:
            value = source[field]
            if not value:
                continue
            cached = cache.get((place_idx, field))
            if cached and cached["SOURCE_HASH"] == source_hash(str(value)):
                continue
            # 캐시 이력이 없는 기존 값은 공식 TourAPI 값이므로 GPT가 덮어쓰지 않는다.
            # 다만 "慶州 배동 石造如来三尊立像" 처럼 한글이 남은 값은 번역이 덜 끝난 것이라 다시 받는다.
            if not cached and current.get(field) and not is_partially_translated(current[field]):
                continue
            missing[field] = str(value)
        if missing:
            pending.append({
                "id": str(source["CONTENT_ID"]), "place_idx": place_idx, "fields": missing,
            })
    return pending


def translate_batch(client, api_key, model, language, places):
    system = (
        f"Translate each Korean field into {LANGUAGE_NAMES[language]} for a tourism map. "
        "Return a JSON object with a 'places' array. Each item must contain the input 'id' "
        "and a 'fields' object with exactly the input keys. Translate faithfully. Preserve "
        "numbers, clock times, prices, URLs, HTML structure, and uncertainty. "
        # 'proper nouns' 를 보존하라고 하면 지명을 한글 그대로 남긴다 (경주 배동 → 慶州 배동).
        f"Render every Korean word in {LANGUAGE_NAMES[language]}: use the established name "
        "where one exists and transliterate otherwise. Never leave Hangul in the output. "
        "Do not invent facts. Copy numeric substrings in the same order. Output only JSON."
    )
    payload = [{"id": place["id"], "fields": place["fields"]} for place in places]
    response = client.post(
        API_URL,
        json={
            "model": model, "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps({"places": payload}, ensure_ascii=False)},
            ],
        },
        headers={"Authorization": f"Bearer {api_key}"}, timeout=120,
    )
    response.raise_for_status()
    result = json.loads(response.json()["choices"][0]["message"]["content"])
    return {str(row["id"]): row.get("fields", {}) for row in result["places"]}


def translation_batches(places):
    batch, characters = [], 0
    for place in places:
        numeric_only = set(place["fields"]).issubset({"OPERATING_HOURS", "REST_DATE"})
        size = sum(len(value) for value in place["fields"].values())
        if batch and (numeric_only or len(batch) >= MAX_BATCH_PLACES
                      or characters + size > MAX_BATCH_CHARACTERS):
            yield batch
            batch, characters = [], 0
        batch.append(place)
        characters += size
        if numeric_only:
            yield batch
            batch, characters = [], 0
    if batch:
        yield batch


# 시각만 본다. 월 숫자는 번역되면 단어로 바뀌어(3월 → March) 비교 대상이 될 수 없다.
def number_signature(value):
    return [tuple(int(part) for part in token.split(":"))
            for token in re.findall(r"\d{1,2}:\d{2}", value)]


def translate_missing_places(connection, languages=LANGUAGES, *, limit_places=None) -> int:
    api_key = os.getenv("OPENAI_API_KEY", "")
    model = os.getenv("OPENAI_MODEL") or "gpt-4o-mini"
    total = 0
    pending_by_language = {language: pending_places(connection, language) for language in languages}
    if not any(pending_by_language.values()):
        print("OpenAI 보완 번역 — 누락/변경 없음")
        return 0
    if not api_key:
        raise RuntimeError("공식 TourAPI에 없는 번역을 채우려면 OPENAI_API_KEY가 필요합니다")

    with httpx.Client() as client:
        for language, pending in pending_by_language.items():
            if limit_places:
                pending = pending[:limit_places]
            print(f"OpenAI 보완 번역({language}) — {len(pending)}곳", flush=True)
            for batch in translation_batches(pending):
                for attempt in range(3):
                    try:
                        answer = translate_batch(client, api_key, model, language, batch)
                        break
                    except (httpx.HTTPError, ValueError, KeyError) as error:
                        if attempt == 2:
                            raise RuntimeError(f"{language} 번역 API 호출 실패: {error}") from error
                        time.sleep(2 ** attempt)
                for place in batch:
                    fields = answer.get(place["id"], {})
                    for field in FIELDS:  # NAME을 먼저 저장해 PLACE_I18N 행을 보장한다.
                        source = place["fields"].get(field)
                        result = fields.get(field)
                        if source is None or not isinstance(result, str) or not result.strip():
                            continue
                        reject = None
                        if (field in ("OPERATING_HOURS", "REST_DATE")
                                and number_signature(source) != number_signature(result)):
                            reject = "시각이 원문과 다름"
                        else:
                            try:
                                save_machine_translation(
                                    connection, place_idx=place["place_idx"], language=language,
                                    field=field, source=source, translation=result, model=model,
                                )
                            except ValueError as error:
                                reject = str(error)
                            except RuntimeError as error:
                                # NAME 이 빠져 아직 행이 없을 뿐이다. 다음 회차에 다시 시도한다.
                                print(f"보류: {place['id']} {language} {field} — {error}", flush=True)
                                continue
                        if reject:
                            # 온도 0 이라 다시 불러도 결과가 같다. 거절을 남겨 재시도를 멈춘다.
                            record_rejected_translation(
                                connection, place_idx=place["place_idx"], language=language,
                                field=field, source=source, model=model,
                            )
                            print(f"거절: {place['id']} {language} {field} — {reject}", flush=True)
                            continue
                        total += 1
    return total


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--languages", nargs="+", choices=LANGUAGES, default=list(LANGUAGES))
    parser.add_argument("--limit-places", type=int)
    options = parser.parse_args()
    connection = connect()
    try:
        count = translate_missing_places(
            connection, options.languages, limit_places=options.limit_places,
        )
        print(f"OpenAI 보완 번역 완료 — {count}개 필드")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
