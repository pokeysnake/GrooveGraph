# SEEDED ROOMS: POST /api/rooms makes a room from the sender's ops instead of the starter
# (share from solo with "my patch", a loaded file, the starter, or blank = [])

import json
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi import WebSocketDisconnect
from fastapi.testclient import TestClient

from app.main import app
from app.rooms import MAX_SEED_OPS, STARTER, create_room, replay

client = TestClient(app)

LPF = {"kind": "lpf", "value": 800, "q": 0.7}


def add_filter(node_id: str) -> dict:
    node = {"id": node_id, "type": "filter", "position": {"x": 0, "y": 0}, "data": LPF}
    return {"type": "addNode", "opId": "x", "node": node}


def bpm(n: int) -> dict:
    return {"type": "setSetting", "opId": "x", "patch": {"bpm": n}}


def seed(ops: list[dict]):
    return client.post("/api/rooms", json={"ops": ops})


def snapshot(room_id: str) -> dict:
    with client.websocket_connect(f"/ws/{room_id}") as ws:
        return ws.receive_json()


# 1. a valid seed makes a room, 201 + its id
def test_seed_returns_a_room_id():
    r = seed([bpm(90)])
    assert r.status_code == 201
    assert isinstance(r.json()["roomId"], str) and r.json()["roomId"]


# 2. joining a seeded room gives exactly the seed, not the starter
def test_seeded_room_snapshot_is_the_seed():
    ops = [bpm(90), add_filter("f1")]
    snap = snapshot(seed(ops).json()["roomId"])
    assert snap["ops"] == ops
    assert snap["version"] == len(ops)
    doc = replay(snap["ops"])
    assert doc["settings"]["bpm"] == 90
    assert "f1" in doc["nodes"]


# 3. an empty list is a blank room (version 0), NOT the starter
def test_empty_seed_is_a_blank_room():
    snap = snapshot(seed([]).json()["roomId"])
    assert snap["ops"] == []
    assert snap["version"] == 0


# 4. the starter ops as a seed is the demo room
def test_starter_seed_is_the_demo():
    snap = snapshot(seed(STARTER).json()["roomId"])
    assert snap["ops"] == STARTER


# 5. one bad op refuses the whole seed with apply_op's reason
def test_bad_op_rejects_the_seed():
    bad = {"type": "connect", "opId": "x", "source": "nope", "target": "f1"}
    r = seed([add_filter("f1"), bad])
    assert r.status_code == 422
    assert r.json() == {"detail": "node does not exist"}


# 6. ops are checked in order: a later op that depends on an earlier one is fine,
#    the same op first is not (proves the seed is folded, not checked one by one against an empty doc)
def test_seed_ops_apply_in_order():
    wire = {"type": "connect", "opId": "x", "source": "f1", "target": "f2"}
    assert seed([add_filter("f1"), add_filter("f2"), wire]).status_code == 201
    assert seed([wire, add_filter("f1"), add_filter("f2")]).status_code == 422


# 7. a missing or wrong-shaped body is refused before create_room runs
def test_bad_body_is_refused():
    assert client.post("/api/rooms", json={}).status_code == 422
    assert client.post("/api/rooms", json={"ops": "nope"}).status_code == 422


# 8. too many ops is refused
def test_too_many_ops_is_refused():
    r = seed([bpm(100)] * (MAX_SEED_OPS + 1))
    assert r.status_code == 422
    assert r.json() == {"detail": f"too many ops (max {MAX_SEED_OPS})"}


# 9. every seed gets its own room
def test_each_seed_gets_a_new_room():
    assert seed([]).json()["roomId"] != seed([]).json()["roomId"]


# 10. a seeded room is a normal room afterwards: ops build on the seed
def test_ops_build_on_the_seed():
    room = seed([add_filter("f1")]).json()["roomId"]
    with client.websocket_connect(f"/ws/{room}") as ws:
        ws.receive_json()
        ws.send_json({"type": "op", "op": bpm(120), "clientSeq": 1})
        echo = ws.receive_json()
        assert echo["type"] == "op"
        assert echo["version"] == 2


# the README demo patches (shared/fixtures/demos) must seed a room on the server too, not just load in the browser
_DEMOS = sorted((Path(__file__).resolve().parents[2] / "shared" / "fixtures" / "demos").glob("*.json"))


@pytest.mark.parametrize("path", _DEMOS, ids=[p.stem for p in _DEMOS])
def test_demo_patches_seed_a_room(path):
    ops = json.loads(path.read_text(encoding="utf-8"))["ops"]
    assert isinstance(create_room(ops), str)  # a room id, not a Rejected


# LOST ROOMS: rooms live in memory, so a server restart forgets them. A join to an unknown id is told so
# (close 4404) instead of getting an invented starter room, and a client can rebuild it under the same id.
def test_joining_an_unknown_room_closes_with_4404():
    with (
        client.websocket_connect(f"/ws/{uuid4().hex}") as ws,
        pytest.raises(WebSocketDisconnect) as e,
    ):
        ws.receive_json()
    assert e.value.code == 4404


def test_a_lost_room_is_rebuilt_under_its_old_id():
    old_id = uuid4().hex
    r = client.post("/api/rooms", json={"ops": [add_filter("f1")], "roomId": old_id})
    assert r.status_code == 201
    assert r.json()["roomId"] == old_id
    with client.websocket_connect(f"/ws/{old_id}") as ws:
        snap = ws.receive_json()
    assert "f1" in replay(snap["ops"])["nodes"]


def test_the_second_rebuild_of_the_same_room_gets_409_and_changes_nothing():
    room_id = uuid4().hex
    assert client.post("/api/rooms", json={"ops": [add_filter("first")], "roomId": room_id}).status_code == 201
    late = client.post("/api/rooms", json={"ops": [add_filter("second")], "roomId": room_id})
    assert late.status_code == 409
    assert late.json()["detail"] == "room already exists"
    with client.websocket_connect(f"/ws/{room_id}") as ws:
        nodes = replay(ws.receive_json()["ops"])["nodes"]
    assert "first" in nodes and "second" not in nodes


@pytest.mark.parametrize("bad", ["abc", "../admin", "A" * 32, "x" * 5000])
def test_a_room_id_must_look_like_one_we_would_make(bad):
    assert client.post("/api/rooms", json={"ops": [], "roomId": bad}).status_code == 422
