from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..config import Settings, get_settings
from ..kakao import (
    KakaoLocalClient,
    KakaoNotConfiguredError,
    KakaoUpstreamError,
)
from ..models.places import PlaceSearchResponse


router = APIRouter(prefix="/api/v1/places", tags=["places"])


def get_kakao_client(
    app_settings: Annotated[Settings, Depends(get_settings)],
) -> KakaoLocalClient:
    return KakaoLocalClient(app_settings.kakao_rest_api_key)


@router.get(
    "/search",
    response_model=PlaceSearchResponse,
    response_model_by_alias=True,
)
async def search_places(
    query: Annotated[str, Query(min_length=1, max_length=100)],
    page: Annotated[int, Query(ge=1, le=45)] = 1,
    size: Annotated[int, Query(ge=1, le=15)] = 15,
    category_group_code: Annotated[
        str | None,
        Query(alias="categoryGroupCode", pattern=r"^[A-Z0-9]{3}$"),
    ] = None,
    longitude: Annotated[
        float | None,
        Query(alias="longitude", ge=-180, le=180),
    ] = None,
    latitude: Annotated[
        float | None,
        Query(alias="latitude", ge=-90, le=90),
    ] = None,
    radius: Annotated[int | None, Query(ge=0, le=20_000)] = None,
    sort: Literal["accuracy", "distance"] = "accuracy",
    kakao: KakaoLocalClient = Depends(get_kakao_client),
) -> PlaceSearchResponse:
    query = query.strip()
    if not query:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "검색어를 입력해 주세요.",
            },
        )
    has_longitude = longitude is not None
    has_latitude = latitude is not None
    if has_longitude != has_latitude:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "longitude와 latitude는 함께 입력해야 합니다.",
            },
        )
    if (radius is not None or sort == "distance") and not (
        has_longitude and has_latitude
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "반경 또는 거리순 검색에는 중심 좌표가 필요합니다.",
            },
        )

    try:
        return await kakao.search_places(
            query=query,
            page=page,
            size=size,
            category_group_code=category_group_code,
            longitude=longitude,
            latitude=latitude,
            radius=radius,
            sort=sort,
        )
    except KakaoNotConfiguredError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "KAKAO_NOT_CONFIGURED",
                "message": "Kakao REST API 키가 설정되지 않았습니다.",
            },
        ) from error
    except KakaoUpstreamError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "KAKAO_UPSTREAM_ERROR",
                "message": "Kakao 장소 검색에 실패했습니다.",
            },
        ) from error
