import argparse
from datetime import date, datetime, timedelta
import os
from pathlib import Path
import sys
import time

import pymysql

from app.config import BACKEND_DIR
from app.mysql import connect
from app.tourapi import (
    CONTENT_TYPE_CULTURAL_FACILITY,
    CONTENT_TYPE_LEPORTS,
    CONTENT_TYPE_RESTAURANT,
    CONTENT_TYPE_SHOPPING,
    CONTENT_TYPE_TOURIST_SPOT,
    LANGUAGE_SERVICES,
    SyncResult,
    TourApiClient,
    TourApiError,
    language_client,
    load_place_ids,
    sync_category_names,
    sync_festivals,
    sync_place_translations,
    sync_places,
)
from translate_places import translate_missing_places

DEFAULT_CONTENT_TYPES = [
    CONTENT_TYPE_TOURIST_SPOT,
    CONTENT_TYPE_CULTURAL_FACILITY,
    CONTENT_TYPE_LEPORTS,
    CONTENT_TYPE_SHOPPING,
    CONTENT_TYPE_RESTAURANT,
]

DEFAULT_INTERVAL_DAYS = float(os.getenv("SYNC_INTERVAL_DAYS", "7"))
# 실패한 회차는 주기를 다 기다리지 않고 이만큼 뒤에 다시 해 본다.
RETRY_DELAY = timedelta(hours=1)
BOOTSTRAP_FIELDS = ("NAME", "TEXT", "ADDRESS", "OPERATING_HOURS", "REST_DATE", "PARKING", "MENU")


def state_path() -> Path:
    return Path(os.getenv("SYNC_STATE_PATH") or BACKEND_DIR / "state" / "last_sync.txt")


def read_last_sync() -> datetime | None:
    """마지막으로 성공한 동기화 시각. 없거나 못 읽으면 '한 적 없음'으로 본다."""
    try:
        return datetime.fromisoformat(state_path().read_text().strip())
    except (OSError, ValueError):
        return None


def write_last_sync(finished_at: datetime) -> None:
    path = state_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(finished_at.isoformat())
    except OSError as exc:
        # 기록만 실패한 것이므로 동기화 자체는 성공으로 둔다. 다음 기동에서 한 번 더 돌 뿐이다.
        print(f"경고: 마지막 동기화 시각을 남기지 못했습니다 ({exc})", file=sys.stderr)


def database_needs_place_bootstrap(
    connection: pymysql.Connection, languages: list[str]
) -> tuple[bool, str]:
    """DB 자체를 보고 최초 장소/번역 적재가 필요한지 판단한다."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) AS count FROM PLACE WHERE SOURCE = 'TOUR_API'")
        place_count = int(cursor.fetchone()["count"])
        if place_count == 0:
            return True, "TourAPI PLACE가 비어 있음"

        for language in languages:
            if language == "ko":
                continue
            # 국문에 값이 있는 필드는 선택 언어에도 있어야 적재 완료로 본다.
            required_fields = " OR ".join(
                f"(COALESCE(NULLIF(k.{field}, ''), NULLIF(p.{field}, '')) IS NOT NULL "
                f"AND NULLIF(t.{field}, '') IS NULL)"
                for field in BOOTSTRAP_FIELDS
            )
            cursor.execute(
                "SELECT COUNT(*) AS count FROM PLACE p "
                "LEFT JOIN PLACE_I18N k ON k.PLACE_IDX = p.IDX AND k.LANGUAGE_CODE = 'ko' "
                "LEFT JOIN PLACE_I18N t ON t.PLACE_IDX = p.IDX AND t.LANGUAGE_CODE = %s "
                "WHERE p.SOURCE = 'TOUR_API' AND (t.IDX IS NULL OR " + required_fields + ")",
                (language,),
            )
            missing = int(cursor.fetchone()["count"])
            if missing:
                return True, f"{language} 장소/번역 {missing}건 누락"

    return False, f"TourAPI 장소 {place_count}건과 번역이 이미 준비됨"


def bootstrap_status(options: argparse.Namespace) -> tuple[bool, str]:
    if options.target not in ("places", "all"):
        return False, "장소가 동기화 대상이 아님"
    connection = connect()
    try:
        return database_needs_place_bootstrap(connection, options.languages)
    finally:
        connection.close()


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
    parser.add_argument(
        "--force", action="store_true",
        help="공사 수정시각이 그대로여도 전부 다시 받습니다. 컬럼을 새로 추가했을 때 씁니다.",
    )
    parser.add_argument(
        "--loop", action="store_true",
        help=f"{DEFAULT_INTERVAL_DAYS}일마다 반복 실행합니다 (컨테이너로 띄울 때).",
    )
    parser.add_argument(
        "--interval-days", type=float, default=DEFAULT_INTERVAL_DAYS,
        help=f"--loop 의 실행 간격 (기본: {DEFAULT_INTERVAL_DAYS}일, SYNC_INTERVAL_DAYS 로도 지정)",
    )
    parser.add_argument(
        "--languages", nargs="*", default=list(LANGUAGE_SERVICES),
        help=(
            "번역을 받아 둘 언어 "
            f"(기본: {' '.join(LANGUAGE_SERVICES)}, 빈 목록이면 번역을 건너뜁니다)"
        ),
    )
    parser.add_argument("--limit", type=int, default=None, help="처리할 최대 건수 (시험 실행용)")
    return parser.parse_args(argv)


def report(table: str, result: SyncResult) -> None:
    for reason in result.skipped:
        print(f"skipped: {reason}", file=sys.stderr)
    print(f"{table} 동기화 완료 — {result}")


def sync_translations(options: argparse.Namespace, connection: pymysql.Connection) -> None:
    # 상세를 건너뛴 회차에는 번역도 받지 않는다. 받아 봐야 이름만 남는다.
    if options.skip_detail or not options.languages:
        return

    # 어느 장소에 붙일지는 언어마다 같으므로 한 번만 읽는다.
    place_ids = load_place_ids(connection)
    if not place_ids:
        print("PLACE 가 비어 있어 번역을 건너뜁니다.", file=sys.stderr)
        return

    for language in options.languages:
        client = language_client(language)
        count = sync_category_names(connection, client, language)
        print(f"CATEGORY_NAME_I18N({language}) — {count}건")
        report(
            f"PLACE_I18N({language})",
            sync_place_translations(
                connection,
                client,
                language=language,
                # 외국어 서비스는 국문과 contentTypeId 가 다르므로 경주 전체 목록을 받는다.
                content_type_ids=(None,),
                limit=options.limit,
                force=options.force,
                place_ids=place_ids,
            ),
        )
    translated = translate_missing_places(
        connection, [language for language in options.languages if language != "ko"],
        limit_places=options.limit,
    )
    print(f"OpenAI 보완 번역 적재 — {translated}개 필드")


def run_once(options: argparse.Namespace, event_start_date: str) -> None:
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
                    force=options.force,
                ),
            )
            sync_translations(options, connection)
        if options.target in ("festivals", "all"):
            report(
                "FESTIVAL",
                sync_festivals(
                    connection,
                    client,
                    event_start_date=event_start_date,
                    with_detail=with_detail,
                    limit=options.limit,
                    force=options.force,
                ),
            )
    finally:
        connection.close()


def run_forever(options: argparse.Namespace) -> None:
    interval = timedelta(days=options.interval_days)
    print(f"주기 동기화를 시작합니다 — {options.interval_days}일 간격")

    while True:
        # 상태 볼륨보다 DB가 기준이다. DB가 비었거나 번역이 덜 들어갔으면 바로 채운다.
        needs_bootstrap, reason = bootstrap_status(options)
        last = read_last_sync()
        if needs_bootstrap:
            print(f"초기 적재가 필요합니다 — {reason}")
            last = None
        elif last is None:
            # DB는 이미 완성됐는데 상태 볼륨만 새것인 경우 API를 다시 호출하지 않는다.
            last = datetime.now()
            write_last_sync(last)
            print(f"초기 적재를 건너뜁니다 — {reason}")

        # 컨테이너를 다시 띄웠다고 주기를 새로 세지 않는다. 마지막 성공 시각부터 잰다.
        remaining = interval - (datetime.now() - last) if last else timedelta(0)
        if remaining > timedelta(0):
            print(f"다음 동기화까지 {remaining} 남았습니다 (마지막 성공: {last:%Y-%m-%d %H:%M})")
            time.sleep(remaining.total_seconds())

        # 행사 조회 하한은 실행하는 날 기준이라 반복할 때마다 새로 잡는다.
        # --from 을 직접 준 경우에만 그 값을 그대로 쓴다.
        start = options.event_start_date or date.today().strftime("%Y%m%d")
        try:
            run_once(options, start)
        except (TourApiError, pymysql.Error) as exc:
            print(f"동기화 실패, {RETRY_DELAY} 뒤에 다시 시도합니다: {exc}", file=sys.stderr)
            time.sleep(RETRY_DELAY.total_seconds())
            continue

        write_last_sync(datetime.now())


def main(argv: list[str] | None = None) -> None:
    options = parse_arguments(argv)
    start = options.event_start_date or date.today().strftime("%Y%m%d")
    if len(start) != 8 or not start.isdigit():
        raise SystemExit(f"--from 은 YYYYMMDD 형식이어야 합니다: {start!r}")

    unknown = [code for code in options.languages if code not in LANGUAGE_SERVICES]
    if unknown:
        raise SystemExit(
            f"모르는 언어입니다: {' '.join(unknown)} "
            f"(가능: {' '.join(LANGUAGE_SERVICES)})"
        )

    if options.loop:
        if options.interval_days <= 0:
            raise SystemExit(f"--interval-days 는 0보다 커야 합니다: {options.interval_days}")
        run_forever(options)
        return

    try:
        run_once(options, start)
    except TourApiError as exc:
        raise SystemExit(str(exc)) from exc


if __name__ == "__main__":
    main()
