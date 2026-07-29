import asyncio
from typing import Annotated, Literal

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)

from ..config import Settings, get_settings
from ..kakao import (
    KakaoLocalClient,
    KakaoNotConfiguredError,
    KakaoUpstreamError,
)
from ..models.places import (
    PlaceSearchItem,
    PlaceSearchMeta,
    PlaceSearchResponse,
)
from ..naver import (
    NaverLocalClient,
    NaverNotConfiguredError,
    NaverUpstreamError,
)
from ..search_controls import SlidingWindowRateLimiter, TTLCache


router = APIRouter(prefix="/api/v1/places", tags=["places"])
search_cache = TTLCache()
search_rate_limiter = SlidingWindowRateLimiter()
NEARBY_CATEGORY_CODES = ("AT4", "FD6", "CE7")


def get_kakao_client(
    app_settings: Annotated[Settings, Depends(get_settings)],
) -> KakaoLocalClient:
    return KakaoLocalClient(app_settings.kakao_rest_api_key)


def get_naver_client(
    app_settings: Annotated[Settings, Depends(get_settings)],
) -> NaverLocalClient:
    return NaverLocalClient(
        app_settings.naver_client_id,
        app_settings.naver_client_secret,
    )


def get_search_cache() -> TTLCache:
    return search_cache


def get_search_rate_limiter() -> SlidingWindowRateLimiter:
    return search_rate_limiter


@router.get(
    "/nearby",
    response_model=PlaceSearchResponse,
    response_model_by_alias=True,
)
async def search_nearby_places(
    request: Request,
    response: Response,
    longitude: Annotated[float, Query(ge=-180, le=180)],
    latitude: Annotated[float, Query(ge=-90, le=90)],
    radius: Annotated[int, Query(ge=100, le=20_000)] = 2_000,
    size: Annotated[int, Query(ge=1, le=15)] = 15,
    settings: Settings = Depends(get_settings),
    kakao: KakaoLocalClient = Depends(get_kakao_client),
    cache: TTLCache = Depends(get_search_cache),
    limiter: SlidingWindowRateLimiter = Depends(get_search_rate_limiter),
) -> PlaceSearchResponse:
    client_ip = request.client.host if request.client else "unknown"
    retry_after = limiter.check(
        client_ip,
        limit=settings.search_rate_limit,
        window_seconds=settings.search_rate_window_seconds,
    )
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "SEARCH_RATE_LIMITED",
                "message": "장소 검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
            },
            headers={"Retry-After": str(retry_after)},
        )

    cache_key = repr(
        (
            "nearby",
            round(longitude, 4),
            round(latitude, 4),
            radius,
            size,
        )
    )
    cached = cache.get(cache_key)
    if cached is not None:
        response.headers["X-Place-Provider"] = "KAKAO"
        response.headers["X-Search-Cache"] = "HIT"
        return cached

    try:
        category_results = await asyncio.gather(
            *(
                kakao.search_places_by_category(
                    category_group_code=category_code,
                    longitude=longitude,
                    latitude=latitude,
                    radius=radius,
                    size=15,
                )
                for category_code in NEARBY_CATEGORY_CODES
            )
        )
    except KakaoNotConfiguredError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "PLACE_SEARCH_NOT_CONFIGURED",
                "message": "Kakao 장소 검색 API 키가 설정되지 않았습니다.",
            },
        ) from error
    except KakaoUpstreamError as error:
        raise _search_unavailable() from error

    places_by_id: dict[str, PlaceSearchItem] = {}
    for category_result in category_results:
        for place in category_result.places:
            places_by_id.setdefault(place.id, place)
    places = sorted(
        places_by_id.values(),
        key=lambda place: (
            place.distance is None,
            place.distance if place.distance is not None else 0,
        ),
    )[:size]
    result = PlaceSearchResponse(
        meta=PlaceSearchMeta(
            totalCount=len(places_by_id),
            pageableCount=len(places),
            isEnd=True,
        ),
        places=places,
    )
    cache.set(cache_key, result, settings.search_cache_ttl_seconds)
    response.headers["X-Place-Provider"] = "KAKAO"
    response.headers["X-Search-Cache"] = "MISS"
    return result


@router.get(
    "/search",
    response_model=PlaceSearchResponse,
    response_model_by_alias=True,
)
async def search_places(
    request: Request,
    response: Response,
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
    settings: Settings = Depends(get_settings),
    kakao: KakaoLocalClient = Depends(get_kakao_client),
    naver: NaverLocalClient = Depends(get_naver_client),
    cache: TTLCache = Depends(get_search_cache),
    limiter: SlidingWindowRateLimiter = Depends(get_search_rate_limiter),
) -> PlaceSearchResponse:
    query = query.strip()
    _validate_search(query, longitude, latitude, radius, sort)
    client_ip = request.client.host if request.client else "unknown"
    retry_after = limiter.check(
        client_ip,
        limit=settings.search_rate_limit,
        window_seconds=settings.search_rate_window_seconds,
    )
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "SEARCH_RATE_LIMITED",
                "message": "장소 검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
            },
            headers={"Retry-After": str(retry_after)},
        )

    cache_key = repr(
        (
            query.casefold(),
            page,
            size,
            category_group_code,
            longitude,
            latitude,
            radius,
            sort,
        )
    )
    cached = cache.get(cache_key)
    if cached is not None:
        response.headers["X-Search-Cache"] = "HIT"
        return cached

    kakao_result: PlaceSearchResponse | None = None
    kakao_error: Exception | None = None
    try:
        kakao_result = await kakao.search_places(
            query=query,
            page=page,
            size=size,
            category_group_code=category_group_code,
            longitude=longitude,
            latitude=latitude,
            radius=radius,
            sort=sort,
        )
    except (KakaoNotConfiguredError, KakaoUpstreamError) as error:
        kakao_error = error

    if kakao_result is not None and kakao_result.places:
        result = kakao_result
        response.headers["X-Place-Provider"] = "KAKAO"
    else:
        try:
            result = await naver.search_places(
                query=query,
                page=page,
                size=size,
            )
            response.headers["X-Place-Provider"] = "NAVER"
        except NaverNotConfiguredError as naver_error:
            if kakao_result is not None:
                result = kakao_result
                response.headers["X-Place-Provider"] = "KAKAO"
            elif isinstance(kakao_error, KakaoNotConfiguredError):
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail={
                        "code": "PLACE_SEARCH_NOT_CONFIGURED",
                        "message": "장소 검색 API 키가 설정되지 않았습니다.",
                    },
                ) from naver_error
            else:
                raise _search_unavailable() from naver_error
        except NaverUpstreamError as naver_error:
            raise _search_unavailable() from naver_error

    cache.set(cache_key, result, settings.search_cache_ttl_seconds)
    response.headers["X-Search-Cache"] = "MISS"
    return result


def _validate_search(
    query: str,
    longitude: float | None,
    latitude: float | None,
    radius: int | None,
    sort: str,
) -> None:
    if not query:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "검색어를 입력해 주세요.",
            },
        )
    has_longitude = longitude is not None
    has_latitude = latitude is not None
    if has_longitude != has_latitude:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "longitude와 latitude는 함께 입력해야 합니다.",
            },
        )
    if (radius is not None or sort == "distance") and not (
        has_longitude and has_latitude
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "반경 또는 거리순 검색에는 중심 좌표가 필요합니다.",
            },
        )


def _search_unavailable() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail={
            "code": "PLACE_SEARCH_UNAVAILABLE",
            "message": "장소 검색 제공자 호출에 실패했습니다.",
        },
    )
