from django.test import TestCase
from django.utils import timezone

from core.models import SOURCE_TOUR_API, Festival, Place
from tourapi.sync import place_type_for, sync_festivals, sync_places

PLACE_ITEM = {
    "contentid": "126508",
    "contenttypeid": "12",
    "title": "첨성대",
    "addr1": "경상북도 경주시 첨성로 169-5",
    "mapx": "129.2190247127",
    "mapy": "35.8347351901",
    "firstimage": "http://tong.visitkorea.or.kr/cms/a.jpg",
}

FESTIVAL_ITEM = {
    "contentid": "2758198",
    "contenttypeid": "15",
    "title": "경주 벚꽃축제",
    "addr1": "경상북도 경주시 보문로",
    "eventstartdate": "20260401",
    "eventenddate": "20260410",
}


class FakeClient:
    """Stands in for TourApiClient so sync can be tested without a network."""

    def __init__(self, places=(), festivals=(), common=None, intro=None):
        self.places = list(places)
        self.festivals = list(festivals)
        self.common = common
        self.intro = intro
        self.detail_calls = 0

    def area_based_list(self, content_type_id=None, **kwargs):
        return [
            item
            for item in self.places
            if content_type_id is None or str(item.get("contenttypeid")) == str(content_type_id)
        ]

    def search_festival(self, event_start_date, **kwargs):
        return list(self.festivals)

    def detail_common(self, content_id):
        self.detail_calls += 1
        return self.common

    def detail_intro(self, content_id, content_type_id):
        self.detail_calls += 1
        return self.intro


class PlaceTypeTests(TestCase):
    def test_restaurants_map_to_food(self):
        self.assertEqual(place_type_for(39), Place.TYPE_FOOD)

    def test_everything_else_maps_to_tour(self):
        for content_type_id in (12, 14, 28, 38):
            self.assertEqual(place_type_for(content_type_id), Place.TYPE_TOUR)

    def test_missing_content_type_defaults_to_tour(self):
        self.assertEqual(place_type_for(None), Place.TYPE_TOUR)
        self.assertEqual(place_type_for(""), Place.TYPE_TOUR)


class SyncPlacesTests(TestCase):
    def test_creates_a_place_from_a_list_item(self):
        client = FakeClient(places=[PLACE_ITEM])

        result = sync_places(client, [12], with_detail=False)

        place = Place.objects.get()
        self.assertEqual(result.created, 1)
        self.assertEqual(place.source, SOURCE_TOUR_API)
        self.assertEqual(place.content_id, "126508")
        self.assertEqual(place.name, "첨성대")
        self.assertEqual(place.type, Place.TYPE_TOUR)
        self.assertEqual(place.latitude, "35.8347351901")
        self.assertEqual(place.longitude, "129.2190247127")

    def test_restaurants_are_stored_as_food(self):
        client = FakeClient(places=[{**PLACE_ITEM, "contenttypeid": "39"}])

        sync_places(client, [39], with_detail=False)

        self.assertEqual(Place.objects.get().type, Place.TYPE_FOOD)

    def test_resyncing_updates_in_place_instead_of_duplicating(self):
        sync_places(FakeClient(places=[PLACE_ITEM]), [12], with_detail=False)

        renamed = FakeClient(places=[{**PLACE_ITEM, "title": "첨성대 (보수 후)"}])
        result = sync_places(renamed, [12], with_detail=False)

        self.assertEqual(Place.objects.count(), 1)
        self.assertEqual(result.updated, 1)
        self.assertEqual(result.created, 0)
        self.assertEqual(Place.objects.get().name, "첨성대 (보수 후)")

    def test_curated_columns_survive_a_resync(self):
        sync_places(FakeClient(places=[PLACE_ITEM]), [12], with_detail=False)
        Place.objects.update(is_recommended=True, view_count=1234, is_display=False)

        sync_places(FakeClient(places=[PLACE_ITEM]), [12], with_detail=False)

        place = Place.objects.get()
        self.assertTrue(place.is_recommended)
        self.assertEqual(place.view_count, 1234)
        self.assertFalse(place.is_display)

    def test_a_row_from_another_source_is_left_alone(self):
        """The upsert key includes SOURCE, so a manually entered place that
        happens to share a content id must not be overwritten."""
        manual = Place.objects.create(
            source="MANUAL", content_id="126508", name="수기 등록 첨성대"
        )

        sync_places(FakeClient(places=[PLACE_ITEM]), [12], with_detail=False)

        manual.refresh_from_db()
        self.assertEqual(manual.name, "수기 등록 첨성대")
        self.assertEqual(Place.objects.count(), 2)

    def test_items_without_a_content_id_are_skipped_and_reported(self):
        client = FakeClient(places=[{**PLACE_ITEM, "contentid": ""}])

        result = sync_places(client, [12], with_detail=False)

        self.assertEqual(Place.objects.count(), 0)
        self.assertEqual(len(result.skipped), 1)

    def test_detail_calls_fill_the_text_column(self):
        client = FakeClient(
            places=[PLACE_ITEM],
            common={"overview": "동양에서 가장 오래된 천문대"},
            intro={"usetime": "상시", "parking": "가능"},
        )

        sync_places(client, [12], with_detail=True)

        place = Place.objects.get()
        self.assertEqual(place.text, "동양에서 가장 오래된 천문대")
        self.assertEqual(place.operating_hours, "상시")

    def test_skip_detail_avoids_the_extra_requests(self):
        client = FakeClient(places=[PLACE_ITEM], common={"overview": "x"})

        sync_places(client, [12], with_detail=False)

        self.assertEqual(client.detail_calls, 0)

    def test_limit_caps_the_number_processed(self):
        items = [{**PLACE_ITEM, "contentid": str(i)} for i in range(5)]

        sync_places(FakeClient(places=items), [12], with_detail=False, limit=2)

        self.assertEqual(Place.objects.count(), 2)


class SyncFestivalsTests(TestCase):
    def test_creates_a_festival_with_parsed_dates(self):
        result = sync_festivals(FakeClient(festivals=[FESTIVAL_ITEM]), "20260101", with_detail=False)

        festival = Festival.objects.get()
        self.assertEqual(result.created, 1)
        self.assertEqual(festival.source, SOURCE_TOUR_API)
        self.assertEqual(festival.content_id, "2758198")
        self.assertEqual(festival.name, "경주 벚꽃축제")
        # Stored as UTC, so compare in KST: the API's 20260401 means midnight
        # local, not midnight UTC.
        self.assertEqual(timezone.localtime(festival.start_date).date().isoformat(), "2026-04-01")
        self.assertEqual(timezone.localtime(festival.end_date).date().isoformat(), "2026-04-10")

    def test_resyncing_updates_in_place_instead_of_duplicating(self):
        sync_festivals(FakeClient(festivals=[FESTIVAL_ITEM]), "20260101", with_detail=False)
        sync_festivals(FakeClient(festivals=[FESTIVAL_ITEM]), "20260101", with_detail=False)

        self.assertEqual(Festival.objects.count(), 1)

    def test_is_trash_survives_a_resync(self):
        sync_festivals(FakeClient(festivals=[FESTIVAL_ITEM]), "20260101", with_detail=False)
        Festival.objects.update(is_trash=True)

        sync_festivals(FakeClient(festivals=[FESTIVAL_ITEM]), "20260101", with_detail=False)

        self.assertTrue(Festival.objects.get().is_trash)

    def test_synced_festival_is_visible_through_the_home_endpoint(self):
        """The whole point of the ingestion: what is synced is what the home
        screen serves."""
        client = FakeClient(
            festivals=[{**FESTIVAL_ITEM, "eventenddate": "20991231"}],
            common={"overview": "벚꽃이 만발합니다"},
        )
        sync_festivals(client, "20260101", with_detail=True)

        body = self.client.get("/api/main/festivals").json()

        self.assertEqual(len(body), 1)
        self.assertEqual(body[0]["name"], "경주 벚꽃축제")
        self.assertEqual(body[0]["content"], "벚꽃이 만발합니다")

    def test_synced_place_is_visible_through_the_home_endpoint(self):
        sync_places(FakeClient(places=[PLACE_ITEM]), [12], with_detail=False)
        Place.objects.update(is_recommended=True)

        body = self.client.get("/api/main/places/recommended").json()

        self.assertEqual(len(body), 1)
        self.assertEqual(body[0]["name"], "첨성대")
        self.assertEqual(body[0]["latitude"], 35.8347351901)
