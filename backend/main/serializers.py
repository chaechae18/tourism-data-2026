"""Serializers for the home screen.

Translated fields resolve in three steps: the requested language, then Korean,
then the source table's own column. The third step matters because POPUP and
FESTIVAL already carry Korean text, so an empty *_I18N table is not a reason to
return nothing.
"""
from rest_framework import serializers


class TranslatedSerializer(serializers.Serializer):
    """Base for serializers that read a `translations` map from context."""

    def translation_for(self, obj):
        return self.context.get("translations", {}).get(obj.pk)

    def translated(self, obj, field, fallback):
        """Translation value if present and non-empty, else the source column."""
        row = self.translation_for(obj)
        if row is not None:
            value = getattr(row, field, None)
            if value:
                return value
        return fallback


class BannerSerializer(serializers.Serializer):
    """MAIN_BANNER has no i18n table, so nothing here is translated."""

    img = serializers.CharField(allow_null=True)
    title = serializers.CharField(allow_null=True)
    sub_title = serializers.CharField(allow_null=True)
    link = serializers.CharField(allow_null=True)


class PopupSerializer(TranslatedSerializer):
    title = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()
    img = serializers.CharField(allow_null=True)
    link = serializers.CharField(allow_null=True)

    def get_title(self, obj):
        return self.translated(obj, "title", obj.title)

    def get_content(self, obj):
        return self.translated(obj, "content", obj.content)


class FestivalSerializer(TranslatedSerializer):
    name = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    start_date = serializers.DateTimeField(allow_null=True)
    end_date = serializers.DateTimeField(allow_null=True)
    img = serializers.CharField(allow_null=True)
    url = serializers.CharField(allow_null=True)

    def get_name(self, obj):
        return self.translated(obj, "name", obj.name)

    def get_content(self, obj):
        return self.translated(obj, "content", obj.content)

    def get_location(self, obj):
        return self.translated(obj, "location", obj.location)


class RecommendedPlaceSerializer(TranslatedSerializer):
    """LATITUDE/LONGITUDE are VARCHAR(50) in the DDL but the map expects
    numbers, so they are converted here. Unparseable values become null rather
    than failing the whole response.

    Coordinates are never translated — they mean the same thing in every
    language — so they read straight off the source row.
    """

    name = serializers.SerializerMethodField()
    text = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()
    admission_fee = serializers.SerializerMethodField()

    def get_name(self, obj):
        return self.translated(obj, "name", obj.name)

    def get_text(self, obj):
        return self.translated(obj, "text", obj.text)

    def get_address(self, obj):
        return self.translated(obj, "address", obj.address)

    def get_admission_fee(self, obj):
        return self.translated(obj, "admission_fee", obj.admission_fee)

    def get_latitude(self, obj):
        return _as_float(obj.latitude)

    def get_longitude(self, obj):
        return _as_float(obj.longitude)


def _as_float(value):
    if value is None:
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None
