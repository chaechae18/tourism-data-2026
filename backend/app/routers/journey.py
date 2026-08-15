from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
import pymysql

from ..course_builder import Course
from ..home import resolve_language
from ..journey import get_or_create_course
from ..models.journey import CharacterResponse, CourseResponse, CourseStopResponse
from ..mysql import get_mysql
from ..personas import PERSONAS


router = APIRouter(prefix="/api/v1/journey", tags=["journey"])

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
            )
            for stop in course.stops
        ],
        skipped_slots=list(course.skipped_slots),
    )


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
