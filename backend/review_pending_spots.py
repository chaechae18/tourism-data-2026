"""Review existing pending posts/comments with the same OpenAI checks as new content."""
import argparse
from datetime import datetime
import json

from app import content_guardrails
from app.mysql import connect
from app.spots import transaction


TARGETS = {"spot": ("SPOTS", "CAPTION", 1), "comment": ("SPOT_COMMENT", "CONTENT", 2)}


def review_pending(connection, target: str, target_id: int) -> str:
    table, column, target_type = TARGETS[target]
    photo = "PHOTO_URL" if target == "spot" else "NULL"
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT {column} AS CONTENT, {photo} AS PHOTO_URL FROM {table} "
                       "WHERE IDX = %s AND MODERATION_STATUS = 0 AND DELETED_AT IS NULL", (target_id,))
        row = cursor.fetchone()
    if row is None:
        return "skipped"
    approval = None
    try:
        approval = content_guardrails.check_content(row["CONTENT"], row["PHOTO_URL"])
        status = 1
    except content_guardrails.ContentRejectedError:
        status = 2
    except (content_guardrails.ModerationUnavailableError, content_guardrails.InvalidModerationImageError):
        return "retry"
    with transaction(connection):
        with connection.cursor() as cursor:
            cursor.execute(f"UPDATE {table} SET MODERATION_STATUS = %s WHERE IDX = %s "
                           "AND MODERATION_STATUS = 0 AND DELETED_AT IS NULL", (status, target_id))
            if cursor.rowcount == 0:
                return "skipped"
            if approval:
                approval.log(connection, target_type=target_type, target_id=target_id)
            else:
                cursor.execute("INSERT INTO MODERATION_LOG (TARGET_TYPE, TARGET_IDX, PROVIDER, RESULT, RAW_SCORE) "
                               "VALUES (%s, %s, 'OPENAI', 2, %s)",
                               (target_type, target_id, json.dumps({"blocked": True})))
            if target == "spot" and status == 1:
                today = datetime.now().date()
                cursor.execute("DELETE FROM SPOT_RANKING_DAILY WHERE RANK_DATE = %s", (today,))
                cursor.execute("DELETE FROM SPOT_RANKING_RUN WHERE RANK_DATE = %s", (today,))
    return "approved" if status == 1 else "rejected"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", choices=TARGETS, default="comment")
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--apply", action="store_true", help="Run OpenAI review and persist each decision")
    args = parser.parse_args()
    if args.limit < 1:
        parser.error("--limit must be positive")
    if args.apply and not content_guardrails.get_settings().openai_api_key:
        parser.error("Configure OPENAI_API_KEY before applying reviews")
    table = TARGETS[args.target][0]
    with connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT IDX FROM {table} WHERE MODERATION_STATUS = 0 AND DELETED_AT IS NULL ORDER BY IDX LIMIT %s", (args.limit,))
            ids = [row["IDX"] for row in cursor.fetchall()]
        print(f"{args.target}: {len(ids)} pending (apply={args.apply})")
        if args.apply:
            for target_id in ids:
                print(f"{args.target} {target_id}: {review_pending(connection, args.target, target_id)}")


if __name__ == "__main__":
    main()
