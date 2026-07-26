from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from core.models import MainBanner


def make_banner(**overrides):
    now = timezone.now()
    fields = {
        "title": "제목",
        "sub_title": "부제",
        "img": "https://cdn.example.com/a.png",
        "link": "https://example.com/a",
        "start_date": now - timedelta(days=1),
        "end_date": now + timedelta(days=1),
        "is_display": True,
        "is_trash": False,
        "sort": 0,
    }
    fields.update(overrides)
    return MainBanner.objects.create(**fields)


class BannerListTests(TestCase):
    url = reverse("main-banners")

    def test_returns_the_four_specified_fields(self):
        make_banner(title="경주 야경", sub_title="첨성대", img="a.png", link="/night")

        body = self.client.get(self.url).json()

        self.assertEqual(
            body,
            [
                {
                    "img": "a.png",
                    "title": "경주 야경",
                    "sub_title": "첨성대",
                    "link": "/night",
                }
            ],
        )

    def test_excludes_trashed_and_hidden_banners(self):
        make_banner(title="보임")
        make_banner(title="삭제됨", is_trash=True)
        make_banner(title="숨김", is_display=False)

        titles = [row["title"] for row in self.client.get(self.url).json()]

        self.assertEqual(titles, ["보임"])

    def test_excludes_banners_outside_the_display_period(self):
        now = timezone.now()
        make_banner(title="진행중")
        make_banner(
            title="시작전",
            start_date=now + timedelta(days=1),
            end_date=now + timedelta(days=2),
        )
        make_banner(
            title="종료됨",
            start_date=now - timedelta(days=2),
            end_date=now - timedelta(days=1),
        )

        titles = [row["title"] for row in self.client.get(self.url).json()]

        self.assertEqual(titles, ["진행중"])

    def test_null_dates_mean_the_period_is_unbounded(self):
        make_banner(title="상시", start_date=None, end_date=None)

        titles = [row["title"] for row in self.client.get(self.url).json()]

        self.assertEqual(titles, ["상시"])

    def test_orders_by_sort_ascending_then_idx(self):
        make_banner(title="세번째", sort=2)
        make_banner(title="첫번째", sort=0)
        make_banner(title="두번째", sort=1)

        titles = [row["title"] for row in self.client.get(self.url).json()]

        self.assertEqual(titles, ["첫번째", "두번째", "세번째"])

    def test_ties_on_sort_break_by_idx_ascending(self):
        first = make_banner(title="먼저", sort=5)
        second = make_banner(title="나중", sort=5)
        self.assertLess(first.idx, second.idx)

        titles = [row["title"] for row in self.client.get(self.url).json()]

        self.assertEqual(titles, ["먼저", "나중"])

    def test_returns_empty_array_when_nothing_is_displayable(self):
        self.assertEqual(self.client.get(self.url).json(), [])

    def test_lang_parameter_is_accepted_but_has_no_translation_table(self):
        make_banner(title="경주 야경")

        body = self.client.get(self.url, {"lang": "en"}).json()

        self.assertEqual(body[0]["title"], "경주 야경")
