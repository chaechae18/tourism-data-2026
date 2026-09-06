import argparse
import sys

from app.config import get_settings
from app.mysql import connect
from app.persona_scoring import PersonaScoringError, score_places


def parse_arguments(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="장소별 역할 적합도를 LLM 으로 채점해 PLACE_PERSONA_SCORE 에 저장합니다."
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="채점할 최대 장소 수 (시험 실행용). 요금을 먼저 확인할 때 쓰세요.",
    )
    parser.add_argument(
        "--refresh", action="store_true",
        help="이미 채점된 장소도 다시 채점합니다. (그만큼 요금이 다시 나갑니다)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    options = parse_arguments(argv)
    settings = get_settings()
    if not settings.openai_api_key:
        raise SystemExit(
            "OPENAI_API_KEY 가 없습니다. backend/.env 에 키를 넣고 다시 실행해 주세요."
        )

    connection = connect()
    try:
        result = score_places(
            connection,
            api_key=settings.openai_api_key,
            model=settings.openai_model,
            limit=options.limit,
            refresh=options.refresh,
        )
    except PersonaScoringError as error:
        print(f"채점 실패: {error}", file=sys.stderr)
        raise SystemExit(1) from error
    finally:
        connection.close()

    print(f"역할 적합도 채점 완료 — {result} (모델: {settings.openai_model})")
    if result.failed:
        print("실패한 장소는 다시 실행하면 이어서 채점합니다.", file=sys.stderr)


if __name__ == "__main__":
    main()
