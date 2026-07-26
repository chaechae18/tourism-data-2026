"""로컬 확인용 표본 데이터 생성. 개발 환경 전용입니다.

홈 API 4개가 실제로 어떤 JSON을 내는지 눈으로 보려면 데이터가 있어야 하는데,
팀 MySQL 에는 아직 데이터가 없고 로컬 SQLite 에는 테이블조차 없습니다.
이 커맨드가 둘 다 해결합니다.

    python manage.py seed_demo

일부러 "걸러져야 하는" 행들도 같이 넣습니다. 만료된 배너, 삭제된 배너, 끝난 축제,
추천이 아닌 관광지, 좌표가 깨진 관광지 — 이것들이 응답에서 빠지는지 확인하는 게
목적입니다.
"""
from datetime import timedelta

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.utils import timezone

from core.models import (
    SOURCE_TOUR_API,
    Festival,
    FestivalI18n,
    MainBanner,
    Place,
    PlaceI18n,
    Popup,
    PopupI18n,
)


# 실제로 열리는 외부 링크. 없는 경로를 넣으면 프론트에서 404 가 나서
# API 연동이 안 된 것처럼 보입니다.
TOURISM_URL = "https://www.gyeongju.go.kr/tour/index.do"


class Command(BaseCommand):
    help = "로컬 확인용 표본 데이터를 넣습니다. DEBUG=1 일 때만 동작합니다."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "DEBUG=0 에서는 실행할 수 없습니다. 운영/공용 DB 보호를 위한 장치입니다."
            )

        engine = settings.DATABASES["default"]["ENGINE"]
        name = settings.DATABASES["default"]["NAME"]
        self.stdout.write(f"대상 DB: {engine} / {name}")

        if "sqlite" in engine:
            self._create_tables()

        self._wipe()
        self._seed()
        self.stdout.write(self.style.SUCCESS("표본 데이터 생성 완료"))

    def _create_tables(self):
        """SQLite 에는 팀 DDL 을 적용할 수 없으므로 모델에서 직접 만듭니다.

        모델이 managed=False 라 migrate 로는 생기지 않습니다. MySQL 에서는
        docs/db/schema.sql 을 적용하므로 이 과정이 필요 없습니다.
        """
        existing = set(connection.introspection.table_names())
        with connection.schema_editor() as editor:
            for model in apps.get_app_config("core").get_models():
                if model._meta.db_table in existing:
                    continue
                model._meta.managed = True
                editor.create_model(model)
                model._meta.managed = False
                self.stdout.write(f"  테이블 생성: {model._meta.db_table}")

    def _wipe(self):
        for model in (
            PopupI18n, Popup, FestivalI18n, Festival, MainBanner, PlaceI18n, Place,
        ):
            model.objects.all().delete()

    def _seed(self):
        now = timezone.now()

        # --- 배너: 2건만 보여야 합니다 ---
        # 이미지·링크는 frontend/public 에 실제로 있는 경로와 실제로 열리는 URL만
        # 씁니다. 없는 경로를 넣으면 화면이 깨져서 "API 가 안 붙었다"로 오해하게
        # 됩니다.
        MainBanner.objects.create(
            title="경주의 밤", sub_title="첨성대 야경",
            img="/images/cheomseongdae-paper-cut-night.webp",
            link=TOURISM_URL, sort=0, is_display=True, is_trash=False,
            start_date=now - timedelta(days=1), end_date=now + timedelta(days=30),
        )
        MainBanner.objects.create(
            title="벚꽃 시즌", sub_title="보문호",
            img="/images/cheomseongdae-paper-cut-day.png",
            link=None, sort=1, is_display=True, is_trash=False,
            start_date=None, end_date=None,  # 기간 제한 없음
        )
        MainBanner.objects.create(  # 기간이 지나서 빠져야 함
            title="[안 보여야 함] 기간 지난 배너", sub_title="종료", sort=2,
            is_display=True, is_trash=False,
            start_date=now - timedelta(days=30), end_date=now - timedelta(days=1),
        )
        MainBanner.objects.create(  # 삭제되어서 빠져야 함
            title="[안 보여야 함] 삭제된 배너", sub_title="x", sort=3,
            is_display=True, is_trash=True,
        )
        MainBanner.objects.create(  # 미노출이라 빠져야 함
            title="[안 보여야 함] 비노출 배너", sub_title="x", sort=4,
            is_display=False, is_trash=False,
        )

        # --- 팝업: 1건만 보여야 하고, 한/영 번역이 있습니다 ---
        popup = Popup.objects.create(
            title="시스템 점검 안내", content="7월 26일 새벽 2시~4시 점검이 있습니다.",
            img=None, link=TOURISM_URL, is_display=True,
            start_date=now - timedelta(hours=1), end_date=now + timedelta(days=7),
        )
        PopupI18n.objects.create(
            popup_idx=popup.idx, language_code="ko",
            title="시스템 점검 안내", content="7월 26일 새벽 2시~4시 점검이 있습니다.",
        )
        PopupI18n.objects.create(
            popup_idx=popup.idx, language_code="en",
            title="Scheduled maintenance",
            content="Service pauses on Jul 26, 02:00-04:00 KST.",
        )
        Popup.objects.create(
            title="[안 보여야 함] 비노출 팝업", content="x", is_display=False,
        )

        # --- 축제: 2건이 보이고, 하나만 영어 번역이 있습니다 ---
        festival = Festival.objects.create(
            name="신라문화제", content="경주 대표 축제입니다.", location="경주시 일원",
            start_date=now + timedelta(days=10), end_date=now + timedelta(days=14),
            img="/images/cheomseongdae-paper-cut.png", url=TOURISM_URL, is_trash=False,
        )
        FestivalI18n.objects.create(
            festival_idx=festival.idx, language_code="en",
            name="Silla Cultural Festival",
            content="Gyeongju's flagship festival.", location="Across Gyeongju",
        )
        Festival.objects.create(  # 번역이 없어 ?lang=en 에서도 한국어로 나와야 함
            name="번역 없는 축제", content="한국어만 있습니다.", location="황리단길",
            start_date=now + timedelta(days=20), end_date=now + timedelta(days=21),
            img="/images/cheomseongdae-paper-cut-day.png", is_trash=False,
        )
        Festival.objects.create(  # 이미 끝나서 빠져야 함
            name="[안 보여야 함] 끝난 축제", content="지났습니다.", location="x",
            start_date=now - timedelta(days=30), end_date=now - timedelta(days=2),
            is_trash=False,
        )

        # --- 추천 관광지: 3건이 조회수 내림차순으로 나와야 합니다 ---
        bulguksa = Place.objects.create(
            source=SOURCE_TOUR_API, content_id="126508",
            type=Place.TYPE_TOUR, name="불국사", text="유네스코 세계문화유산",
            address="경북 경주시 불국로 385",
            latitude="35.790102", longitude="129.332099",
            admission_fee="성인 6,000원",
            is_display=True, is_recommended=True, view_count=1520,
        )
        PlaceI18n.objects.create(
            place_idx=bulguksa.idx, language_code="en",
            name="Bulguksa Temple", text="A UNESCO World Heritage Site.",
            address="385 Bulguk-ro, Gyeongju-si", admission_fee="Adults KRW 6,000",
        )
        Place.objects.create(
            source=SOURCE_TOUR_API, content_id="126509",
            type=Place.TYPE_TOUR, name="첨성대", text="동양에서 가장 오래된 천문대",
            address="경북 경주시 인왕동 839-1",
            latitude="35.834755", longitude="129.219004",
            admission_fee="무료",
            is_display=True, is_recommended=True, view_count=980,
        )
        Place.objects.create(  # 좌표가 숫자가 아니라 null 로 나와야 함
            type=Place.TYPE_TOUR,
            name="[테스트] 좌표 깨진 곳", text="좌표가 숫자가 아닐 때 null 로 넘어가는지 확인용",
            address="경북 경주시", latitude="알수없음", longitude="",
            admission_fee=None, is_display=True, is_recommended=True, view_count=5,
        )
        Place.objects.create(  # 추천이 아니라 빠져야 함 (조회수가 제일 높은데도)
            type=Place.TYPE_TOUR, name="[안 보여야 함] 추천 아님", text="x",
            address="x", latitude="35.0", longitude="129.0",
            is_display=True, is_recommended=False, view_count=99999,
        )
        Place.objects.create(  # 추천이지만 미노출이라 빠져야 함
            type=Place.TYPE_FOOD, name="[안 보여야 함] 검수 대기 맛집", text="x",
            address="x", latitude="35.1", longitude="129.1",
            is_display=False, is_recommended=True, view_count=88888,
        )
