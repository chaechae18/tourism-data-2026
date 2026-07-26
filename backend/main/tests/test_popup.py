from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from core.models import Popup, PopupI18n


def make_popup(**overrides):
    now = timezone.now()
    fields = {
        "title": "공지",
        "content": "본문",
        "img": "https://cdn.example.com/p.png",
        "link": "https://example.com/p",
        "start_date": now - timedelta(days=1),
        "end_date": now + timedelta(days=1),
        "is_display": True,
    }
    fields.update(overrides)
    return Popup.objects.create(**fields)


class PopupListTests(TestCase):
    url = reverse("main-popup")

    def test_returns_the_four_specified_fields(self):
        make_popup(title="점검 안내", content="새벽 점검", img="p.png", link="/notice")

        body = self.client.get(self.url).json()

        self.assertEqual(
            body,
            [
                {
                    "title": "점검 안내",
                    "content": "새벽 점검",
                    "img": "p.png",
                    "link": "/notice",
                }
            ],
        )

    def test_excludes_hidden_popups(self):
        make_popup(title="보임")
        make_popup(title="숨김", is_display=False)

        titles = [row["title"] for row in self.client.get(self.url).json()]

        self.assertEqual(titles, ["보임"])

    def test_excludes_popups_outside_the_display_period(self):
        now = timezone.now()
        make_popup(title="진행중")
        make_popup(
            title="시작전",
            start_date=now + timedelta(days=1),
            end_date=now + timedelta(days=2),
        )
        make_popup(
            title="종료됨",
            start_date=now - timedelta(days=2),
            end_date=now - timedelta(days=1),
        )

        titles = [row["title"] for row in self.client.get(self.url).json()]

        self.assertEqual(titles, ["진행중"])

    def test_returns_every_popup_whose_window_is_open(self):
        make_popup(title="첫번째")
        make_popup(title="두번째")

        self.assertEqual(len(self.client.get(self.url).json()), 2)

    def test_newest_popup_comes_first(self):
        make_popup(title="오래된")
        make_popup(title="최신")

        titles = [row["title"] for row in self.client.get(self.url).json()]

        self.assertEqual(titles, ["최신", "오래된"])


class PopupTranslationTests(TestCase):
    url = reverse("main-popup")

    def setUp(self):
        self.popup = make_popup(title="한국어 원본", content="한국어 본문")

    def translate(self, language, **overrides):
        fields = {
            "popup_idx": self.popup.idx,
            "language_code": language,
            "title": f"{language} title",
            "content": f"{language} content",
        }
        fields.update(overrides)
        return PopupI18n.objects.create(**fields)

    def test_uses_the_requested_language(self):
        self.translate("en")

        body = self.client.get(self.url, {"lang": "en"}).json()

        self.assertEqual(body[0]["title"], "en title")
        self.assertEqual(body[0]["content"], "en content")

    def test_falls_back_to_korean_when_the_language_is_missing(self):
        self.translate("ko")

        body = self.client.get(self.url, {"lang": "ja"}).json()

        self.assertEqual(body[0]["title"], "ko title")

    def test_falls_back_to_the_source_row_when_no_translation_exists(self):
        body = self.client.get(self.url, {"lang": "ja"}).json()

        self.assertEqual(body[0]["title"], "한국어 원본")
        self.assertEqual(body[0]["content"], "한국어 본문")

    def test_defaults_to_korean_without_a_lang_parameter(self):
        self.translate("ko")
        self.translate("en")

        body = self.client.get(self.url).json()

        self.assertEqual(body[0]["title"], "ko title")

    def test_unsupported_language_falls_back_to_korean(self):
        self.translate("ko")

        body = self.client.get(self.url, {"lang": "fr"}).json()

        self.assertEqual(self.client.get(self.url, {"lang": "fr"}).status_code, 200)
        self.assertEqual(body[0]["title"], "ko title")

    def test_accept_language_header_is_used_when_lang_is_absent(self):
        self.translate("en")

        body = self.client.get(self.url, headers={"accept-language": "en-US,en;q=0.9"}).json()

        self.assertEqual(body[0]["title"], "en title")

    def test_lang_parameter_beats_the_accept_language_header(self):
        self.translate("en")
        self.translate("ja")

        body = self.client.get(
            self.url, {"lang": "ja"}, headers={"accept-language": "en-US"}
        ).json()

        self.assertEqual(body[0]["title"], "ja title")

    def test_blank_translation_content_falls_back_rather_than_returning_empty(self):
        self.translate("en", content="")

        body = self.client.get(self.url, {"lang": "en"}).json()

        self.assertEqual(body[0]["title"], "en title")
        self.assertEqual(body[0]["content"], "한국어 본문")

    def test_translation_lookup_stays_at_two_queries_for_many_popups(self):
        for index in range(10):
            popup = make_popup(title=f"공지 {index}")
            PopupI18n.objects.create(
                popup_idx=popup.idx,
                language_code="ko",
                title=f"ko {index}",
                content="본문",
            )

        # One query for the popups, one for the requested language, one for the
        # Korean fallback of whatever is still missing.
        with self.assertNumQueries(3):
            self.client.get(self.url, {"lang": "en"})
