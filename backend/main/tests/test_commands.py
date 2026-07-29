from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from core.models import Place


def run(**options):
    out = StringIO()
    call_command("recommend_places", stdout=out, stderr=out, **options)
    return out.getvalue()


class RecommendPlacesKeywordTests(TestCase):
    def test_marks_a_landmark_by_partial_name_match(self):
        """공사 API 는 '경주 불국사'처럼 접두어를 붙여 내려주기도 한다."""
        place = Place.objects.create(name="경주 불국사", is_display=True)

        run()

        place.refresh_from_db()
        self.assertTrue(place.is_recommended)

    def test_ignores_places_that_are_not_displayed(self):
        """검수 전이라 숨겨둔 장소는 추천 후보가 아니다."""
        hidden = Place.objects.create(name="불국사", is_display=False)

        run()

        hidden.refresh_from_db()
        self.assertFalse(hidden.is_recommended)

    def test_never_turns_is_display_on(self):
        """추천을 켜면서 노출까지 켜면 운영자가 숨긴 장소가 되살아난다."""
        hidden = Place.objects.create(name="석굴암", is_display=False)

        run()

        hidden.refresh_from_db()
        self.assertFalse(hidden.is_display)

    def test_marks_a_place_once_when_two_keywords_match(self):
        Place.objects.create(name="불국사 석굴암 통합권", is_display=True)

        output = run()

        self.assertEqual(output.count("불국사 석굴암 통합권"), 1)


class RecommendPlacesFallbackTests(TestCase):
    def test_falls_back_to_the_most_viewed_places(self):
        low = Place.objects.create(name="이름 없는 곳", is_display=True, view_count=1)
        high = Place.objects.create(name="다른 곳", is_display=True, view_count=99)

        run(fallback=1)

        high.refresh_from_db()
        low.refresh_from_db()
        self.assertTrue(high.is_recommended)
        self.assertFalse(low.is_recommended, "조회수가 낮은 쪽이 뽑히면 정렬이 빠진 것")

    def test_does_not_fall_back_when_a_keyword_matched(self):
        Place.objects.create(name="첨성대", is_display=True)
        other = Place.objects.create(name="이름 없는 곳", is_display=True, view_count=99)

        run(fallback=5)

        other.refresh_from_db()
        self.assertFalse(other.is_recommended)

    def test_does_not_fall_back_when_something_is_already_recommended(self):
        Place.objects.create(name="운영자가 고른 곳", is_display=True, is_recommended=True)
        other = Place.objects.create(name="이름 없는 곳", is_display=True, view_count=99)

        run(fallback=5)

        other.refresh_from_db()
        self.assertFalse(other.is_recommended)

    def test_fallback_can_be_switched_off(self):
        place = Place.objects.create(name="이름 없는 곳", is_display=True, view_count=99)

        run(fallback=0)

        place.refresh_from_db()
        self.assertFalse(place.is_recommended)


class RecommendPlacesResetTests(TestCase):
    def test_reset_clears_a_place_that_no_longer_qualifies(self):
        stale = Place.objects.create(name="한화리조트 경주", is_display=True, is_recommended=True)

        run(reset=True, fallback=0)

        stale.refresh_from_db()
        self.assertFalse(stale.is_recommended)

    def test_reset_re_marks_landmarks_in_the_same_run(self):
        landmark = Place.objects.create(name="대릉원", is_display=True, is_recommended=True)

        run(reset=True)

        landmark.refresh_from_db()
        self.assertTrue(landmark.is_recommended)


class RecommendPlacesDryRunTests(TestCase):
    def test_dry_run_reports_without_saving(self):
        place = Place.objects.create(name="천마총", is_display=True)

        output = run(dry_run=True)

        place.refresh_from_db()
        self.assertFalse(place.is_recommended)
        self.assertIn("천마총", output)
        self.assertIn("dry-run", output)

    def test_dry_run_does_not_clear_existing_recommendations(self):
        place = Place.objects.create(name="포석정", is_display=True, is_recommended=True)

        run(reset=True, dry_run=True)

        place.refresh_from_db()
        self.assertTrue(place.is_recommended)
