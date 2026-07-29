"""수집된 PLACE 중 홈 화면에 노출할 관광지를 IS_RECOMMENDED=1 로 지정합니다.

    python manage.py recommend_places
    python manage.py recommend_places --reset
    python manage.py recommend_places --dry-run

원래 IS_RECOMMENDED 는 관리자 화면에서 운영자가 켜는 큐레이션 값입니다. 관리자
화면이 나오기 전까지의 임시 수단이라, 관리자 화면이 생기면 이 커맨드는 지워도
됩니다.

IS_DISPLAY 는 건드리지 않습니다. 노출 여부는 검수 결과이고 추천 여부와는 별개인데,
추천을 켜면서 노출까지 같이 켜면 운영자가 일부러 숨긴 장소가 되살아납니다.
(같은 이유로 tourapi.sync 도 이 두 플래그를 건드리지 않습니다.)
"""
from django.core.management.base import BaseCommand

from core.models import Place

# 경주 대표 관광지. 공사 API 의 명칭 표기가 조금씩 달라서("경주 불국사" / "불국사")
# 정확히 일치시키지 않고 부분 일치로 찾습니다.
RECOMMENDED_KEYWORDS = [
    "불국사",
    "석굴암",
    "첨성대",
    "대릉원",
    "동궁과 월지",
    "국립경주박물관",
    "황리단길",
    "양동마을",
    "포석정",
    "무열왕릉",
    "천마총",
    "월정교",
]


class Command(BaseCommand):
    help = "수집된 관광지 중 경주 대표 명소를 추천(IS_RECOMMENDED=1)으로 지정합니다."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="지정을 모두 해제한 뒤 다시 지정합니다. 잘못 켜진 추천을 되돌릴 때 씁니다.",
        )
        parser.add_argument(
            "--fallback",
            type=int,
            default=5,
            help=(
                "키워드에 걸린 관광지가 하나도 없을 때 조회수 상위 N 개를 대신 "
                "지정합니다. 0 이면 폴백하지 않습니다 (기본: 5)"
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="무엇이 바뀌는지만 출력하고 저장하지 않습니다.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if options["reset"]:
            self._reset(dry_run)

        # 노출되지 않는 장소는 추천해도 홈 API 가 걸러내므로 애초에 후보가 아닙니다.
        candidates = Place.objects.filter(is_display=True, is_recommended=False)

        marked = self._mark_by_keyword(candidates, dry_run)

        if not marked and Place.objects.filter(is_recommended=True).count() == 0:
            marked = self._mark_fallback(candidates, options["fallback"], dry_run)

        total = Place.objects.filter(is_recommended=True, is_display=True).count()
        summary = f"신규 지정 {len(marked)}건 / 현재 추천 {total}건"
        if dry_run:
            self.stdout.write(self.style.WARNING(f"[dry-run] {summary} (저장 안 함)"))
        else:
            self.stdout.write(self.style.SUCCESS(f"추천 관광지 지정 완료 — {summary}"))

    def _reset(self, dry_run):
        cleared = Place.objects.filter(is_recommended=True)
        count = cleared.count()
        if not dry_run:
            cleared.update(is_recommended=False)
        self.stdout.write(f"기존 추천 {count}건 해제")

    def _mark_by_keyword(self, candidates, dry_run):
        """이름에 대표 명소 키워드가 들어간 장소를 켭니다."""
        marked = []
        for keyword in RECOMMENDED_KEYWORDS:
            for place in candidates.filter(name__icontains=keyword).order_by("idx"):
                if place.idx in {p.idx for p in marked}:
                    continue  # 키워드 두 개에 동시에 걸린 경우
                marked.append(place)
                self.stdout.write(f"  [키워드: {keyword}] {place.name}")

        if not dry_run:
            for place in marked:
                place.is_recommended = True
                place.save(update_fields=["is_recommended"])
        return marked

    def _mark_fallback(self, candidates, limit, dry_run):
        """대표 명소를 하나도 못 찾았을 때 홈 화면이 비지 않게 하는 안전장치.

        정렬 없이 잘라내면 어떤 행이 뽑힐지 DB 마음이라 실행할 때마다 결과가
        달라집니다. 홈 API 와 같은 순서(조회수 내림차순)로 고정합니다.
        """
        if limit <= 0:
            return []

        self.stdout.write(
            self.style.WARNING(
                "키워드에 걸린 관광지가 없습니다 — 동기화가 덜 됐는지 확인해보세요. "
                f"조회수 상위 {limit}건으로 대체합니다."
            )
        )
        marked = list(candidates.order_by("-view_count", "idx")[:limit])
        for place in marked:
            self.stdout.write(f"  [조회수 상위] {place.name}")
            if not dry_run:
                place.is_recommended = True
                place.save(update_fields=["is_recommended"])
        return marked
