"""공사 API 응답 → PLACE / FESTIVAL 컬럼 매핑.

Pure functions, no HTTP and no database. Field mapping is the part that breaks
most often when the API changes, so it is testable against a fixed sample
response.

The trap worth remembering: TourAPI's `mapx` is the **longitude** and `mapy`
is the **latitude**. The names read like x/y but the order is the reverse of
the `latitude, longitude` pairs used everywhere else in this project.
"""
import re
from datetime import datetime

from django.utils import timezone

from tourapi.client import (
    CONTENT_TYPE_CULTURAL_FACILITY,
    CONTENT_TYPE_FESTIVAL,
    CONTENT_TYPE_LEPORTS,
    CONTENT_TYPE_RESTAURANT,
    CONTENT_TYPE_SHOPPING,
    CONTENT_TYPE_TOURIST_SPOT,
)

# Column widths from the team DDL. Values longer than this are truncated
# rather than letting MySQL reject the whole row in STRICT mode.
PLACE_NAME_MAX = 200
PLACE_ADDRESS_MAX = 500
PLACE_TEXT_FIELD_MAX = 300  # OPERATING_HOURS / ADMISSION_FEE / PARKING
PLACE_IMG_MAX = 600
FESTIVAL_NAME_MAX = 300
FESTIVAL_CONTENT_MAX = 700
FESTIVAL_LOCATION_MAX = 500
FESTIVAL_IMG_MAX = 600
FESTIVAL_URL_MAX = 600

# detailIntro2 uses a different field name per content type for the same
# concept, so the mapping has to be explicit. A None means the API does not
# expose that concept for that content type.
INTRO_FIELDS = {
    CONTENT_TYPE_TOURIST_SPOT: {
        "operating_hours": "usetime",
        "admission_fee": None,
        "parking": "parking",
    },
    CONTENT_TYPE_CULTURAL_FACILITY: {
        "operating_hours": "usetimeculture",
        "admission_fee": "usefee",
        "parking": "parkingculture",
    },
    CONTENT_TYPE_LEPORTS: {
        "operating_hours": "usetimeleports",
        "admission_fee": "usefeeleports",
        "parking": "parkingleports",
    },
    CONTENT_TYPE_SHOPPING: {
        "operating_hours": "opentime",
        "admission_fee": None,
        "parking": "parkingshopping",
    },
    CONTENT_TYPE_RESTAURANT: {
        "operating_hours": "opentimefood",
        "admission_fee": None,
        "parking": "parkingfood",
    },
    CONTENT_TYPE_FESTIVAL: {
        "operating_hours": "playtime",
        "admission_fee": "usetimefestival",  # 이용요금 (필드명이 시간처럼 보이지만 요금)
        "parking": "parkingfestival",
    },
}

_HREF = re.compile(r'href=["\']([^"\']+)["\']', re.IGNORECASE)
_TAG = re.compile(r"<[^>]+>")


def clean(value, limit=None):
    """Strip HTML tags and whitespace, return None for blanks."""
    if value is None:
        return None
    text = _TAG.sub(" ", str(value))
    text = " ".join(text.split())
    if not text:
        return None
    return text[:limit] if limit else text


def parse_coordinate(value):
    """TourAPI sends coordinates as strings; PLACE stores them as VARCHAR too.

    Validated as a float here so that garbage never reaches the column, but
    returned as a string to match the DDL.
    """
    if value in (None, ""):
        return None
    try:
        return str(float(str(value).strip()))
    except (TypeError, ValueError):
        return None


def parse_tour_date(value):
    """YYYYMMDD → timezone-aware datetime at midnight KST."""
    if not value:
        return None
    raw = str(value).strip()
    try:
        naive = datetime.strptime(raw, "%Y%m%d")
    except ValueError:
        return None
    return timezone.make_aware(naive, timezone.get_current_timezone())


def extract_homepage_url(value):
    """`homepage` arrives as an HTML anchor, sometimes several."""
    if not value:
        return None
    match = _HREF.search(str(value))
    if match:
        return match.group(1)[:FESTIVAL_URL_MAX]
    text = clean(value, FESTIVAL_URL_MAX)
    return text if text and text.startswith("http") else None


def join_address(item):
    parts = [clean(item.get("addr1")), clean(item.get("addr2"))]
    joined = " ".join(part for part in parts if part)
    return joined[:PLACE_ADDRESS_MAX] if joined else None


def place_fields(item, detail_common=None, detail_intro=None):
    """Map an areaBasedList2 item (plus optional detail calls) to PLACE columns.

    `content_id` is returned separately by the caller as the upsert key.
    """
    fields = {
        "name": clean(item.get("title"), PLACE_NAME_MAX),
        "address": join_address(item),
        "latitude": parse_coordinate(item.get("mapy")),
        "longitude": parse_coordinate(item.get("mapx")),
        "img": clean(item.get("firstimage") or item.get("firstimage2"), PLACE_IMG_MAX),
        "text": None,
        "operating_hours": None,
        "admission_fee": None,
        "parking": None,
    }

    if detail_common:
        fields["text"] = clean(detail_common.get("overview"))

    if detail_intro:
        content_type_id = int(item.get("contenttypeid") or 0)
        mapping = INTRO_FIELDS.get(content_type_id, {})
        for column, source_key in mapping.items():
            if source_key:
                fields[column] = clean(detail_intro.get(source_key), PLACE_TEXT_FIELD_MAX)

    return fields


def festival_fields(item, detail_common=None, detail_intro=None):
    """Map a searchFestival2 item (plus optional detail calls) to FESTIVAL columns."""
    fields = {
        "name": clean(item.get("title"), FESTIVAL_NAME_MAX),
        "location": join_address(item),
        "start_date": parse_tour_date(item.get("eventstartdate")),
        "end_date": parse_tour_date(item.get("eventenddate")),
        "img": clean(item.get("firstimage") or item.get("firstimage2"), FESTIVAL_IMG_MAX),
        "content": None,
        "url": None,
    }

    if detail_common:
        fields["content"] = clean(detail_common.get("overview"), FESTIVAL_CONTENT_MAX)
        fields["url"] = extract_homepage_url(detail_common.get("homepage"))

    if detail_intro:
        venue = clean(detail_intro.get("eventplace"), FESTIVAL_LOCATION_MAX)
        if venue:
            fields["location"] = venue

    return fields
