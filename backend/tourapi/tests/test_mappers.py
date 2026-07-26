from django.test import SimpleTestCase

from tourapi.mappers import (
    FESTIVAL_CONTENT_MAX,
    PLACE_NAME_MAX,
    clean,
    extract_homepage_url,
    festival_fields,
    parse_coordinate,
    parse_tour_date,
    place_fields,
)

# A trimmed areaBasedList2 item, field names as the 공사 API returns them.
PLACE_ITEM = {
    "contentid": "126508",
    "contenttypeid": "12",
    "title": "첨성대",
    "addr1": "경상북도 경주시 첨성로 169-5",
    "addr2": "(인왕동)",
    "mapx": "129.2190247127",
    "mapy": "35.8347351901",
    "firstimage": "http://tong.visitkorea.or.kr/cms/a.jpg",
    "firstimage2": "http://tong.visitkorea.or.kr/cms/a_small.jpg",
}

FESTIVAL_ITEM = {
    "contentid": "2758198",
    "contenttypeid": "15",
    "title": "경주 벚꽃축제",
    "addr1": "경상북도 경주시 보문로",
    "eventstartdate": "20260401",
    "eventenddate": "20260410",
    "firstimage": "http://tong.visitkorea.or.kr/cms/f.jpg",
}


class CleanTests(SimpleTestCase):
    def test_strips_html_tags_and_collapses_whitespace(self):
        self.assertEqual(clean("<p>첨성대  <br/>안내</p>"), "첨성대 안내")

    def test_blank_and_none_become_none(self):
        self.assertIsNone(clean(""))
        self.assertIsNone(clean("   "))
        self.assertIsNone(clean(None))
        self.assertIsNone(clean("<br/>"))

    def test_truncates_to_the_column_limit(self):
        self.assertEqual(len(clean("가" * 500, 200)), 200)


class CoordinateTests(SimpleTestCase):
    def test_valid_coordinate_survives_as_a_string(self):
        self.assertEqual(parse_coordinate("35.8347351901"), "35.8347351901")

    def test_garbage_and_blank_become_none(self):
        self.assertIsNone(parse_coordinate("좌표없음"))
        self.assertIsNone(parse_coordinate(""))
        self.assertIsNone(parse_coordinate(None))


class TourDateTests(SimpleTestCase):
    def test_yyyymmdd_becomes_an_aware_midnight(self):
        parsed = parse_tour_date("20260401")

        self.assertEqual((parsed.year, parsed.month, parsed.day), (2026, 4, 1))
        self.assertIsNotNone(parsed.tzinfo)

    def test_malformed_dates_become_none(self):
        self.assertIsNone(parse_tour_date("2026-04-01"))
        self.assertIsNone(parse_tour_date("20261301"))
        self.assertIsNone(parse_tour_date(""))


class HomepageUrlTests(SimpleTestCase):
    def test_extracts_the_href_from_an_anchor(self):
        raw = '<a href="https://www.gyeongju.go.kr" target="_blank">경주시</a>'

        self.assertEqual(extract_homepage_url(raw), "https://www.gyeongju.go.kr")

    def test_bare_url_passes_through(self):
        self.assertEqual(
            extract_homepage_url("https://example.com"), "https://example.com"
        )

    def test_non_url_text_becomes_none(self):
        self.assertIsNone(extract_homepage_url("홈페이지 없음"))
        self.assertIsNone(extract_homepage_url(""))


class PlaceFieldsTests(SimpleTestCase):
    def test_mapx_is_longitude_and_mapy_is_latitude(self):
        fields = place_fields(PLACE_ITEM)

        self.assertEqual(fields["latitude"], "35.8347351901")
        self.assertEqual(fields["longitude"], "129.2190247127")

    def test_address_joins_addr1_and_addr2(self):
        fields = place_fields(PLACE_ITEM)

        self.assertEqual(fields["address"], "경상북도 경주시 첨성로 169-5 (인왕동)")

    def test_prefers_the_full_size_image(self):
        self.assertEqual(
            place_fields(PLACE_ITEM)["img"], "http://tong.visitkorea.or.kr/cms/a.jpg"
        )

    def test_falls_back_to_the_thumbnail_when_there_is_no_full_image(self):
        item = {**PLACE_ITEM, "firstimage": ""}

        self.assertEqual(
            place_fields(item)["img"], "http://tong.visitkorea.or.kr/cms/a_small.jpg"
        )

    def test_detail_fields_are_empty_without_a_detail_call(self):
        fields = place_fields(PLACE_ITEM)

        self.assertIsNone(fields["text"])
        self.assertIsNone(fields["operating_hours"])
        self.assertIsNone(fields["parking"])

    def test_overview_becomes_the_text_column(self):
        fields = place_fields(PLACE_ITEM, detail_common={"overview": "<b>천문대</b>"})

        self.assertEqual(fields["text"], "천문대")

    def test_intro_fields_follow_the_content_type(self):
        fields = place_fields(
            PLACE_ITEM,
            detail_intro={"usetime": "09:00~22:00", "parking": "가능", "usefee": "무시됨"},
        )

        self.assertEqual(fields["operating_hours"], "09:00~22:00")
        self.assertEqual(fields["parking"], "가능")
        # contenttypeid 12 (관광지) exposes no admission fee field.
        self.assertIsNone(fields["admission_fee"])

    def test_restaurant_intro_uses_its_own_field_names(self):
        item = {**PLACE_ITEM, "contenttypeid": "39"}

        fields = place_fields(
            item, detail_intro={"opentimefood": "11:00~21:00", "parkingfood": "불가"}
        )

        self.assertEqual(fields["operating_hours"], "11:00~21:00")
        self.assertEqual(fields["parking"], "불가")

    def test_unknown_content_type_leaves_intro_fields_empty(self):
        item = {**PLACE_ITEM, "contenttypeid": "99"}

        fields = place_fields(item, detail_intro={"usetime": "09:00"})

        self.assertIsNone(fields["operating_hours"])

    def test_long_names_are_truncated_to_the_column_width(self):
        item = {**PLACE_ITEM, "title": "가" * 400}

        self.assertEqual(len(place_fields(item)["name"]), PLACE_NAME_MAX)


class FestivalFieldsTests(SimpleTestCase):
    def test_event_dates_are_parsed(self):
        fields = festival_fields(FESTIVAL_ITEM)

        self.assertEqual(fields["start_date"].day, 1)
        self.assertEqual(fields["end_date"].day, 10)

    def test_location_defaults_to_the_address(self):
        self.assertEqual(
            festival_fields(FESTIVAL_ITEM)["location"], "경상북도 경주시 보문로"
        )

    def test_event_venue_from_the_detail_call_wins_over_the_address(self):
        fields = festival_fields(FESTIVAL_ITEM, detail_intro={"eventplace": "보문호반"})

        self.assertEqual(fields["location"], "보문호반")

    def test_overview_is_truncated_to_the_content_column_width(self):
        fields = festival_fields(FESTIVAL_ITEM, detail_common={"overview": "가" * 2000})

        self.assertEqual(len(fields["content"]), FESTIVAL_CONTENT_MAX)

    def test_homepage_anchor_becomes_the_url(self):
        fields = festival_fields(
            FESTIVAL_ITEM, detail_common={"homepage": '<a href="https://a.kr">a</a>'}
        )

        self.assertEqual(fields["url"], "https://a.kr")
