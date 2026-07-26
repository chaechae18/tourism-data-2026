"""한국관광공사 TourAPI → FESTIVAL 동기화.

    python manage.py sync_festivals
    python manage.py sync_festivals --from 20260101 --limit 10
"""
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from tourapi.client import TourApiClient, TourApiError
from tourapi.sync import sync_festivals


class Command(BaseCommand):
    help = "한국관광공사 TourAPI의 행사정보를 FESTIVAL 테이블에 동기화합니다."

    def add_arguments(self, parser):
        parser.add_argument(
            "--from",
            dest="event_start_date",
            default=None,
            help="행사 시작일 하한 (YYYYMMDD, 기본: 오늘)",
        )
        parser.add_argument(
            "--skip-detail",
            action="store_true",
            help="상세 조회를 건너뜁니다. 설명·홈페이지가 비지만 훨씬 빠릅니다.",
        )
        parser.add_argument(
            "--limit", type=int, default=None, help="처리할 최대 건수 (시험 실행용)"
        )

    def handle(self, *args, **options):
        start = options["event_start_date"] or timezone.localdate().strftime("%Y%m%d")
        if len(start) != 8 or not start.isdigit():
            raise CommandError(f"--from 은 YYYYMMDD 형식이어야 합니다: {start!r}")

        try:
            client = TourApiClient()
            result = sync_festivals(
                client,
                event_start_date=start,
                with_detail=not options["skip_detail"],
                limit=options["limit"],
            )
        except TourApiError as exc:
            raise CommandError(str(exc)) from exc

        for reason in result.skipped:
            self.stderr.write(self.style.WARNING(f"skipped: {reason}"))
        self.stdout.write(self.style.SUCCESS(f"FESTIVAL 동기화 완료 — {result}"))
