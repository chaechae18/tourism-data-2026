"""Preserve provenance for existing GPT translations that had no official API link."""

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None

FIELDS = (
    "NAME", "TEXT", "ADDRESS", "OPERATING_HOURS", "ADMISSION_FEE",
    "PARKING", "REST_DATE", "MENU",
)


def upgrade() -> None:
    # 연결된 외국어 contentId가 전혀 없는 기존 행은 이전 GPT 보완 적재분이다.
    # 배포 파일을 없애더라도 다음 한국어 원문 변경부터 다시 번역할 수 있게 해시를 옮긴다.
    for field in FIELDS:
        op.execute(
            f"""
            INSERT IGNORE INTO PLACE_TRANSLATION_CACHE
                (PLACE_IDX, LANGUAGE_CODE, FIELD_NAME, SOURCE_HASH, MODEL, STATUS)
            SELECT p.IDX, t.LANGUAGE_CODE, '{field}',
                   SHA2(COALESCE(NULLIF(k.{field}, ''), p.{field}), 256),
                   'legacy-import', 'machine'
            FROM PLACE p
            JOIN PLACE_I18N t ON t.PLACE_IDX = p.IDX
                AND t.LANGUAGE_CODE IN ('en', 'ja', 'zh')
            LEFT JOIN PLACE_I18N k ON k.PLACE_IDX = p.IDX AND k.LANGUAGE_CODE = 'ko'
            LEFT JOIN PLACE_TOURAPI_LINK l ON l.PLACE_IDX = p.IDX
                AND l.LANGUAGE_CODE = t.LANGUAGE_CODE
            WHERE p.SOURCE = 'TOUR_API' AND l.PLACE_IDX IS NULL
                AND NULLIF(t.{field}, '') IS NOT NULL
                AND COALESCE(NULLIF(k.{field}, ''), NULLIF(p.{field}, '')) IS NOT NULL
            """
        )


def downgrade() -> None:
    op.execute("DELETE FROM PLACE_TRANSLATION_CACHE WHERE MODEL = 'legacy-import'")
