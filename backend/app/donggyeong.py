import pymysql

from .models.donggyeong import DonggyeongItemResponse, ModelFileExtension


ITEM_SLOT = {
    1: "hat",
    2: "clothes",
    5: "hand",
    6: "accessory",
}


def list_donggyeong_items(
    connection: pymysql.Connection,
) -> list[DonggyeongItemResponse]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT item.IDX, item.ITEM_NAME, item.ITEM_TYPE, item.ITEM_IMAGE,
                item.ITEM_MODEL_IMAGE, item.ITEM_DESCRIPTION
            FROM ITEM item
            JOIN CHARACTER_MASTER character_row
              ON character_row.IDX = item.CHARACTER_IDX
            WHERE character_row.CHARACTER_TYPE = 'DONGGYEONG'
              AND character_row.IS_ACTIVE = 1
            ORDER BY item.ITEM_TYPE, item.IDX
            """
        )
        rows = cursor.fetchall()

    return [
        DonggyeongItemResponse(
            id=row["IDX"],
            name=row["ITEM_NAME"],
            slot=ITEM_SLOT.get(row["ITEM_TYPE"], "accessory"),
            imageUrl=row["ITEM_IMAGE"],
            modelUrl=row["ITEM_MODEL_IMAGE"],
            modelExtension=ModelFileExtension.from_path(row["ITEM_MODEL_IMAGE"]),
            description=row["ITEM_DESCRIPTION"],
        )
        for row in rows
    ]
