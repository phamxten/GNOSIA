"""A new learner goes through Bab 1 end to end: register → onboarding → Pahami → Perkuat
(adaptive item, hints, L6 gate) → Kuis (fail, then pass) → Challenge → Bab 2 unlocks."""
import uuid

from app.seed import bab1_halo

from .conftest import login

ITEMS = {i["id"]: i for i in bab1_halo.ITEMS}
BANK = {q["id"]: q for q in bab1_halo.BANK}


def right_answer(item):
    t = item["type"]
    if t == "match":
        return [[p["key"], p["key"]] for p in item["left"]]
    return item["answer"]


def wrong_answer(item):
    t = item["type"]
    if t in ("choice", "predict"):
        return (item["answer"] + 1) % len(item["choices"])
    if t == "bug":
        return 1 if item["answer"] != 1 else 2
    if t == "fill":
        return list(reversed(item["answer"]))
    if t == "parsons":
        return list(reversed(item["answer"]))
    raise AssertionError(t)


def register(client):
    email = f"tes-{uuid.uuid4().hex[:6]}@contoh.id"
    r = client.post("/api/auth/register", json={"name": "Tes", "email": email, "password": ""})
    assert r.status_code == 422 and r.json()["detail"]["fields"]["password"] == "Kata sandi tidak boleh kosong."
    r = client.post("/api/auth/register", json={"name": "Tes", "email": email, "password": "x"})
    assert r.status_code == 200 and not r.json()["onboarded"]
    return email


def test_full_chapter(client):
    register(client)
    r = client.post("/api/onboarding", json={"goal": "penasaran", "placement": "c", "daily_goal_min": 10})
    assert r.status_code == 200 and r.json()["start"]["number"] == 1
    home = client.get("/api/home").json()
    assert home["first_time"] and home["continue"]["chapter"]["number"] == 1

    # locked phases redirect to the chapter page
    r = client.get("/api/chapters/1/kuis")
    assert r.status_code == 409 and r.json()["detail"]["redirect"] == "/bab/1"
    r = client.get("/api/chapters/2")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "locked"

    # Pahami
    p = client.get("/api/chapters/1/pahami").json()
    assert len(p["scenes"]) == 6 and p["scene"] == 1
    client.post("/api/chapters/1/pahami/scene", json={"scene": 4})
    assert client.get("/api/chapters/1/pahami").json()["scene"] == 4  # resumable
    done = client.post("/api/chapters/1/pahami/complete").json()
    assert done["xp"] == 50 and done["phases"]["perkuat"]["state"] == "open"
    assert client.post("/api/chapters/1/pahami/complete").json()["xp"] == 0  # idempotent

    # Perkuat
    pk = client.get("/api/chapters/1/perkuat").json()
    ids = [i["id"] for i in pk["items"]]
    assert "b5b" not in ids and "answer" not in pk["items"][0]
    r = client.post("/api/chapters/1/perkuat/complete")
    assert r.status_code == 409  # nothing solved yet
    for iid in ids:
        item = ITEMS[iid]
        if iid == "b5":
            w = client.post("/api/chapters/1/perkuat/check", json={"item_id": iid, "answer": wrong_answer(item)}).json()
            assert not w["correct"] and w["inserted"]["id"] == "b5b" and w["hint"]
            h = client.post("/api/chapters/1/perkuat/hint", json={"item_id": iid, "ms_since_shown": 5000}).json()
            assert h["level"] == 4
            client.post("/api/chapters/1/perkuat/check", json={"item_id": iid, "answer": wrong_answer(item)})
            assert client.post("/api/chapters/1/perkuat/solution", json={"item_id": iid}).status_code == 403
            client.post("/api/chapters/1/perkuat/check", json={"item_id": iid, "answer": wrong_answer(item)})
            sol = client.post("/api/chapters/1/perkuat/solution", json={"item_id": iid})
            assert sol.status_code == 200 and sol.json()["level"] == 6
        ok = client.post("/api/chapters/1/perkuat/check", json={"item_id": iid, "answer": right_answer(item)}).json()
        assert ok["correct"], iid
        assert ok["xp"] == (10 if iid != "b5" else 5)
    r = client.post("/api/chapters/1/perkuat/complete")
    assert r.status_code == 409  # the inserted similar item must be solved too
    item = ITEMS["b5b"]
    assert client.post("/api/chapters/1/perkuat/check", json={"item_id": "b5b", "answer": right_answer(item)}).json()["correct"]
    done = client.post("/api/chapters/1/perkuat/complete").json()
    assert done["accuracy"] == round(100 * 6 / 7) and done["phases"]["kuis"]["state"] == "open"

    # Kuis: fail first (all wrong), then pass
    rnd = client.post("/api/chapters/1/kuis/rounds", json={}).json()
    assert len(rnd["questions"]) == 10 and "a" not in rnd["questions"][0]
    for i, q in enumerate(rnd["questions"]):
        a = client.post(f"/api/kuis/rounds/{rnd['round_id']}/answer", json={"index": i, "choice": (BANK[q["id"]]["a"] + 1) % 4, "left": 10}).json()
        assert not a["correct"] and a["combo"] == 1
    res = client.post(f"/api/kuis/rounds/{rnd['round_id']}/finish").json()
    assert not res["passed"] and res["pct"] == 0 and res["missing"] == 70 and len(res["review"]) == 10
    assert client.get("/api/chapters/1/challenge").status_code == 409  # Uji still locked

    rnd = client.post("/api/chapters/1/kuis/rounds", json={}).json()
    combos = []
    for i, q in enumerate(rnd["questions"]):
        a = client.post(f"/api/kuis/rounds/{rnd['round_id']}/answer", json={"index": i, "choice": BANK[q["id"]]["a"], "left": 15}).json()
        combos.append(a["combo"])
    assert combos[:3] == [2, 3, 3]
    res = client.post(f"/api/kuis/rounds/{rnd['round_id']}/finish").json()
    assert res["passed"] and res["pct"] == 100 and res["uji"]["challenge"]

    # Challenge (L1 only): a wrong program, then the right one
    ch = client.get("/api/chapters/1/challenge").json()
    assert all("kind" not in t for t in ch["challenge"]["tests"])
    bad = client.post("/api/chapters/1/challenge/run", json={"code": 'console.log("Halo, aku Nosi")\nconsole.log(15)'}).json()
    assert bad["passed"] == 3 and not bad["all_pass"]
    good = client.post("/api/chapters/1/challenge/run", json={"code": 'console.log("Halo, aku Nosi");\nconsole.log(2025 - 2010);'}).json()
    assert good["all_pass"] and good["chapter_done"] and good["next_chapter"]["number"] == 2
    assert client.get("/api/chapters/2").status_code == 200  # Bab 2 unlocked
    home = client.get("/api/home").json()
    assert home["continue"]["chapter"]["number"] == 2 and not home["first_time"]


def test_placement_skips_bab1(client):
    register(client)
    r = client.post("/api/onboarding", json={"goal": "sekolah", "placement": "a", "daily_goal_min": 20}).json()
    assert r["start"]["number"] == 2 and r["skipped"]["number"] == 1
    home = client.get("/api/home").json()
    assert home["first_time"] and home["continue"]["chapter"]["number"] == 2


def test_ulangan_resume_and_submit(client):
    login(client, "salsa@smksig.sch.id")  # Bab 2 finished via challenge, Ulangan still available for practice
    s = client.post("/api/chapters/2/ulangan/start").json()["session"]
    again = client.post("/api/chapters/2/ulangan/start").json()["session"]
    assert again["id"] == s["id"]  # resumable
    client.put(f"/api/ulangan/{s['id']}/answers", json={"qid": "u1", "answer": 1})
    client.put(f"/api/ulangan/{s['id']}/flags", json={"flags": ["u2"]})
    again = client.post("/api/chapters/2/ulangan/start").json()["session"]
    assert again["answers"] == {"u1": 1} and again["flags"] == ["u2"]
    final = {"u2": 2, "u3": "let", "u4": 1, "u5": "const harga = 50000;\nconst diskon = 10000;\nconsole.log(harga - diskon);",
             "u6": 2, "u7": 2, "u8": 1}
    res = client.post(f"/api/ulangan/{s['id']}/submit", json={"answers": final}).json()
    assert res["result"]["score"] == 90 and res["result"]["passed"]
    wrong = [r for r in res["result"]["rows"] if not r["ok"]]
    assert len(wrong) == 1 and "seharusnya 2" in wrong[0]["note"]
    assert client.put(f"/api/ulangan/{s['id']}/answers", json={"qid": "u1", "answer": 0}).status_code == 409
