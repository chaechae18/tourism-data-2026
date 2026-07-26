"""Upsert 공사 API 데이터 into PLACE / FESTIVAL.

Rows are keyed by `(SOURCE, CONTENT_ID)`, which is UNIQUE in the schema. That
key is what makes the upsert an upsert: MySQL has no MERGE INTO, and its
`INSERT ... ON DUPLICATE KEY UPDATE` decides "duplicate" from a unique key, so
without it a re-sync would insert a fresh row for every place on every run.

Sync never touches IS_RECOMMENDED, VIEW_COUNT, IS_DISPLAY or IS_TRASH: those
are curated in the admin, and overwriting them would undo an editor's work on
the next run.
"""
import logging
from dataclasses import dataclass, field

from django.db import IntegrityError, transaction

from core.models import SOURCE_TOUR_API, Festival, Place
from tourapi.client import CONTENT_TYPE_FESTIVAL, CONTENT_TYPE_RESTAURANT
from tourapi.mappers import festival_fields, place_fields

logger = logging.getLogger(__name__)


@dataclass
class SyncResult:
    created: int = 0
    updated: int = 0
    skipped: list = field(default_factory=list)

    @property
    def total(self):
        return self.created + self.updated

    def __str__(self):
        return f"created={self.created} updated={self.updated} skipped={len(self.skipped)}"


def place_type_for(content_type_id):
    """공사 contenttypeid → PLACE.TYPE.

    Only the coarse TOUR/FOOD split is inferable from the API. 39 is 음식점;
    every other content type this sync pulls is somewhere to visit.
    """
    is_food = int(content_type_id or 0) == CONTENT_TYPE_RESTAURANT
    return Place.TYPE_FOOD if is_food else Place.TYPE_TOUR


def _content_id(item):
    raw = item.get("contentid")
    return str(raw).strip() if raw not in (None, "") else None


def _fetch_details(client, content_id, content_type_id, with_detail):
    if not with_detail:
        return None, None
    common = client.detail_common(content_id)
    intro = client.detail_intro(content_id, content_type_id)
    return common, intro


def _upsert(model, content_id, fields):
    """Insert or update the row this source owns, keyed by (source, content_id).

    `update_or_create` is a SELECT followed by an INSERT or UPDATE, so two
    overlapping runs can both miss and both insert. The unique key turns that
    race into an IntegrityError instead of a duplicate row, and retrying
    resolves it as the update it should have been.
    """
    key = {"source": SOURCE_TOUR_API, "content_id": content_id}
    try:
        with transaction.atomic():
            _, created = model.objects.update_or_create(defaults=fields, **key)
        return created
    except IntegrityError:
        logger.warning("동시 실행 감지 (%s content_id=%s) — 갱신으로 처리", model.__name__, content_id)
        with transaction.atomic():
            model.objects.filter(**key).update(**fields)
        return False


def sync_places(client, content_type_ids, with_detail=True, limit=None):
    """Pull 지역기반 관광정보 for each content type and upsert into PLACE."""
    result = SyncResult()
    processed = 0

    for content_type_id in content_type_ids:
        for item in client.area_based_list(content_type_id=content_type_id):
            if limit is not None and processed >= limit:
                return result

            content_id = _content_id(item)
            if not content_id:
                result.skipped.append(f"contentid 없음: {item.get('title')!r}")
                continue

            common, intro = _fetch_details(client, content_id, content_type_id, with_detail)
            fields = place_fields(item, common, intro)
            fields["type"] = place_type_for(item.get("contenttypeid"))

            created = _upsert(Place, content_id, fields)
            result.created += created
            result.updated += not created
            processed += 1

    return result


def sync_festivals(client, event_start_date, with_detail=True, limit=None):
    """Pull 행사정보 and upsert into FESTIVAL. `event_start_date` is YYYYMMDD."""
    result = SyncResult()
    processed = 0

    for item in client.search_festival(event_start_date):
        if limit is not None and processed >= limit:
            return result

        content_id = _content_id(item)
        if not content_id:
            result.skipped.append(f"contentid 없음: {item.get('title')!r}")
            continue

        common, intro = _fetch_details(client, content_id, CONTENT_TYPE_FESTIVAL, with_detail)
        fields = festival_fields(item, common, intro)

        created = _upsert(Festival, content_id, fields)
        result.created += created
        result.updated += not created
        processed += 1

    return result
