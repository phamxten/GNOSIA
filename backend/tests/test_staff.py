"""Mentor signals from the seeded class, review decisions, admin flags and publishing."""
from .conftest import login


def test_mentor_signals(client):
    login(client, "dimas@smksig.sch.id")
    ov = client.get("/api/mentor/overview").json()
    kinds = {(a["learner"]["name"].split()[0], a["kind"]) for a in ov["attention"]}
    assert ("Alex", "repeated") in kinds
    assert ("Rizky", "gate") in kinds
    assert ("Maya", "hints") in kinds
    assert ("Bayu", "stalled") in kinds
    alex = next(a for a in ov["attention"] if a["kind"] == "repeated" and a["learner"]["name"].startswith("Alex"))
    assert "4×" in alex["html"] and alex["pattern"] == "jawaban yang sama setiap kali"
    assert ov["attention"][0]["kind"] == "repeated"  # most in need first
    assert ov["kpis"]["review"] >= 2 and ov["kpis"]["total"] >= 32  # other tests register new learners into this class
    assert ov["funnel"]["pile"]["phase"] == "perkuat"
    assert ov["hardest"][0]["key"] in ("salinan", "const")


def test_learner_cannot_open_mentor(client):
    login(client, "nadia@smksig.sch.id")
    assert client.get("/api/mentor/overview").status_code == 403
    assert client.get("/api/admin/overview").status_code == 403


def test_review_and_approve(client):
    login(client, "dimas@smksig.sch.id")
    q = client.get("/api/mentor/review").json()["items"]
    sub = next(i for i in q if i["status"] == "pending" and "milestone" in i["title"])
    c = client.post(f"/api/mentor/submissions/{sub['id']}/comments", json={"line": 3, "body": "Nama jelas!"}).json()
    assert c["line"] == 3
    d = client.post(f"/api/mentor/submissions/{sub['id']}/decision", json={"decision": "approve", "summary": "Lanjut ke milestone 2."}).json()
    assert d["status"] == "approved"
    login(client, "salsa@smksig.sch.id")
    p = client.get("/api/projects/1").json()
    assert p["milestone"] == 1 and p["status"] == "work" and any(m["body"] == "Lanjut ke milestone 2." for m in p["thread"])


def test_admin_overview_and_publish(client):
    login(client, "sekar@smksig.sch.id")
    ov = client.get("/api/admin/overview").json()
    titles = " ".join(f["title"] for f in ov["flags"])
    assert "temukan bug const" in titles  # 58%-ish wrong on first try
    assert ov["kpis"]["published"] == 2 and ov["kpis"]["chapters"] == 8
    ch = client.get("/api/admin/chapters/2").json()
    assert ch["version"] == 3 and not ch["problems"]
    draft = ch["draft"]
    draft["perkuat"]["items"][0]["title"] = "Skor akan bertambah. Baris mana yang tepat?"
    assert client.put("/api/admin/chapters/2/draft", json={"draft": draft}).json()["next_version"] == 4
    assert client.post("/api/admin/chapters/2/publish").json()["version"] == 4
    empty = client.post("/api/admin/chapters/4/publish")
    assert empty.status_code == 422 and empty.json()["detail"]["problems"]
