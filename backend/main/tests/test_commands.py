from io import StringIO
from django.core.management import call_command
from django.test import TestCase

from core.models import Place



class RecommendPlacesCommandTests(TestCase):
    def test_recommend_places_marks_matching_keyword_as_recommended(self):
        place = Place.objects.create(
            name="경주 불국사",
            is_recommended=False,
            is_display=True,
        )

        out = StringIO()
        call_command("recommend_places", stdout=out)

        place.refresh_from_db()
        self.assertTrue(place.is_recommended)
        self.assertIn("추천 지정", out.getvalue())

    def test_recommend_places_fallback_to_limit(self):
        place = Place.objects.create(
            name="일반 관광지 1",
            is_recommended=False,
            is_display=True,
        )

        out = StringIO()
        call_command("recommend_places", limit=1, stdout=out)

        place.refresh_from_db()
        self.assertTrue(place.is_recommended)
        self.assertIn("기본 추천 지정", out.getvalue())

