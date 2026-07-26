"""Models mirroring the team-owned MySQL DDL.

Every model here is `managed = False`. The schema belongs to the team's DDL
(`docs/db/schema-v2.sql`); Django reads these tables but never creates or
alters them. Column names stay uppercase via `db_column` while the Python
attributes follow Django convention.

TINYINT columns whose domain is 0/1 are mapped to BooleanField so that
querysets read as `is_display=True`. TINYINT columns with a wider domain would
need IntegerField, but none of those fall in this app's scope.
"""
from django.db import models

# PLACE / FESTIVAL rows carry the system they were ingested from. Upserts key
# on (SOURCE, CONTENT_ID) so a second source can reuse an id without colliding.
SOURCE_TOUR_API = "TOUR_API"


class MainBanner(models.Model):
    """MAIN_BANNER — 메인배너. No i18n table exists for banners."""

    idx = models.AutoField(db_column="IDX", primary_key=True)
    img = models.CharField(db_column="IMG", max_length=800, blank=True, null=True)
    start_date = models.DateTimeField(db_column="START_DATE", blank=True, null=True)
    end_date = models.DateTimeField(db_column="END_DATE", blank=True, null=True)
    is_display = models.BooleanField(db_column="IS_DISPLAY", default=False)
    is_trash = models.BooleanField(db_column="IS_TRASH", default=False)
    link = models.CharField(db_column="LINK", max_length=800, blank=True, null=True)
    sort = models.IntegerField(db_column="SORT", default=0)
    title = models.CharField(db_column="TITLE", max_length=300, blank=True, null=True)
    sub_title = models.CharField(db_column="SUB_TITLE", max_length=200, blank=True, null=True)

    class Meta:
        managed = False
        db_table = "MAIN_BANNER"

    def __str__(self):
        return self.title or f"banner#{self.idx}"


class Popup(models.Model):
    """POPUP — 팝업/공지사항. Note there is no IS_TRASH column on this table."""

    idx = models.AutoField(db_column="IDX", primary_key=True)
    title = models.CharField(db_column="TITLE", max_length=1000, blank=True, null=True)
    content = models.TextField(db_column="CONTENT", blank=True, null=True)
    img = models.CharField(db_column="IMG", max_length=500, blank=True, null=True)
    link = models.CharField(db_column="LINK", max_length=500, blank=True, null=True)
    start_date = models.DateTimeField(db_column="START_DATE", blank=True, null=True)
    end_date = models.DateTimeField(db_column="END_DATE", blank=True, null=True)
    is_display = models.BooleanField(db_column="IS_DISPLAY", default=False)

    class Meta:
        managed = False
        db_table = "POPUP"

    def __str__(self):
        return self.title or f"popup#{self.idx}"


class PopupI18n(models.Model):
    """POPUP_I18N — 팝업 번역."""

    idx = models.AutoField(db_column="IDX", primary_key=True)
    popup_idx = models.IntegerField(db_column="POPUP_IDX")
    language_code = models.CharField(db_column="LANGUAGE_CODE", max_length=10)
    title = models.CharField(db_column="TITLE", max_length=300)
    content = models.TextField(db_column="CONTENT", blank=True, null=True)
    created_at = models.DateTimeField(db_column="CREATED_AT", auto_now_add=True)
    updated_at = models.DateTimeField(db_column="UPDATED_AT", auto_now=True)

    class Meta:
        managed = False
        db_table = "POPUP_I18N"
        unique_together = (("popup_idx", "language_code"),)


class Festival(models.Model):
    """FESTIVAL — 축제. Ingested from the 한국관광공사 TourAPI."""

    idx = models.AutoField(db_column="IDX", primary_key=True)
    source = models.CharField(db_column="SOURCE", max_length=20, blank=True, null=True)
    content_id = models.CharField(db_column="CONTENT_ID", max_length=50, blank=True, null=True)
    name = models.CharField(db_column="NAME", max_length=300, blank=True, null=True)
    content = models.CharField(db_column="CONTENT", max_length=700, blank=True, null=True)
    location = models.CharField(db_column="LOCATION", max_length=500, blank=True, null=True)
    start_date = models.DateTimeField(db_column="START_DATE", blank=True, null=True)
    img = models.CharField(db_column="IMG", max_length=600, blank=True, null=True)
    url = models.CharField(db_column="URL", max_length=600, blank=True, null=True)
    is_trash = models.BooleanField(db_column="IS_TRASH", default=False)
    end_date = models.DateTimeField(db_column="END_DATE", blank=True, null=True)

    class Meta:
        managed = False
        db_table = "FESTIVAL"
        unique_together = (("source", "content_id"),)

    def __str__(self):
        return self.name or f"festival#{self.idx}"


class FestivalI18n(models.Model):
    """FESTIVAL_I18N — 축제 번역."""

    idx = models.AutoField(db_column="IDX", primary_key=True)
    festival_idx = models.IntegerField(db_column="FESTIVAL_IDX")
    language_code = models.CharField(db_column="LANGUAGE_CODE", max_length=10)
    name = models.CharField(db_column="NAME", max_length=300)
    content = models.TextField(db_column="CONTENT", blank=True, null=True)
    location = models.CharField(db_column="LOCATION", max_length=300, blank=True, null=True)
    created_at = models.DateTimeField(db_column="CREATED_AT", auto_now_add=True)
    updated_at = models.DateTimeField(db_column="UPDATED_AT", auto_now=True)

    class Meta:
        managed = False
        db_table = "FESTIVAL_I18N"
        unique_together = (("festival_idx", "language_code"),)


class Place(models.Model):
    """PLACE — 관광지/맛집 리스트.

    A shared table: rows may come from the 한국관광공사 TourAPI or, later, from
    other sources. `source` says which, and `TYPE` replaces the CATEGORY table
    that this schema used to carry.

    LATITUDE/LONGITUDE are VARCHAR in the DDL, so they are read as strings and
    converted at the serializer boundary.
    """

    TYPE_TOUR = "TOUR"
    TYPE_FOOD = "FOOD"

    idx = models.AutoField(db_column="IDX", primary_key=True)
    source = models.CharField(db_column="SOURCE", max_length=20, blank=True, null=True)
    content_id = models.CharField(db_column="CONTENT_ID", max_length=50, blank=True, null=True)
    type = models.CharField(db_column="TYPE", max_length=20, default=TYPE_TOUR)
    name = models.CharField(db_column="NAME", max_length=200, blank=True, null=True)
    text = models.TextField(db_column="TEXT", blank=True, null=True)
    content = models.CharField(db_column="CONTENT", max_length=600, blank=True, null=True)
    img = models.CharField(db_column="IMG", max_length=600, blank=True, null=True)
    address = models.CharField(db_column="ADDRESS", max_length=500, blank=True, null=True)
    latitude = models.CharField(db_column="LATITUDE", max_length=50, blank=True, null=True)
    longitude = models.CharField(db_column="LONGITUDE", max_length=50, blank=True, null=True)
    operating_hours = models.CharField(
        db_column="OPERATING_HOURS", max_length=300, blank=True, null=True
    )
    admission_fee = models.CharField(
        db_column="ADMISSION_FEE", max_length=300, blank=True, null=True
    )
    parking = models.CharField(db_column="PARKING", max_length=300, blank=True, null=True)
    is_display = models.BooleanField(db_column="IS_DISPLAY", default=True)
    is_recommended = models.BooleanField(db_column="IS_RECOMMENDED", default=False)
    view_count = models.IntegerField(db_column="VIEW_COUNT", default=0)
    reg_date = models.DateTimeField(db_column="REG_DATE", auto_now_add=True)

    class Meta:
        managed = False
        db_table = "PLACE"
        unique_together = (("source", "content_id"),)

    def __str__(self):
        return self.name or f"place#{self.idx}"


class PlaceI18n(models.Model):
    """PLACE_I18N — 관광지 번역.

    ADDRESS and ADMISSION_FEE are translatable because "성인 6,000원" and a
    Korean address are not usable as-is for a foreign visitor.
    """

    idx = models.AutoField(db_column="IDX", primary_key=True)
    place_idx = models.IntegerField(db_column="PLACE_IDX")
    language_code = models.CharField(db_column="LANGUAGE_CODE", max_length=10)
    name = models.CharField(db_column="NAME", max_length=200)
    text = models.TextField(db_column="TEXT", blank=True, null=True)
    address = models.CharField(db_column="ADDRESS", max_length=500, blank=True, null=True)
    operating_hours = models.CharField(
        db_column="OPERATING_HOURS", max_length=300, blank=True, null=True
    )
    admission_fee = models.CharField(
        db_column="ADMISSION_FEE", max_length=300, blank=True, null=True
    )
    created_at = models.DateTimeField(db_column="CREATED_AT", auto_now_add=True)
    updated_at = models.DateTimeField(db_column="UPDATED_AT", auto_now=True)

    class Meta:
        managed = False
        db_table = "PLACE_I18N"
        unique_together = (("place_idx", "language_code"),)
