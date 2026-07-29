from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query
import pymysql

from ..home import (
    list_banners,
    list_festivals,
    list_popups,
    list_recommended_places,
    resolve_language,
)
from ..models.home import (
    BannerResponse,
    FestivalResponse,
    PopupResponse,
    RecommendedPlaceResponse,
)
from ..mysql import get_mysql


router = APIRouter(prefix="/api/v1/main", tags=["main"])

LanguageQuery = Annotated[str | None, Query(alias="lang", max_length=20)]
AcceptLanguage = Annotated[str | None, Header(alias="Accept-Language")]


@router.get("/banners", response_model=list[BannerResponse], response_model_by_alias=True)
def get_banners(
    database: pymysql.Connection = Depends(get_mysql),
) -> list[BannerResponse]:
    return list_banners(database)


@router.get("/popup", response_model=list[PopupResponse], response_model_by_alias=True)
def get_popups(
    lang: LanguageQuery = None,
    accept_language: AcceptLanguage = None,
    database: pymysql.Connection = Depends(get_mysql),
) -> list[PopupResponse]:
    return list_popups(database, language=resolve_language(lang, accept_language))


@router.get("/festivals", response_model=list[FestivalResponse], response_model_by_alias=True)
def get_festivals(
    lang: LanguageQuery = None,
    accept_language: AcceptLanguage = None,
    database: pymysql.Connection = Depends(get_mysql),
) -> list[FestivalResponse]:
    return list_festivals(database, language=resolve_language(lang, accept_language))


@router.get(
    "/places/recommended",
    response_model=list[RecommendedPlaceResponse],
    response_model_by_alias=True,
)
def get_recommended_places(
    lang: LanguageQuery = None,
    accept_language: AcceptLanguage = None,
    database: pymysql.Connection = Depends(get_mysql),
) -> list[RecommendedPlaceResponse]:
    return list_recommended_places(database, language=resolve_language(lang, accept_language))
