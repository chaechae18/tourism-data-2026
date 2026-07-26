"""한국관광공사 TourAPI → PLACE 동기화.

    python manage.py sync_places
    python manage.py sync_places --content-types 12 39 --limit 20 --skip-detail
"""
from django.core.management.base import BaseCommand, CommandError

from tourapi.client import (
    CONTENT_TYPE_CULTURAL_FACILITY,
    CONTENT_TYPE_LEPORTS,
    CONTENT_TYPE_RESTAURANT,
    CONTENT_TYPE_SHOPPING,
    CONTENT_TYPE_TOURIST_SPOT,
    TourApiClient,
    TourApiError,
)
from tourapi.sync import sync_places

DEFAULT_CONTENT_TYPES = [
    CONTENT_TYPE_TOURIST_SPOT,
    CONTENT_TYPE_CULTURAL_FACILITY,
    CONTENT_TYPE_LEPORTS,
    CONTENT_TYPE_SHOPPING,
    CONTENT_TYPE_RESTAURANT,
]


class Command(BaseCommand):
    help = "한국관광공사 TourAPI의 지역기반 관광정보를 PLACE 테이블에 동기화합니다."

    def add_arguments(self, parser):
        parser.add_argument(
            "--content-types",
            nargs="+",
            type=int,
            default=DEFAULT_CONTENT_TYPES,
            help="공사 contentTypeId 목록 (기본: 12 14 28 38 39)",
        )
        parser.add_argument(
            "--skip-detail",
            action="store_true",
            help="상세 조회를 건너뜁니다. 소개·운영시간·입장료가 비지만 훨씬 빠릅니다.",
        )
        parser.add_argument(
            "--limit", type=int, default=None, help="처리할 최대 건수 (시험 실행용)"
        )

    def handle(self, *args, **options):
        try:
            client = TourApiClient()
            result = sync_places(
                client,
                content_type_ids=options["content_types"],
                with_detail=not options["skip_detail"],
                limit=options["limit"],
            )
        except TourApiError as exc:
            raise CommandError(str(exc)) from exc

        for reason in result.skipped:
            self.stderr.write(self.style.WARNING(f"skipped: {reason}"))
        self.stdout.write(self.style.SUCCESS(f"PLACE 동기화 완료 — {result}"))
