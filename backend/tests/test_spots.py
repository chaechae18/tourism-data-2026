from pathlib import Path

from app.database import connect, initialize_database
from app.models.spots import SpotCreateRequest
from app.spots import create_spot, list_user_spots


def spot_request(caption: str) -> SpotCreateRequest:
    return SpotCreateRequest.model_validate(
        {
            "place": {
                "id": "12345",
                "name": "첨성대",
                "address": "경북 경주시 인왕동 839-1",
                "roadAddress": "경북 경주시 첨성로 140-25",
                "latitude": 35.8347,
                "longitude": 129.2191,
                "categoryName": "여행 > 관광,명소",
                "categoryGroupCode": "AT4",
                "categoryGroupName": "관광명소",
                "phone": "",
                "placeUrl": "http://place.map.kakao.com/12345",
            },
            "placeType": "TOUR",
            "caption": caption,
            "photoUrl": "https://example.com/cheomseongdae.jpg",
        }
    )


def test_create_spot_reuses_kakao_place(tmp_path: Path) -> None:
    database_path = tmp_path / "test.db"
    initialize_database(database_path)

    with connect(database_path) as connection:
        first = create_spot(
            connection,
            user_no=1,
            request=spot_request("해 질 무렵이 아름다워요."),
        )
        second = create_spot(
            connection,
            user_no=1,
            request=spot_request("밤에도 다시 보고 싶어요."),
        )
        place_count = connection.execute(
            """
            SELECT COUNT(*)
            FROM PLACE
            WHERE SOURCE = 'KAKAO' AND CONTENT_ID = '12345'
            """
        ).fetchone()[0]
        spot_count = connection.execute(
            "SELECT COUNT(*) FROM SPOTS WHERE MAP_PLACE_ID = '12345'"
        ).fetchone()[0]

        spots = list_user_spots(connection, user_no=1, limit=20)

    assert first.id != second.id
    assert first.place.place_id == second.place.place_id
    assert place_count == 1
    assert spot_count == 2
    assert [spot.caption for spot in spots] == [
        "밤에도 다시 보고 싶어요.",
        "해 질 무렵이 아름다워요.",
    ]
