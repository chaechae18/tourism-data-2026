from django.test import TestCase
from django.urls import reverse

from core.models import SOURCE_TOUR_API, Place, PlaceI18n


def make_place(**overrides):
    fields = {
        "type": Place.TYPE_TOUR,
        "name": "첨성대",
        "text": "동양 최고의 천문대",
        "address": "경북 경주시 인왕동 839-1",
        "latitude": "35.834755",
        "longitude": "129.219004",
        "admission_fee": "무료",
        "is_display": True,
        "is_recommended": True,
        "view_count": 0,
    }
    fields.update(overrides)
    return Place.objects.create(**fields)


class RecommendedPlaceTests(TestCase):
    url = reverse("main-places-recommended")

    def test_returns_the_six_specified_fields(self):
        make_place()

        body = self.client.get(self.url).json()

        self.assertEqual(
            sorted(body[0].keys()),
            ["address", "admission_fee", "latitude", "longitude", "name", "text"],
        )

    def test_excludes_places_that_are_not_recommended(self):
        make_place(name="추천")
        make_place(name="비추천", is_recommended=False)

        names = [row["name"] for row in self.client.get(self.url).json()]

        self.assertEqual(names, ["추천"])

    def test_excludes_places_awaiting_review(self):
        """IS_DISPLAY gates separately from IS_RECOMMENDED so a freshly synced
        place can wait for review before it shows up anywhere."""
        make_place(name="공개됨")
        make_place(name="검수 대기", is_display=False, view_count=99999)

        names = [row["name"] for row in self.client.get(self.url).json()]

        self.assertEqual(names, ["공개됨"])

    def test_orders_by_view_count_descending(self):
        make_place(name="적게 본 곳", view_count=10)
        make_place(name="많이 본 곳", view_count=500)
        make_place(name="중간", view_count=100)

        names = [row["name"] for row in self.client.get(self.url).json()]

        self.assertEqual(names, ["많이 본 곳", "중간", "적게 본 곳"])

    def test_ties_on_view_count_break_by_idx_ascending(self):
        first = make_place(name="먼저", view_count=7)
        second = make_place(name="나중", view_count=7)
        self.assertLess(first.idx, second.idx)

        names = [row["name"] for row in self.client.get(self.url).json()]

        self.assertEqual(names, ["먼저", "나중"])

    def test_coordinates_are_numbers_even_though_the_column_is_varchar(self):
        make_place(latitude="35.834755", longitude="129.219004")

        body = self.client.get(self.url).json()

        self.assertEqual(body[0]["latitude"], 35.834755)
        self.assertEqual(body[0]["longitude"], 129.219004)
        self.assertIsInstance(body[0]["latitude"], float)

    def test_unparseable_coordinates_become_null_instead_of_failing(self):
        make_place(latitude="좌표없음", longitude="")

        body = self.client.get(self.url).json()

        self.assertIsNone(body[0]["latitude"])
        self.assertIsNone(body[0]["longitude"])

    def test_null_coordinates_stay_null(self):
        make_place(latitude=None, longitude=None)

        body = self.client.get(self.url).json()

        self.assertIsNone(body[0]["latitude"])
        self.assertIsNone(body[0]["longitude"])

    def test_surrounding_whitespace_in_coordinates_is_tolerated(self):
        make_place(latitude=" 35.834755 ", longitude=" 129.219004 ")

        body = self.client.get(self.url).json()

        self.assertEqual(body[0]["latitude"], 35.834755)

    def test_returns_empty_array_when_nothing_is_recommended(self):
        self.assertEqual(self.client.get(self.url).json(), [])

    def test_food_and_tour_places_both_appear(self):
        make_place(name="불국사", type=Place.TYPE_TOUR, view_count=2)
        make_place(name="황리단길 식당", type=Place.TYPE_FOOD, view_count=1)

        names = [row["name"] for row in self.client.get(self.url).json()]

        self.assertEqual(names, ["불국사", "황리단길 식당"])


class RecommendedPlaceTranslationTests(TestCase):
    url = reverse("main-places-recommended")

    def setUp(self):
        self.place = make_place(
            source=SOURCE_TOUR_API,
            content_id="126508",
            name="불국사",
            text="유네스코 세계문화유산",
            address="경북 경주시 불국로 385",
            admission_fee="성인 6,000원",
        )

    def translate(self, language, **overrides):
        fields = {
            "place_idx": self.place.idx,
            "language_code": language,
            "name": f"{language} name",
            "text": f"{language} text",
            "address": f"{language} address",
            "admission_fee": f"{language} fee",
        }
        fields.update(overrides)
        return PlaceI18n.objects.create(**fields)

    def test_uses_the_requested_language(self):
        self.translate("en")

        body = self.client.get(self.url, {"lang": "en"}).json()

        self.assertEqual(body[0]["name"], "en name")
        self.assertEqual(body[0]["text"], "en text")
        self.assertEqual(body[0]["address"], "en address")
        self.assertEqual(body[0]["admission_fee"], "en fee")

    def test_falls_back_to_korean_when_the_language_is_missing(self):
        self.translate("ko")

        body = self.client.get(self.url, {"lang": "ja"}).json()

        self.assertEqual(body[0]["name"], "ko name")

    def test_falls_back_to_the_source_row_when_no_translation_exists(self):
        body = self.client.get(self.url, {"lang": "en"}).json()

        self.assertEqual(body[0]["name"], "불국사")
        self.assertEqual(body[0]["admission_fee"], "성인 6,000원")

    def test_coordinates_are_never_translated(self):
        self.translate("en")

        body = self.client.get(self.url, {"lang": "en"}).json()

        self.assertEqual(body[0]["latitude"], 35.834755)
        self.assertEqual(body[0]["longitude"], 129.219004)

    def test_each_place_falls_back_independently(self):
        make_place(name="번역 없는 곳", view_count=1)

        names = {row["name"] for row in self.client.get(self.url, {"lang": "en"}).json()}

        self.assertEqual(names, {"불국사", "번역 없는 곳"})

    def test_translation_lookup_stays_bounded_for_many_places(self):
        for index in range(10):
            place = make_place(name=f"장소 {index}")
            PlaceI18n.objects.create(
                place_idx=place.idx, language_code="ko", name=f"ko {index}"
            )

        # One query for the places, one for the requested language, one for the
        # Korean fallback of whatever is still missing.
        with self.assertNumQueries(3):
            self.client.get(self.url, {"lang": "en"})
