from datetime import date
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
import pymysql

from ..config import Settings, get_settings
from ..course_builder import Course
from ..docent import DocentNotFoundError, audio_cache_key, find_docent
from ..home import resolve_language
from ..journey import QuestNotFoundError, complete_quest, get_or_create_course
from ..models.journey import (
    CharacterResponse,
    CourseResponse,
    CourseStopResponse,
    DocentResponse,
    QuestCompletionResponse,
)
from ..mysql import get_mysql
from ..personas import PERSONAS
from ..search_controls import TTLCache
from ..tts import GoogleTextToSpeechClient, TtsNotConfiguredError, TtsUpstreamError


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/journey", tags=["journey"])
# 만든 음성은 파일로 남기지 않고 이 메모리 캐시에만 둔다. 같은 장소를 다시 들으면 여기서 나간다.
# 음성 하나가 수백 KB라 개수를 넉넉하지 않게 잡는다. (TTS_CACHE_ENTRIES 로 조절)
docent_audio_cache = TTLCache(max_entries=get_settings().tts_cache_entries)

UserNo = Annotated[int, Header(alias="X-User-No", ge=1)]
PersonaQuery = Annotated[str, Query(max_length=30)]
VisitDate = Annotated[date | None, Query(alias="date")]
LanguageQuery = Annotated[str | None, Query(alias="lang", max_length=20)]


def to_response(course: Course) -> CourseResponse:
    return CourseResponse(
        course_id=course.course_id,
        persona_key=course.persona_key,
        persona_name=course.persona_name,
        visit_date=course.visit_date,
        total_km=round(course.total_km, 2),
        stops=[
            CourseStopResponse(
                order=stop.order,
                time_slot=stop.time_slot,
                place_id=stop.place_idx,
                quest_id=stop.quest_id,
                name=stop.name,
                category=stop.category,
                address=stop.address,
                latitude=stop.latitude,
                longitude=stop.longitude,
                img=stop.img,
                icon=stop.icon,
                menu=stop.menu,
                rest_date=stop.rest_date,
                hours_unknown=stop.hours_unknown,
                distance_km=stop.distance_km,
                completed=stop.completed,
                docent=stop.has_docent,
            )
            for stop in course.stops
        ],
        skipped_slots=list(course.skipped_slots),
    )


def get_tts_client(
    app_settings: Annotated[Settings, Depends(get_settings)],
) -> GoogleTextToSpeechClient:
    return GoogleTextToSpeechClient(
        app_settings.google_tts_api_key,
        voice=app_settings.tts_voice,
        speaking_rate=app_settings.tts_speaking_rate,
    )


def get_docent_audio_cache() -> TTLCache:
    return docent_audio_cache


def load_docent(database: pymysql.Connection, place_id: int) -> dict:
    try:
        return find_docent(database, place_id)
    except DocentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "DOCENT_NOT_FOUND",
                "message": "읽어 줄 설명이 없는 장소입니다.",
            },
        ) from error


def resolve_persona(persona: str):
    if persona not in PERSONAS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "PERSONA_NOT_FOUND",
                "message": "존재하지 않는 캐릭터입니다.",
            },
        )
    return PERSONAS[persona]


@router.get("/characters", response_model=list[CharacterResponse], response_model_by_alias=True)
def get_characters() -> list[CharacterResponse]:
    return [
        CharacterResponse(key=persona.key, name=persona.name)
        for persona in PERSONAS.values()
    ]


@router.get("/course", response_model=CourseResponse, response_model_by_alias=True)
def get_course(
    user_no: UserNo,
    persona: PersonaQuery = "king",
    visit_date: VisitDate = None,
    lang: LanguageQuery = None,
    database: pymysql.Connection = Depends(get_mysql),
) -> CourseResponse:
    # 저장된 코스 저장, 없으면 새로 뽑아 저장 
    return to_response(
        get_or_create_course(
            database,
            user_no=user_no,
            persona=resolve_persona(persona),
            visit_date=visit_date,
            language=resolve_language(lang, None),
        )
    )


@router.get("/docent/{place_id}", response_model=DocentResponse, response_model_by_alias=True)
def get_docent(
    place_id: int,
    database: pymysql.Connection = Depends(get_mysql),
) -> DocentResponse:
    # 도슨트 원고는 PLACE.TEXT 를 그대로 쓴다. (따로 옮겨 담아 둔 테이블 없음)
    docent = load_docent(database, place_id)
    return DocentResponse(
        placeId=docent["place_id"],
        name=docent["name"],
        text=docent["text"],
    )


@router.get("/docent/{place_id}/audio")
async def get_docent_audio(
    place_id: int,
    app_settings: Annotated[Settings, Depends(get_settings)],
    database: pymysql.Connection = Depends(get_mysql),
    tts: GoogleTextToSpeechClient = Depends(get_tts_client),
    cache: TTLCache = Depends(get_docent_audio_cache),
) -> Response:
    # 들을 때 만들어서 바로 흘려보낸다. 서버 디스크에는 아무것도 남기지 않는다.
    docent = load_docent(database, place_id)
    key = audio_cache_key(
        place_id=place_id,
        text=docent["text"],
        voice=app_settings.tts_voice,
        speaking_rate=app_settings.tts_speaking_rate,
    )

    audio = cache.get(key)
    if audio is None:
        try:
            audio = await tts.synthesize(docent["text"])
        except TtsNotConfiguredError as error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "code": "TTS_NOT_CONFIGURED",
                    "message": "음성 변환 키가 설정되지 않았습니다.",
                },
            ) from error
        except TtsUpstreamError as error:
            # 키 제한이나 API 미사용 설정 같은 원인은 서버 로그를 봐야 알 수 있다.
            logger.warning(
                "[도슨트 음성 실패] place=%s status=%s detail=%s",
                place_id,
                error.status_code,
                error.detail,
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "code": "TTS_UPSTREAM_ERROR",
                    "message": "음성을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.",
                },
            ) from error
        cache.set(key, audio, app_settings.tts_cache_ttl_seconds)

    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={
            # 같은 장소를 다시 들으면 브라우저 캐시에서 바로 재생된다.
            "Cache-Control": f"public, max-age={app_settings.tts_cache_ttl_seconds}",
            "Content-Disposition": "inline",
        },
    )


@router.post(
    "/quests/{quest_id}/complete",
    response_model=QuestCompletionResponse,
    response_model_by_alias=True,
)
def complete_course_quest(
    quest_id: int,
    user_no: UserNo,
    database: pymysql.Connection = Depends(get_mysql),
) -> QuestCompletionResponse:
    # 방문 완료를 저장한다. 새로고침하거나 다시 들어와도 완료 상태가 남는다.
    try:
        completion = complete_quest(database, user_no=user_no, quest_id=quest_id)
    except QuestNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "QUEST_NOT_FOUND",
                "message": "코스에 없는 퀘스트입니다.",
            },
        ) from error
    return QuestCompletionResponse(
        questId=completion["quest_id"],
        name=completion["name"],
        completed=completion["completed"],
        completedAt=completion["completed_at"],
    )


@router.post(
    "/course/refresh",
    response_model=CourseResponse,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def refresh_course(
    user_no: UserNo,
    persona: PersonaQuery = "king",
    visit_date: VisitDate = None,
    lang: LanguageQuery = None,
    database: pymysql.Connection = Depends(get_mysql),
) -> CourseResponse:
    # 저장된 코스 저장, 없으면 새로 뽑아 저장 
    return to_response(
        get_or_create_course(
            database,
            user_no=user_no,
            persona=resolve_persona(persona),
            visit_date=visit_date,
            refresh=True,
            language=resolve_language(lang, None),
        )
    )
