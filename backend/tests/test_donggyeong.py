import pymysql

from app.donggyeong import list_donggyeong_items
from app.models.donggyeong import ModelFileExtension


def test_model_file_extension_handles_urls() -> None:
    assert ModelFileExtension.from_path("/models/crown.GLB?v=1") is ModelFileExtension.GLB
    assert ModelFileExtension.from_path("/models/crown.gltf#preview") is ModelFileExtension.GLTF
    assert ModelFileExtension.from_path("/models/crown.obj") is None
    assert ModelFileExtension.from_path(None) is None


def test_seeded_donggyeong_item_list(database: pymysql.Connection) -> None:
    with database.cursor() as cursor:
        cursor.execute(
            "INSERT INTO CHARACTER_MASTER (CHARACTER_TYPE) VALUES ('DONGGYEONG')"
        )
        character_id = cursor.lastrowid
        cursor.executemany(
            """
            INSERT INTO ITEM (
                ITEM_NAME, ITEM_TYPE, CHARACTER_IDX, ITEM_MODEL_IMAGE, ITEM_DESCRIPTION
            )
            VALUES (%s, %s, %s, %s, %s)
            """,
            [
                ("금관", 1, character_id, "/models/donggyeong/items/crown.glb", "머리 장식"),
                ("연꽃 장식", 6, character_id, "/models/donggyeong/items/lotus.glb", "장식"),
                ("청록 두루마기", 2, character_id, "/models/donggyeong/items/hanbok.glb", "의상"),
                ("여행 카메라", 5, character_id, "/models/donggyeong/items/camera.glb", "손 아이템"),
                ("천년 등불", 5, character_id, "/models/donggyeong/items/lantern.glb", "손 아이템"),
            ],
        )
    items = list_donggyeong_items(database)
    assert [item.name for item in items] == [
        "금관",
        "청록 두루마기",
        "여행 카메라",
        "천년 등불",
        "연꽃 장식",
    ]
    assert {item.slot for item in items} == {"hat", "clothes", "hand", "accessory"}
    assert all(item.model_extension is ModelFileExtension.GLB for item in items)
