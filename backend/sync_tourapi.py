import argparse
from datetime import date
import sys

from app.mysql import connect
from app.tourapi import (
    CONTENT_TYPE_CULTURAL_FACILITY,
    CONTENT_TYPE_LEPORTS,
    CONTENT_TYPE_RESTAURANT,
    CONTENT_TYPE_SHOPPING,
    CONTENT_TYPE_TOURIST_SPOT,
    SyncResult,
    TourApiClient,
    TourApiError,
    sync_festivals,
    sync_places,
)

DEFAULT_CONTENT_TYPES = [
    CONTENT_TYPE_TOURIST_SPOT,
    CONTENT_TYPE_CULTURAL_FACILITY,
    CONTENT_TYPE_LEPORTS,
    CONTENT_TYPE_SHOPPING,
    CONTENT_TYPE_RESTAURANT,
]


def parse_arguments(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="한국관광공사 TourAPI를 PLACE / FESTIVAL 테이블에 동기화합니다."
    )
    parser.add_argument(
        "--target", choices=("places", "festivals", "all"), default="all",
        help="동기화 대상 (기본: all)",
    )
    parser.add_argument(
        "--content-types", nargs="+", type=int, default=DEFAULT_CONTENT_TYPES,
        help="공사 contentTypeId 목록 (기본: 12 14 28 38 39)",
    )
    parser.add_argument(
        "--from", dest="event_start_date", default=None,
        help="행사 시작일 하한 (YYYYMMDD, 기본: 오늘)",
    )
    parser.add_argument(
        "--skip-detail", action="store_true",
        help="상세 조회를 건너뜁니다. 소개·운영시간·입장료가 비지만 훨씬 빠릅니다.",
    )
    parser.add_argument("--limit", type=int, default=None, help="처리할 최대 건수 (시험 실행용)")
    return parser.parse_args(argv)


def report(table: str, result: SyncResult) -> None:
    for reason in result.skipped:
        print(f"skipped: {reason}", file=sys.stderr)
    print(f"{table} 동기화 완료 — {result}")


def main(argv: list[str] | None = None) -> None:
    options = parse_arguments(argv)
    start = options.event_start_date or date.today().strftime("%Y%m%d")
    if len(start) != 8 or not start.isdigit():
        raise SystemExit(f"--from 은 YYYYMMDD 형식이어야 합니다: {start!r}")

    with_detail = not options.skip_detail
    connection = connect()
    try:
        client = TourApiClient()
        if options.target in ("places", "all"):
            report(
                "PLACE",
                sync_places(
                    connection,
                    client,
                    content_type_ids=options.content_types,
                    with_detail=with_detail,
                    limit=options.limit,
                ),
            )
        if options.target in ("festivals", "all"):
            report(
                "FESTIVAL",
                sync_festivals(
                    connection,
                    client,
                    event_start_date=start,
                    with_detail=with_detail,
                    limit=options.limit,
                ),
            )
    except TourApiError as exc:
        raise SystemExit(str(exc)) from exc
    finally:
        connection.close()


if __name__ == "__main__":
    main()
