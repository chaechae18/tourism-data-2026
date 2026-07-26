"""수집된 실제 Place 데이터 중 주요 관광지를 추천(is_recommended=True) 처리하는 관리 커맨드.

Usage:
    python manage.py recommend_places
    python manage.py recommend_places --limit 5
"""
from django.core.management.base import BaseCommand
from core.models import Place



DEFAULT_RECOMMENDED_KEYWORDS = [
    "불국사",
    "첨성대",
    "대릉원",
    "동궁과 월지",
    "석굴암",
    "경주타워",
    "황리단길",
    "국립경주박물관",
    "보문관광단지",
    "세심마을",
    "한화리조트",
]


class Command(BaseCommand):
    help = "수집된 실제 관광지 중 주요 명소를 is_recommended=True 로 지정합니다."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=5,
            help="키워드 매칭 실패 시 상위 N 개를 추천 관광지로 켜는 기본값 (기본: 5)",
        )

    def handle(self, *args, **options):
        updated_count = 0

        # 1. 키워드로 주요 관광지 켜기
        for kw in DEFAULT_RECOMMENDED_KEYWORDS:
            qs = Place.objects.filter(name__icontains=kw)
            for place in qs:
                if not place.is_recommended:
                    place.is_recommended = True
                    place.is_display = True
                    place.save(update_fields=["is_recommended", "is_display"])
                    updated_count += 1
                    self.stdout.write(f"  [추천 지정] {place.name} (ID: {place.idx})")

        # 2. 지정된 추천 관광지가 0개일 경우, 상위 N개 지정
        current_recommended = Place.objects.filter(is_recommended=True).count()
        if current_recommended == 0:
            limit = options["limit"]
            qs = Place.objects.filter(is_display=True)[:limit]
            for place in qs:
                place.is_recommended = True
                place.save(update_fields=["is_recommended"])
                updated_count += 1
                self.stdout.write(f"  [기본 추천 지정] {place.name} (ID: {place.idx})")


        self.stdout.write(
            self.style.SUCCESS(
                f"추천 관광지 지정 완료: 총 {Place.objects.filter(is_recommended=True).count()}개 추천 중 (신규 갱신 {updated_count}건)"
            )
        )
