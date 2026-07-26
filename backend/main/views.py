"""Home screen read endpoints.

All four are public and return a plain JSON array. None of them write, so
there is no CSRF or auth concern.
"""
from django.db.models import Q
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import (
    Festival,
    FestivalI18n,
    MainBanner,
    Place,
    PlaceI18n,
    Popup,
    PopupI18n,
)
from main.i18n import resolve_language, translation_map
from main.serializers import (
    BannerSerializer,
    FestivalSerializer,
    PopupSerializer,
    RecommendedPlaceSerializer,
)


def within_period(now, start_field="start_date", end_field="end_date"):
    """Rows whose display window contains `now`.

    Both bounds are nullable in the DDL; a NULL bound means "unbounded on that
    side" rather than "never show".
    """
    return (Q(**{f"{start_field}__isnull": True}) | Q(**{f"{start_field}__lte": now})) & (
        Q(**{f"{end_field}__isnull": True}) | Q(**{f"{end_field}__gte": now})
    )


class BannerListView(APIView):
    """GET /api/main/banners

    Accepts ?lang= for consistency with the other home endpoints, but
    MAIN_BANNER has no translation table so the parameter has no effect.
    """

    def get(self, request):
        now = timezone.now()
        banners = (
            MainBanner.objects.filter(is_trash=False, is_display=True)
            .filter(within_period(now))
            .order_by("sort", "idx")
        )
        return Response(BannerSerializer(banners, many=True).data)


class PopupListView(APIView):
    """GET /api/main/popup

    Singular path, array response: several popups can share a display window.
    POPUP has no IS_TRASH column, so IS_DISPLAY plus the period is the whole
    filter.
    """

    def get(self, request):
        now = timezone.now()
        language = resolve_language(request)

        popups = list(
            Popup.objects.filter(is_display=True).filter(within_period(now)).order_by("-idx")
        )
        translations = translation_map(
            PopupI18n.objects.all(), "popup_idx", (p.idx for p in popups), language
        )

        serializer = PopupSerializer(
            popups, many=True, context={"translations": translations}
        )
        return Response(serializer.data)


class FestivalListView(APIView):
    """GET /api/main/festivals — festivals that have not finished yet."""

    def get(self, request):
        now = timezone.now()
        language = resolve_language(request)

        festivals = list(
            Festival.objects.filter(is_trash=False)
            .filter(Q(end_date__isnull=True) | Q(end_date__gte=now))
            .order_by("start_date", "idx")
        )
        translations = translation_map(
            FestivalI18n.objects.all(), "festival_idx", (f.idx for f in festivals), language
        )

        serializer = FestivalSerializer(
            festivals, many=True, context={"translations": translations}
        )
        return Response(serializer.data)


class RecommendedPlaceListView(APIView):
    """GET /api/main/places/recommended — most-viewed recommended places.

    IS_DISPLAY gates the row separately from IS_RECOMMENDED so that a place
    ingested from the TourAPI can wait for review before it appears anywhere.
    """

    def get(self, request):
        language = resolve_language(request)

        places = list(
            Place.objects.filter(is_recommended=True, is_display=True).order_by(
                "-view_count", "idx"
            )
        )
        translations = translation_map(
            PlaceI18n.objects.all(), "place_idx", (p.idx for p in places), language
        )

        serializer = RecommendedPlaceSerializer(
            places, many=True, context={"translations": translations}
        )
        return Response(serializer.data)
