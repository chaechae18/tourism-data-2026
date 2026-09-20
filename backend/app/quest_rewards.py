import json

from .config import BACKEND_DIR


REWARD_SLOTS = ("hat", "top", "bottom", "hand", "effect")
ITEM_TYPES = {"hat": 1, "top": 2, "bottom": 3, "hand": 5, "effect": 6}
REWARD_ITEMS = json.loads((BACKEND_DIR / "db" / "quest_rewards.json").read_text())
ITEMS_BY_ID = {item["id"]: item for item in REWARD_ITEMS}


def inventory(connection, user_no: int, persona: str) -> dict:
    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT i.ITEM_CODE, ui.IS_EQUIPPED
               FROM USER_ITEM ui
               JOIN ITEM i ON i.IDX = ui.ITEM_IDX
               JOIN USER_CHARACTER uc ON uc.IDX = ui.USER_CHARACTER_IDX
               JOIN CHARACTER_MASTER cm ON cm.IDX = uc.CHARACTER_IDX
               WHERE ui.USER_NO = %s AND uc.USER_NO = %s AND cm.CHARACTER_TYPE = %s
               ORDER BY ui.ACQUIRED_AT, ui.IDX""",
            (user_no, user_no, persona),
        )
        rows = cursor.fetchall()
    items = {row["ITEM_CODE"]: ITEMS_BY_ID[row["ITEM_CODE"]]
             for row in rows if row["ITEM_CODE"] in ITEMS_BY_ID}
    outfit = {items[row["ITEM_CODE"]]["slot"]: row["ITEM_CODE"] for row in rows
              if row["IS_EQUIPPED"] and row["ITEM_CODE"] in items}
    return {"items": list(items.values()), "outfit": outfit}


def grant_next_reward(connection, *, user_no: int, owner: dict) -> dict | None:
    # 호출부가 USER_CHARACTER를 잠근 상태에서 완료 기록과 함께 지급한다.
    owned = {item["id"] for item in inventory(connection, user_no, owner["CHARACTER_TYPE"])["items"]}
    role_items = {item["slot"]: item for item in REWARD_ITEMS if item["role"] == owner["CHARACTER_TYPE"]}
    reward = next((role_items[slot] for slot in REWARD_SLOTS
                   if slot in role_items and role_items[slot]["id"] not in owned), None)
    if reward is None:
        return None
    with connection.cursor() as cursor:
        cursor.execute(
            """INSERT INTO ITEM (ITEM_CODE, ITEM_NAME, ITEM_TYPE, CHARACTER_IDX, ITEM_MODEL_IMAGE)
               VALUES (%s, %s, %s, %s, %s)
               ON DUPLICATE KEY UPDATE IDX = LAST_INSERT_ID(IDX)""",
            (reward["id"], reward["name"], ITEM_TYPES[reward["slot"]],
             owner["CHARACTER_IDX"], reward["modelUrl"]),
        )
        item_idx = cursor.lastrowid
        cursor.execute(
            """INSERT INTO USER_ITEM (USER_NO, USER_CHARACTER_IDX, ITEM_IDX)
               VALUES (%s, %s, %s)""",
            (user_no, owner["USER_CHARACTER_IDX"], item_idx),
        )
    return reward


def save_outfit(connection, *, user_no: int, persona: str, outfit: dict) -> dict:
    connection.begin()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """SELECT uc.IDX FROM USER_CHARACTER uc
                   JOIN CHARACTER_MASTER cm ON cm.IDX = uc.CHARACTER_IDX
                   WHERE uc.USER_NO = %s AND cm.CHARACTER_TYPE = %s FOR UPDATE""",
                (user_no, persona),
            )
            character = cursor.fetchone()
            owned = {item["id"]: item for item in inventory(connection, user_no, persona)["items"]}
            if not character or any(slot not in REWARD_SLOTS or item_id not in owned
                                    or owned[item_id]["slot"] != slot for slot, item_id in outfit.items()):
                raise ValueError("획득한 아이템만 해당 부위에 착용할 수 있어요.")
            cursor.execute(
                "UPDATE USER_ITEM SET IS_EQUIPPED = 0 WHERE USER_NO = %s AND USER_CHARACTER_IDX = %s",
                (user_no, character["IDX"]),
            )
            for item_id in outfit.values():
                cursor.execute(
                    """UPDATE USER_ITEM ui JOIN ITEM i ON i.IDX = ui.ITEM_IDX
                       SET ui.IS_EQUIPPED = 1
                       WHERE ui.USER_NO = %s AND ui.USER_CHARACTER_IDX = %s AND i.ITEM_CODE = %s""",
                    (user_no, character["IDX"], item_id),
                )
        saved = inventory(connection, user_no, persona)
        connection.commit()
        return saved
    except Exception:
        connection.rollback()
        raise
