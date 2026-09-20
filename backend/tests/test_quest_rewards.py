from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
from threading import Barrier

import pytest

from app import journey
from app.journey import complete_quest, get_or_create_course
from app.mysql import connect
from app.personas import PERSONAS
from app.quest_rewards import REWARD_ITEMS, REWARD_SLOTS, inventory
from test_journey import add_places, set_session


@pytest.mark.parametrize("persona", PERSONAS)
def test_each_role_awards_five_items_in_completion_order(database, insert, rows, persona):
    add_places(insert)
    course = get_or_create_course(database, user_no=1, persona=PERSONAS[persona])
    # 목록의 방문 순서가 아니라 실제로 완료한 순서로 지급해야 한다.
    stops = list(reversed(course.stops))
    received = []
    for number, stop in enumerate(stops):
        result = complete_quest(database, user_no=1, quest_id=stop.quest_id, demo_completion=True)
        if number < 5:
            reward = result["reward"]
            assert reward["slot"] == REWARD_SLOTS[number]
            assert reward["role"] == persona
            received.append(reward["id"])
        else:
            assert result["reward"] is None
        duplicate = complete_quest(database, user_no=1, quest_id=stop.quest_id, demo_completion=True)
        assert duplicate["reward"] is None
        assert duplicate["completed_at"] == result["completed_at"]
    assert len(rows("SELECT IDX FROM USER_ITEM")) == 5
    # 실제 새 DB 연결로 읽어도 보유 상태가 유지된다.
    with connect() as fresh:
        assert {item["id"] for item in inventory(fresh, 1, persona)["items"]} == set(received)
    refreshed = get_or_create_course(database, user_no=1, persona=PERSONAS[persona], refresh=True)
    assert complete_quest(database, user_no=1, quest_id=refreshed.stops[0].quest_id,
                          demo_completion=True)["reward"] is None


def test_old_completions_do_not_skip_unawarded_hat(database, insert):
    add_places(insert)
    course = get_or_create_course(database, user_no=1, persona=PERSONAS["king"])
    with database.cursor() as cursor:
        cursor.execute("SELECT USER_CHARACTER_IDX FROM COURSE WHERE IDX = %s", (course.course_id,))
        character = cursor.fetchone()["USER_CHARACTER_IDX"]
    insert("USER_QUEST", USER_CHARACTER_IDX=character, QUEST_IDX=course.stops[0].quest_id, STATUS=2)
    result = complete_quest(database, user_no=1, quest_id=course.stops[1].quest_id, demo_completion=True)
    assert result["reward"]["id"] == "king_hat"


def test_role_progress_is_independent(database, insert):
    add_places(insert)
    for persona, item in [("king", "king_hat"), ("hwarang", "warrior_hat")]:
        course = get_or_create_course(database, user_no=1, persona=PERSONAS[persona])
        result = complete_quest(database, user_no=1, quest_id=course.stops[0].quest_id, demo_completion=True)
        assert result["reward"]["id"] == item
        assert len(result["inventory"]["items"]) == 1


def test_reward_failure_rolls_back_quest_and_inventory(database, insert, rows, monkeypatch):
    add_places(insert)
    course = get_or_create_course(database, user_no=1, persona=PERSONAS["king"])
    grant = journey.grant_next_reward

    def fail_after_insert(*args, **kwargs):
        grant(*args, **kwargs)
        raise RuntimeError("simulated storage failure")

    monkeypatch.setattr(journey, "grant_next_reward", fail_after_insert)
    with pytest.raises(RuntimeError, match="storage failure"):
        complete_quest(database, user_no=1, quest_id=course.stops[0].quest_id, demo_completion=True)
    assert not rows("SELECT IDX FROM USER_QUEST")
    assert not rows("SELECT IDX FROM USER_ITEM")
    monkeypatch.setattr(journey, "grant_next_reward", grant)
    assert complete_quest(database, user_no=1, quest_id=course.stops[0].quest_id,
                          demo_completion=True)["reward"]["id"] == "king_hat"


@pytest.mark.parametrize("same_quest", [True, False])
def test_concurrent_completions_cannot_duplicate_or_skip_rewards(database, insert, rows, same_quest):
    add_places(insert)
    course = get_or_create_course(database, user_no=1, persona=PERSONAS["king"])
    barrier = Barrier(2)

    def complete(index):
        with connect() as connection:
            barrier.wait(timeout=5)
            return complete_quest(connection, user_no=1, quest_id=course.stops[index].quest_id,
                                  demo_completion=True)["reward"]

    with ThreadPoolExecutor(max_workers=2) as pool:
        rewards = list(pool.map(complete, [0, 0 if same_quest else 1]))
    assert {reward["slot"] for reward in rewards if reward} == ({"hat"} if same_quest else {"hat", "top"})
    assert len(rows("SELECT IDX FROM USER_ITEM")) == (1 if same_quest else 2)


def test_api_returns_rewards_and_persists_owned_outfit(client, database, insert):
    set_session(client, 1)
    add_places(insert)
    stop = client.get("/api/v1/journey/course?persona=merchant").json()["stops"][0]
    response = client.post(f"/api/v1/journey/quests/{stop['questId']}/complete",
                           json={"latitude": stop["latitude"], "longitude": stop["longitude"], "accuracy": 10})
    assert response.status_code == 200
    payload = response.json()
    assert payload["reward"]["id"] == "merchant_hat"
    assert payload["reward"]["modelUrl"].endswith("/merchant/hat.glb")
    assert payload["inventory"]["items"] == [payload["reward"]]
    assert client.get("/api/v1/donggyeong/inventory?persona=merchant").json() == payload["inventory"]

    outfit = {"hat": "merchant_hat"}
    saved = client.put("/api/v1/donggyeong/outfit?persona=merchant", json={"outfit": outfit})
    assert saved.status_code == 200
    with connect() as fresh:
        assert inventory(fresh, 1, "merchant")["outfit"] == outfit
    for bad in [{"hat": "king_hat"}, {"top": "merchant_hat"}, {"top": "merchant_top"}]:
        assert client.put("/api/v1/donggyeong/outfit?persona=merchant", json={"outfit": bad}).status_code == 400
        assert inventory(database, 1, "merchant")["outfit"] == outfit
    assert client.put("/api/v1/donggyeong/outfit?persona=merchant", json={"outfit": {}}).json()["outfit"] == {}
    assert len(inventory(database, 1, "merchant")["items"]) == 1

    insert("USERS", NO=2, ID="reward-other-user", NICKNAME="other", COUNTRY="KR", EMAIL="other@example.com")
    set_session(client, 2)
    assert client.get("/api/v1/donggyeong/inventory?persona=merchant").json()["items"] == []
    assert client.post(f"/api/v1/journey/quests/{stop['questId']}/complete", json={"demoCompletion": True}).status_code == 404
    set_session(client, None)
    assert client.get("/api/v1/donggyeong/inventory?persona=merchant").status_code == 401


def test_two_users_share_one_item_master_but_keep_separate_ownership(database, insert, rows):
    add_places(insert)
    insert("USERS", NO=2, ID="concurrent-user", NICKNAME="other", COUNTRY="KR", EMAIL="other@example.com")
    courses = {user_no: get_or_create_course(database, user_no=user_no, persona=PERSONAS["king"])
               for user_no in (1, 2)}
    barrier = Barrier(2)

    def complete(user_no):
        with connect() as connection:
            barrier.wait(timeout=5)
            return complete_quest(connection, user_no=user_no, quest_id=courses[user_no].stops[0].quest_id,
                                  demo_completion=True)["reward"]["id"]

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert list(pool.map(complete, (1, 2))) == ["king_hat", "king_hat"]
    assert len(rows("SELECT IDX FROM ITEM WHERE ITEM_CODE = 'king_hat'")) == 1
    assert len(rows("SELECT IDX FROM USER_ITEM")) == 2


def test_reward_catalog_matches_all_existing_frontend_assets():
    public = Path(__file__).resolve().parents[2] / "frontend" / "public"
    manifest = json.loads((public / "models/donggyeong/manifest.json").read_text())
    models = {item["id"]: item for item in manifest["items"]}
    roles = {role["id"]: role["appRoleKey"] for role in manifest["roles"]}
    assert len(REWARD_ITEMS) == len(PERSONAS) * 5
    for reward in REWARD_ITEMS:
        model = models[reward["id"]]
        assert (reward["name"], reward["slot"], reward["role"], reward["modelUrl"]) == (
            model["name"], model["slot"], roles[model["role"]], model["url"])
        assert (public / reward["modelUrl"].lstrip("/")).is_file()
