"""Language resolution and translation lookup with Korean fallback."""

SUPPORTED_LANGUAGES = ("ko", "en", "ja", "zh")
DEFAULT_LANGUAGE = "ko"


def normalize_language(raw):
    """Reduce a raw language string to a supported code.

    Accepts anything an Accept-Language header might carry
    ("en-US,en;q=0.9") and keeps only the primary subtag. Unsupported or
    unparseable input falls back to Korean rather than raising: the home
    screen should never go blank over a typo in a query parameter.
    """
    if not raw:
        return DEFAULT_LANGUAGE
    primary = raw.split(",")[0].split(";")[0].split("-")[0].strip().lower()
    return primary if primary in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE


def resolve_language(request):
    """Pick the response language: ?lang= wins, then Accept-Language, then ko."""
    explicit = request.query_params.get("lang")
    if explicit:
        return normalize_language(explicit)
    return normalize_language(request.headers.get("Accept-Language"))


def translation_map(queryset, fk_field, ids, language):
    """Map each id to its best translation row.

    Runs at most two queries regardless of row count: one for the requested
    language, then one for whatever is still missing in Korean. Returns
    ``{id: translation_row}``; ids with no translation at all are absent, and
    callers fall back to the source table's own columns.
    """
    ids = list(ids)
    if not ids:
        return {}

    found = {
        getattr(row, fk_field): row
        for row in queryset.filter(**{f"{fk_field}__in": ids, "language_code": language})
    }

    if language != DEFAULT_LANGUAGE:
        missing = [pk for pk in ids if pk not in found]
        if missing:
            found.update(
                {
                    getattr(row, fk_field): row
                    for row in queryset.filter(
                        **{
                            f"{fk_field}__in": missing,
                            "language_code": DEFAULT_LANGUAGE,
                        }
                    )
                }
            )

    return found
