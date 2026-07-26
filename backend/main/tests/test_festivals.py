from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from core.models import Festival, FestivalI18n


def make_festival(**overrides):
    now = timezone.now()
    fields = {
        "name": "축제",
        "content": "설명",
        "location": "경주",
        "start_date": now - timedelta(days=1),
        "end_date": now + timedelta(days=1),
        "img": "https://cdn.example.com/f.png",
        "url": "https://example.com/f",
        "is_trash": False,
    }
    fields.update(overrides)
    return Festival.objects.create(**fields)


class FestivalListTests(TestCase):
    url = reverse("main-festivals")

    def test_returns_the_seven_specified_fields(self):
        make_festival(name="신라문화제", content="본문", location="대릉원")

        body = self.client.get(self.url).json()

        self.assertEqual(
            sorted(body[0].keys()),
            ["content", "end_date", "img", "location", "name", "start_date", "url"],
        )
        self.assertEqual(body[0]["name"], "신라문화제")
        self.assertEqual(body[0]["location"], "대릉원")

    def test_excludes_trashed_festivals(self):
        make_festival(name="보임")
        make_festival(name="삭제됨", is_trash=True)

        names = [row["name"] for row in self.client.get(self.url).json()]

        self.assertEqual(names, ["보임"])

    def test_excludes_festivals_that_have_already_ended(self):
        now = timezone.now()
        make_festival(name="진행중")
        make_festival(
            name="종료됨",
            start_date=now - timedelta(days=10),
            end_date=now - timedelta(days=1),
        )

        names = [row["name"] for row in self.client.get(self.url).json()]

        self.assertEqual(names, ["진행중"])

    def test_includes_festivals_that_have_not_started_yet(self):
        now = timezone.now()
        make_festival(
            name="예정",
            start_date=now + timedelta(days=10),
            end_date=now + timedelta(days=20),
        )

        names = [row["name"] for row in self.client.get(self.url).json()]

        self.assertEqual(names, ["예정"])

    def test_null_end_date_is_treated_as_not_yet_finished(self):
        make_festival(name="상시", end_date=None)

        names = [row["name"] for row in self.client.get(self.url).json()]

        self.assertEqual(names, ["상시"])

    def test_orders_by_start_date_ascending(self):
        now = timezone.now()
        make_festival(name="나중", start_date=now + timedelta(days=5))
        make_festival(name="먼저", start_date=now + timedelta(days=1))

        names = [row["name"] for row in self.client.get(self.url).json()]

        self.assertEqual(names, ["먼저", "나중"])


class FestivalTranslationTests(TestCase):
    url = reverse("main-festivals")

    def setUp(self):
        self.festival = make_festival(
            name="한국어 축제", content="한국어 설명", location="한국어 장소"
        )

    def translate(self, language, **overrides):
        fields = {
            "festival_idx": self.festival.idx,
            "language_code": language,
            "name": f"{language} name",
            "content": f"{language} content",
            "location": f"{language} location",
        }
        fields.update(overrides)
        return FestivalI18n.objects.create(**fields)

    def test_uses_the_requested_language(self):
        self.translate("ja")

        body = self.client.get(self.url, {"lang": "ja"}).json()

        self.assertEqual(body[0]["name"], "ja name")
        self.assertEqual(body[0]["content"], "ja content")
        self.assertEqual(body[0]["location"], "ja location")

    def test_falls_back_to_korean_when_the_language_is_missing(self):
        self.translate("ko")

        body = self.client.get(self.url, {"lang": "zh"}).json()

        self.assertEqual(body[0]["name"], "ko name")

    def test_falls_back_to_the_source_row_when_no_translation_exists(self):
        body = self.client.get(self.url, {"lang": "en"}).json()

        self.assertEqual(body[0]["name"], "한국어 축제")
        self.assertEqual(body[0]["location"], "한국어 장소")

    def test_untranslatable_fields_stay_on_the_source_row(self):
        self.translate("en")

        body = self.client.get(self.url, {"lang": "en"}).json()

        self.assertEqual(body[0]["img"], "https://cdn.example.com/f.png")
        self.assertEqual(body[0]["url"], "https://example.com/f")

    def test_each_festival_falls_back_independently(self):
        translated = make_festival(name="번역 있음")
        FestivalI18n.objects.create(
            festival_idx=translated.idx,
            language_code="en",
            name="translated",
            content="c",
            location="l",
        )

        names = {row["name"] for row in self.client.get(self.url, {"lang": "en"}).json()}

        self.assertEqual(names, {"translated", "한국어 축제"})
