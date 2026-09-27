from __future__ import annotations

import copy
import json
import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path as FsPath
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import Base, SessionLocal, engine
from ..models import (Attempt, Chapter, ChapterProgress, ChapterVersion, Concept, ConceptMastery, ContentReport, DailyActivity,
                      ExamSession, HintOpen, Klass, MasterySnapshot, Message, Notebook, Notification, Organization, Path, PlayerState, Project,
                      ProjectProgress, QuizRound, Submission, User, XpEvent)
from ..security import hash_password
from ..services import content as content_svc, unlock
from ..services.activity import local_today
from . import bab1_halo, bab2_variabel

HERE = FsPath(__file__).parent
NOW = datetime.now(timezone.utc)
rng = random.Random(20260927)


def ago(days: float = 0, hours: float = 0, minutes: float = 0) -> datetime:
    return NOW - timedelta(days=days, hours=hours, minutes=minutes)


# ---------------------------------------------------------------- curriculum
CONCEPTS = [
    # key, name, skill, chapter slug, x, y, requires
    ("consolelog", "console.log", "Menampilkan output", "halo", 120, 110, []),
    ("komentar", "komentar", "Menulis komentar", "halo", 220, 220, ["consolelog"]),
    ("urutan", "urutan", "Urutan perintah", "halo", 110, 330, ["consolelog"]),
    ("let", "let", "Membuat variabel", "variabel", 360, 120, ["consolelog"]),
    ("assign", "operator =", "Mengganti nilai", "variabel", 520, 380, ["penamaan"]),
    ("const", "const", "let vs const", "variabel", 430, 250, ["let"]),
    ("hitung", "hitungan", "Variabel dalam hitungan", "variabel", 360, 420, ["assign"]),
    ("penamaan", "penamaan", "Penamaan yang valid", "variabel", 300, 330, ["let"]),
    ("salinan", "salinan nilai", "Salinan nilai", "variabel", 560, 170, ["let", "const"]),
    ("string", "string", "Teks (string)", "tipe-data", 650, 320, ["number", "assign"]),
    ("number", "number", "Angka (number)", "tipe-data", 720, 150, ["salinan"]),
    ("boolean", "boolean", "Benar/salah (boolean)", "tipe-data", 820, 260, ["number"]),
    ("ifelse", "if / else", "Percabangan if / else", "percabangan", 880, 110, ["boolean"]),
    ("for", "for", "Perulangan for", "perulangan", 930, 390, ["ifelse"]),
]

CHAPTERS = [
    # position, number, kind, slug, title, subtitle, icon, module, x
    (1, 1, "chapter", "halo", "Halo, JavaScript", "console.log, komentar", "hand", "Modul 1 · Fondasi", 30),
    (2, 2, "chapter", "variabel", "Variabel", "let, const, penamaan", "box", "", 64),
    (3, 0, "project", "proyek-uang-saku", "Proyek · Kalkulator Uang Saku", "milestone + review mentor", "folder-kanban", "", 40),
    (4, 3, "chapter", "tipe-data", "Tipe Data", "string, number, boolean", "shapes", "", 72),
    (5, 4, "chapter", "operator", "Operator", "aritmetika, perbandingan", "plus-minus", "Modul 2 · Logika", 34),
    (6, 5, "chapter", "percabangan", "Percabangan", "if, else, switch", "git-branch", "", 58),
    (7, 6, "chapter", "perulangan", "Perulangan", "for, while", "repeat", "", 28),
    (8, 7, "chapter", "fungsi", "Fungsi", "parameter, return", "function-square", "Modul 3 · Struktur", 62),
    (9, 8, "chapter", "array", "Array", "daftar, index, loop", "layout-list", "", 36),
    (10, 0, "final", "ujian-akhir", "Ujian Akhir Jalur", "sertifikat", "award", "", 60),
]

DESCRIPTIONS = {
    "halo": "Program pertamamu: menyuruh komputer menampilkan sesuatu dengan <span class=\"ic\">console.log</span>, menulis catatan dengan komentar, dan memahami bahwa perintah dijalankan berurutan dari atas.",
    "variabel": "Cara program menyimpan dan mengingat nilai: membuat kotak berlabel, mengganti isinya, menguncinya dengan <span class=\"ic\">const</span>, dan memakainya dalam hitungan.",
    "tipe-data": "Setiap nilai punya jenis: teks, angka, atau benar/salah. Jenisnya menentukan apa yang bisa dilakukan dengannya.",
    "operator": "Menghitung dan membandingkan nilai: + − × ÷, sisa bagi, serta === dan !==.",
    "percabangan": "Membuat program memilih jalan: if, else, dan switch.",
    "perulangan": "Mengulang perintah tanpa menulisnya berkali-kali: for dan while.",
    "fungsi": "Membungkus langkah menjadi perintah baru yang bisa dipakai ulang, dengan parameter dan return.",
    "array": "Menyimpan banyak nilai dalam satu daftar, mengambilnya lewat index, dan mengolahnya dengan loop.",
}

PROJECT = {
    "slug": "uang-saku", "title": "Kalkulator Uang Saku", "number": 1, "unlock_after": 2,
    "description": "Aplikasi kecil untuk mencatat pemasukan dan jajan, lalu menghitung sisa uang per minggu. Memakai variabel, operator, percabangan, dan fungsi.",
    "milestones": [
        {"title": "Data uang saku", "topic": "variabel", "filename": "uang-saku.js",
         "starter": "// Milestone 1 · data uang saku\n",
         "reqs": [{"text": 'Simpan <span class="t-mono">uangSaku</span> = 100000 dengan const', "tests": ["m1a"]},
                  {"text": "Simpan jajan tiga hari dalam variabel", "tests": ["m1b"]},
                  {"text": "Cetak uang saku", "tests": ["m1c"]}],
         "tests": [{"id": "m1a", "name": "uangSaku = 100000", "kind": "expr", "expr": "uangSaku === 100000", "fail": "uangSaku ${uangSaku}"},
                   {"id": "m1b", "name": "ada variabel jajan", "kind": "source_regex", "pattern": r"(let|const)\s+jajan", "fail": "belum ada variabel jajan"},
                   {"id": "m1c", "name": "uang saku tercetak", "kind": "stdout_includes", "text": "100000", "fail": "100000 belum tampil di output"}]},
        {"title": "Hitung sisa", "topic": "operator", "filename": "uang-saku.js",
         "starter": "// Milestone 2 · hitung sisa\n",
         "reqs": [{"text": "Hitung total jajan dari 3 hari", "tests": ["m2a"]},
                  {"text": 'Simpan <span class="t-mono">sisa</span> = uang saku − total', "tests": ["m2b"]},
                  {"text": "Cetak laporan dengan format rupiah", "tests": ["m2c"]}],
         "tests": [{"id": "m2a", "name": "total jajan = 57000", "kind": "expr", "expr": "total === 57000", "fail": "total ${total}"},
                   {"id": "m2b", "name": "sisa = 43000", "kind": "expr", "expr": "sisa === 43000", "fail": "sisa ${sisa}"},
                   {"id": "m2c", "name": "format “Rp43.000”", "kind": "stdout_includes", "text": "Rp43.000", "fail": "belum ada “Rp43.000” di output"}]},
        {"title": "Peringatan boros", "topic": "percabangan", "filename": "uang-saku.js",
         "starter": "// Milestone 3 · peringatan boros\n",
         "reqs": [{"text": 'Jika sisa di bawah 50000, cetak kata <span class="t-mono">boros</span>', "tests": ["m3a"]},
                  {"text": "Pakai if / else", "tests": ["m3b"]}],
         "tests": [{"id": "m3a", "name": "peringatan “boros” muncul", "kind": "stdout_includes", "text": "boros", "fail": "belum ada peringatan"},
                   {"id": "m3b", "name": "memakai if", "kind": "source_regex", "pattern": r"\bif\s*\(", "fail": "belum ada if"}]},
        {"title": "Rapikan jadi fungsi", "topic": "fungsi", "filename": "uang-saku.js",
         "starter": "// Milestone 4 · rapikan jadi fungsi\n",
         "reqs": [{"text": 'Buat fungsi <span class="t-mono">hitungSisa(uang, jajan)</span>', "tests": ["m4a", "m4b"]}],
         "tests": [{"id": "m4a", "name": "ada fungsi hitungSisa", "kind": "expr", "expr": "typeof hitungSisa === 'function'", "fail": "fungsi belum ada"},
                   {"id": "m4b", "name": "hitungSisa(100000, 57000) = 43000", "kind": "expr", "expr": "hitungSisa(100000, 57000) === 43000", "fail": "hasilnya belum 43000"}],
         "portfolio": {"headline": "Rp43.000", "caption": "Uang saku minggu ini", "pct": 43, "warning": "Jajan Rabu melebihi rata-rata"}},
    ],
}


def percabangan_draft() -> dict[str, Any]:
    c = content_svc.empty_content()
    c["concepts"] = ["ifelse"]
    c["pahami"]["scenes"] = [
        {"id": "s1", "kicker": "", "title": "Program bisa <em>memilih jalan</em>.",
         "lead": "Kadang program harus melakukan hal berbeda tergantung keadaan: lulus atau belum, siang atau malam.",
         "visual": {"type": "intro", "side": {"kind": "bubble", "text": "Lulus!"},
                    "objectives_label": "Setelah bagian ini kamu bisa",
                    "objectives": ['Menulis <span class="ic">if</span> dan <span class="ic">else</span>', "Membaca syarat yang bernilai true atau false"]},
         "advance": "free", "concepts": ["ifelse"]},
        {"id": "s2", "kicker": "Ringkasan", "title": "Yang perlu kamu ingat.",
         "visual": {"type": "summary", "cards": [{"icon": "git-branch", "title": "if memilih", "body": "Blok dijalankan jika syaratnya true."}]},
         "advance": "free", "concepts": []},
    ]
    return c


# ---------------------------------------------------------------- helpers
def wrong_answer(item: dict[str, Any]) -> Any:
    """A plausible wrong answer for a Perkuat item (what a learner might really pick)."""
    t, key = item["type"], item.get("answer")
    if t in ("choice", "predict"):
        return rng.choice([i for i in range(len(item["choices"])) if i != key])
    if t == "bug":
        others = [i for i in range(1, len(item["lines"]) + 1) if i != key]
        return 1 if 1 in others and rng.random() < .5 else rng.choice(others)  # "the bug is in the declaration"
    if t == "fill":
        return ["const", "="] if key and key[0] == "let" else list(reversed(key or []))
    if t == "parsons":
        k = list(key or [])
        if len(k) >= 3:
            k[1], k[2] = k[2], k[1]
        return k
    if t == "slider":
        return (key or 1) - 1
    return None


class Seeder:
    def __init__(self, db: Session):
        self.db = db
        self.ch: dict[str, Chapter] = {}
        self.content: dict[str, dict[str, Any]] = {}
        self.concepts: dict[str, Concept] = {}
        self.kuis_seen: dict[tuple[int, str], int] = {}

    def add(self, obj):
        self.db.add(obj)
        return obj

    # --- rows
    def xp(self, u: User, amount: int, reason: str, when: datetime) -> None:
        self.add(XpEvent(user_id=u.id, amount=amount, reason=reason, created_at=when))

    def minutes(self, u: User, days_ago: int, mins: int) -> None:
        day = local_today() - timedelta(days=days_ago)
        row = self.db.scalar(select(DailyActivity).where(DailyActivity.user_id == u.id, DailyActivity.day == day))
        if row:
            row.seconds += mins * 60
        else:
            self.add(DailyActivity(user_id=u.id, day=day, seconds=mins * 60))

    def attempt(self, u: User, slug: str, phase: str, item: str, correct: bool, when: datetime, n: int = 1, answer: Any = None,
                hint: int = 0, ms: int = 9000) -> None:
        self.add(Attempt(user_id=u.id, chapter_id=self.ch[slug].id, phase=phase, item_id=item, attempt_no=n, correct=correct,
                         answer=answer, hint_level=hint, ms=ms, version=self.ch[slug].version, created_at=when))

    def mastery(self, u: User, key: str, tier: int, weak: bool = False, phase: str = "", note: str = "", when: datetime | None = None) -> None:
        c = self.concepts[key]
        row = self.db.scalar(select(ConceptMastery).where(ConceptMastery.user_id == u.id, ConceptMastery.concept_id == c.id))
        if row is None:
            row = self.add(ConceptMastery(user_id=u.id, concept_id=c.id, tier=0))
            self.db.flush()
        row.tier = max(row.tier, tier)
        if weak:
            row.weak, row.weak_phase, row.weak_note = True, phase, note
        row.updated_at = when or NOW

    def progress(self, u: User, slug: str, done_until: str | None, current_progress: float = 0.0, started: datetime = NOW,
                 completed: datetime | None = None, since: datetime | None = None, updated: datetime | None = None,
                 scores: dict[str, float] | None = None, active_min: int = 0) -> ChapterProgress:
        """done_until: last phase that is done (None = nothing done, 'uji' = chapter complete)."""
        phases = unlock.initial_phases()
        order = list(unlock.PHASES)
        if done_until:
            for ph in order[: order.index(done_until) + 1]:
                phases = unlock.complete(phases, ph, (scores or {}).get(ph))
        cur = unlock.current_phase(phases)
        if not unlock.is_chapter_done(phases):
            phases[cur]["progress"] = current_progress
            if cur == "kuis" and (scores or {}).get("kuis_best") is not None:
                phases["kuis"]["score"] = scores["kuis_best"]
        p = self.add(ChapterProgress(user_id=u.id, chapter_id=self.ch[slug].id, version=self.ch[slug].version, phases=phases,
                                     current=cur, started_at=started, completed_at=completed, phase_since=since or started,
                                     updated_at=updated or since or started, active_seconds=active_min * 60))
        return p

    def state(self, u: User, slug: str, phase: str, data: dict[str, Any], when: datetime) -> None:
        self.add(PlayerState(user_id=u.id, chapter_id=self.ch[slug].id, phase=phase, data=data, updated_at=when))

    def kuis_round(self, u: User, slug: str, wrong: list[str], when: datetime, kind: str = "gate", picks: list[str] | None = None) -> QuizRound:
        bank = self.content[slug]["kuis"]["bank"]
        if picks:
            ids = list(picks)
        else:
            others = [q["id"] for q in bank if q["id"] not in wrong]
            ids = list(dict.fromkeys(wrong))[:10] + rng.sample(others, 10 - min(10, len(set(wrong))))
            rng.shuffle(ids)
        answers, score, combo, best = [], 0, 1, 1
        for i, qid in enumerate(ids):
            q = next(x for x in bank if x["id"] == qid)
            ok = qid not in wrong
            left = rng.randint(6, 16)
            pts = (100 * combo + left * 5) if ok else 0
            score += pts
            combo = min(3, combo + 1) if ok else 1
            best = max(best, combo)
            choice = q["a"] if ok else (q["a"] + 1) % len(q["o"])
            answers.append({"qid": qid, "chapter_id": self.ch[slug].id, "choice": choice, "correct": ok, "left": left, "points": pts,
                            "at": (when + timedelta(seconds=8 * i)).isoformat()})
            self.kuis_seen[(u.id, qid)] = n = self.kuis_seen.get((u.id, qid), 0) + 1
            self.attempt(u, slug, "kuis", qid, ok, when + timedelta(seconds=8 * i), n=n, answer=choice, ms=(20 - left) * 1000)
        pct = round(100 * sum(1 for a in answers if a["correct"]) / len(answers))
        r = self.add(QuizRound(user_id=u.id, chapter_id=self.ch[slug].id, kind=kind, version=self.ch[slug].version,
                               question_refs=[[self.ch[slug].id, qid] for qid in ids], answers=answers, score=score, combo=combo,
                               best_combo=best, finished=True, pct=pct, passed=pct >= 70, created_at=when))
        return r

    def perkuat_run(self, u: User, slug: str, upto: int, when: datetime, wrong_first: dict[str, int] | None = None,
                    answers: dict[str, Any] | None = None) -> dict[str, Any]:
        """Simulates Perkuat items [0, upto) with first-try results. Returns the PlayerState data."""
        items = self.content[slug]["perkuat"]["items"]
        base = [i for i in items if not i.get("adaptive")]
        order = [i["id"] for i in base]
        data = {"order": list(order), "index": min(upto, len(order) - 1), "solved": {}, "attempts": {}, "hint": {}, "first_try": {},
                "inserted": [], "inserted_for": []}
        t = when
        for it in base[:upto]:
            iid = it["id"]
            wrongs = (wrong_first or {}).get(iid, 0)
            for k in range(wrongs):
                given = (answers or {}).get(iid, wrong_answer(it))
                self.attempt(u, slug, "perkuat", iid, False, t, n=k + 1, answer=given, hint=3 if k else 0)
                t += timedelta(seconds=40)
            self.attempt(u, slug, "perkuat", iid, True, t, n=wrongs + 1, answer=it.get("answer"))
            t += timedelta(seconds=50)
            data["solved"][iid] = True
            data["first_try"][iid] = wrongs == 0
            data["attempts"][iid] = wrongs + 1
            if wrongs:
                data["hint"][iid] = 3
                sim = it.get("similar_id")
                if sim and sim not in data["order"]:
                    data["order"].insert(data["order"].index(iid) + 1, sim)
                    data["inserted"].append(sim)
                    data["inserted_for"].append(iid)
                    self.attempt(u, slug, "perkuat", sim, True, t, n=1, answer=None)
                    data["solved"][sim] = True
                    data["first_try"][sim] = True
                    data["attempts"][sim] = 1
            self.xp(u, 10 if wrongs == 0 else 5, f"Perkuat · {self.ch[slug].title}", t)
        nxt = base[upto]["id"] if upto < len(base) else base[-1]["id"]
        data["index"] = data["order"].index(nxt)
        return data


# ---------------------------------------------------------------- main
def run(reset: bool = False) -> None:
    if reset:
        if engine.dialect.name == "sqlite" and engine.url.database:
            engine.dispose()
            for suffix in ("", "-wal", "-shm"):
                FsPath(engine.url.database + suffix).unlink(missing_ok=True)
        else:
            from sqlalchemy import text
            with engine.begin() as conn:  # CASCADE handles the users <-> classes foreign-key cycle
                for t in reversed(Base.metadata.sorted_tables):
                    conn.execute(text(f'DROP TABLE IF EXISTS "{t.name}" CASCADE'))
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        if db.scalar(select(User).limit(1)):
            print("Database sudah berisi data. Jalankan dengan --reset untuk mengulang seed.")
            return
        s = Seeder(db)
        seed_all(s)
        db.commit()
        print("Seed selesai.")
        cfg = json.loads((HERE / "users.json").read_text(encoding="utf-8"))
        shown = "dari GNOSIA_DEMO_PASSWORD" if os.environ.get("GNOSIA_DEMO_PASSWORD") else cfg["password"]
        print(f"Akun demo (kata sandi: {shown}):")
        for p in cfg["staff"] + cfg["learners"]:
            print(f"  {p.get('role', 'learner'):8} {p['email']}")
    finally:
        db.close()


def seed_all(s: Seeder) -> None:
    db = s.db
    cfg = json.loads((HERE / "users.json").read_text(encoding="utf-8"))
    # A public deployment (e.g. behind a tunnel) sets its own demo password instead of the documented test one.
    pw = hash_password(os.environ.get("GNOSIA_DEMO_PASSWORD") or cfg["password"])
    org = s.add(Organization(name=cfg["org"]))
    path = s.add(Path(slug="js-dasar", title="JavaScript Dasar", description="Dari console.log sampai array. 8 bab, 1 proyek, 1 ujian akhir."))
    db.flush()

    # staff
    staff = {}
    for p in cfg["staff"]:
        staff[p["role"]] = s.add(User(email=p["email"], name=p["name"], password_hash=pw, role=p["role"], org_id=org.id, avatar=p["avatar"],
                                      title=p["title"], onboarded=True, prefs={}, created_at=ago(120), last_active_at=ago(hours=1)))
    db.flush()
    admin, mentor = staff["admin"], staff["mentor"]

    # project + chapters
    proj = s.add(Project(path_id=path.id, slug=PROJECT["slug"], title=PROJECT["title"], number=PROJECT["number"],
                         unlock_after=PROJECT["unlock_after"], description=PROJECT["description"], milestones=PROJECT["milestones"]))
    db.flush()
    contents = {"halo": bab1_halo.CONTENT, "variabel": bab2_variabel.CONTENT}
    for pos, num, kind, slug, title, sub, icon, module, x in CHAPTERS:
        draft = copy.deepcopy(contents.get(slug)) if slug in contents else (percabangan_draft() if slug == "percabangan" else content_svc.empty_content())
        ch = s.add(Chapter(path_id=path.id, position=pos, number=num, kind=kind, slug=slug, title=title, subtitle=sub, icon=icon,
                           module_label=module, map_x=x, description=DESCRIPTIONS.get(slug, ""), draft=draft if kind == "chapter" else {},
                           project_id=proj.id if kind == "project" else None, status="draft", version=0,
                           updated_by=admin.id, updated_at=ago(days=rng.randint(4, 20))))
        db.flush()
        s.ch[slug] = ch
        if slug in contents:
            versions = 3 if slug == "variabel" else 1
            for v in range(1, versions + 1):
                s.add(ChapterVersion(chapter_id=ch.id, version=v, content=copy.deepcopy(contents[slug]), published_by=admin.id,
                                     published_at=ago(days=30 - 8 * v)))
            ch.version, ch.status = versions, "published"
            s.content[slug] = contents[slug]
    s.ch["variabel"].updated_at = ago(hours=2)
    s.ch["percabangan"].status = "review"
    s.ch["percabangan"].updated_by = mentor.id
    s.ch["percabangan"].updated_at = ago(days=1, hours=3)
    for key, name, skill, slug, x, y, req in CONCEPTS:
        s.concepts[key] = s.add(Concept(path_id=path.id, key=key, name=name, skill=skill, chapter_id=s.ch[slug].id, x=x, y=y, requires=req))
    db.flush()

    # classes
    xii = s.add(Klass(org_id=org.id, name="XII RPL", path_id=path.id, mentor_id=mentor.id, started_on=local_today() - timedelta(weeks=5, days=2)))
    xi = s.add(Klass(org_id=org.id, name="XI RPL 1", path_id=path.id, mentor_id=mentor.id, started_on=local_today() - timedelta(weeks=1)))
    db.flush()
    admin.class_id = None
    admin.org_id = mentor.org_id = org.id

    people = {}
    for p in cfg["learners"]:
        people[p["story"]] = s.add(User(email=p["email"], name=p["name"], password_hash=pw, role="learner", org_id=org.id, class_id=xii.id,
                                        avatar=p["avatar"], onboarded=True, goal="sekolah", daily_goal_min=20,
                                        prefs={"nosi": True, "reminders": True, "mentor_sees_wrong": True, "language": "id"},
                                        created_at=ago(days=46 + rng.randint(0, 6)), last_active_at=ago(hours=3)))
    db.flush()
    story_nadia(s, people["nadia"], mentor)
    story_alex(s, people["alex"], mentor)
    story_rizky(s, people["rizky"])
    story_maya(s, people["maya"])
    story_bayu(s, people["bayu"])
    story_salsa(s, people["salsa"], mentor, proj)
    generic_class(s, xii, 26, pw, org)
    generic_class(s, xi, 4, pw, org, only_bab1=True)
    # learner reports on the Papan Skor output test (admin content flag)
    learners = list(db.scalars(select(User).where(User.role == "learner")))
    for u in [x for x in learners if x.class_id == xii.id][:4]:
        s.add(ContentReport(user_id=u.id, chapter_id=s.ch["variabel"].id, item_id="t4", body="Output sudah Garuda: 6 tapi tes gagal (ada spasi di akhir).",
                            created_at=ago(days=rng.randint(1, 5))))
    db.flush()
    from ..services.learning import snapshot_mastery
    for u in learners:
        snapshot_mastery(db, u, path.id)


def finish_bab1(s: Seeder, u: User, start_days: int, mentor: User | None = None, kuis_wrong: list[str] | None = None,
                perkuat_wrong: dict[str, int] | None = None, approve: bool = True) -> None:
    t0 = ago(days=start_days)
    s.state(u, "halo", "pahami", {"scene": 6, "max_scene": 6}, t0 + timedelta(minutes=6))
    s.xp(u, 50, "pahami selesai · Halo, JavaScript", t0 + timedelta(minutes=6))
    data = s.perkuat_run(u, "halo", 7, t0 + timedelta(minutes=8), perkuat_wrong or {})
    s.state(u, "halo", "perkuat", data, t0 + timedelta(minutes=16))
    s.xp(u, 75, "perkuat selesai · Halo, JavaScript", t0 + timedelta(minutes=16))
    first = sum(1 for i in data["order"] if i not in data["inserted"] and data["first_try"].get(i))
    acc = round(100 * first / 7)
    r = s.kuis_round(u, "halo", kuis_wrong or [], t0 + timedelta(days=1))
    s.xp(u, r.score // 20, "Kuis · Halo, JavaScript", t0 + timedelta(days=1))
    s.xp(u, 60, "kuis selesai · Halo, JavaScript", t0 + timedelta(days=1))
    code = '// Kartu perkenalan Nosi\nconsole.log("Halo, aku Nosi");\nconsole.log(2025 - 2010);\n'
    s.attempt(u, "halo", "challenge", "challenge", False, t0 + timedelta(days=1, minutes=10), n=1,
              answer={"code": code.replace("2025 - 2010", "15"), "passed": 3, "total": 4, "error": None})
    s.attempt(u, "halo", "challenge", "challenge", True, t0 + timedelta(days=1, minutes=14), n=2, answer={"code": code, "passed": 4, "total": 4, "error": None})
    done_at = t0 + timedelta(days=1, minutes=14)
    s.xp(u, 180, "Bab selesai · Halo, JavaScript", done_at)
    s.progress(u, "halo", "uji", started=t0, completed=done_at, scores={"perkuat": acc, "kuis": r.pct, "uji": 100}, active_min=rng.randint(24, 36))
    s.add(Submission(user_id=u.id, kind="challenge", chapter_id=s.ch["halo"].id, title="Challenge · Bab 1 · Kartu perkenalan", filename="kenalan.js",
                     code=code, attempt_no=2, tests_passed=4, tests_total=4, status="approved" if approve else "pending",
                     reviewed_by=mentor.id if (mentor and approve) else None, reviewed_at=done_at + timedelta(hours=5) if approve else None,
                     created_at=done_at))
    if approve and mentor:
        s.xp(u, 30, "Challenge disetujui mentor", done_at + timedelta(hours=5))
    for k in ("consolelog", "urutan"):
        s.mastery(u, k, 5, when=done_at)
    s.mastery(u, "komentar", 4, when=done_at)
    for w in kuis_wrong or []:
        q = next(x for x in s.content["halo"]["kuis"]["bank"] if x["id"] == w)
        for k in q.get("concepts", []):
            s.mastery(u, k, 3, weak=True, phase="kuis", note=f"Kamu menjawab {q['o'][(q['a'] + 1) % len(q['o'])]}, seharusnya {q['o'][q['a']]}.", when=done_at)


def bab2_pahami(s: Seeder, u: User, start: datetime) -> None:
    s.state(u, "variabel", "pahami", {"scene": 7, "max_scene": 7}, start + timedelta(minutes=7))
    s.xp(u, 50, "pahami selesai · Variabel", start + timedelta(minutes=7))
    for k in ("let", "assign", "const", "hitung", "penamaan", "salinan"):
        s.mastery(u, k, 1, when=start)


def story_nadia(s: Seeder, u: User, mentor: User) -> None:
    u.last_active_at = ago(minutes=12)
    finish_bab1(s, u, 20, mentor, kuis_wrong=["h12"], perkuat_wrong={"b4": 1})
    start = ago(days=5, hours=4)
    bab2_pahami(s, u, start)
    t = ago(hours=20)
    data = s.perkuat_run(u, "variabel", 3, t, wrong_first={"q2": 2}, answers={"q2": ["const", "="]})
    s.state(u, "variabel", "perkuat", data, ago(minutes=12))
    s.progress(u, "variabel", "pahami", current_progress=0.375, started=start, since=start + timedelta(minutes=7), updated=ago(minutes=12), active_min=19)
    s.mastery(u, "let", 2, weak=True, phase="perkuat", note="Salah 2× di soal “Lengkapi umur”. Kotak mana yang digembok?", when=ago(hours=19))
    s.mastery(u, "const", 2, weak=True, phase="perkuat", note="Salah 2× di soal “Lengkapi umur”. Kotak mana yang digembok?", when=ago(hours=19))
    s.mastery(u, "assign", 2)
    s.mastery(u, "hitung", 2)
    # 12-day streak (goal 20 min), 15 minutes so far today
    for d in range(1, 13):
        s.minutes(u, d, rng.randint(21, 34))
    for d in range(15, 30):
        s.minutes(u, d, rng.randint(8, 30))
    s.minutes(u, 0, 15)
    for d in range(1, 6):
        s.xp(u, 20, "Kuis harian", ago(days=d, hours=2))
    weeks = [14, 19, 24, 29, 33, 39, 46]
    today = local_today()
    monday = today - timedelta(days=today.weekday())
    for i, pct in enumerate(weeks):
        s.add(MasterySnapshot(user_id=u.id, week_start=monday - timedelta(weeks=7 - i), pct=pct))
    s.add(Message(learner_id=u.id, author_id=mentor.id, context="Challenge Kartu perkenalan", read=False, created_at=ago(hours=2),
                  body='Bagus, output kartu kenalanmu rapi sekali dan umurnya dihitung, bukan diketik. Coba tantangan bonus: tambah baris ketiga berisi hobimu.'))
    s.add(Notification(user_id=u.id, kind="message", title="Pesan dari Dimas", body="Bagus, output kartu kenalanmu rapi sekali…", link="/beranda", created_at=ago(hours=2)))
    s.add(Notebook(user_id=u.id, title="Coretan uang saku", attached_chapter_id=s.ch["variabel"].id, created_at=ago(days=3), updated_at=ago(days=1),
                   cells=[{"id": "n1", "type": "note", "src": "Minggu ini aku mau hitung sisa uang saku setelah jajan. Pakai <b>variabel</b> dari Bab 2."},
                          {"id": "c1", "type": "code", "src": 'const uangSaku = 50000;\nlet jajan = 12000 + 8000;\nlet sisa = uangSaku - jajan;\nconsole.log("Sisa:", sisa);'},
                          {"id": "c2", "type": "code", "src": 'const hari = ["Sen", "Sel", "Rab"];\nfor (const h of hari) {\n  console.log(h, "hemat", sisa / 3);\n}'},
                          {"id": "c3", "type": "code", "src": '// sengaja salah ketik untuk lihat diagnostik\nconsole.log("Total jajan:", jajn);'}]))
    s.add(Notebook(user_id=u.id, title="Eksperimen string", created_at=ago(days=9), updated_at=ago(days=8),
                   cells=[{"id": "c1", "type": "code", "src": 'console.log("Halo" + " " + "Nadia");'}]))
    s.add(Notebook(user_id=u.id, title="Tebak angka (game)", created_at=ago(days=12), updated_at=ago(days=11),
                   cells=[{"id": "c1", "type": "code", "src": 'const rahasia = 7;\nconsole.log("Tebakan 5 benar?", 5 === rahasia);'}]))


def story_alex(s: Seeder, u: User, mentor: User) -> None:
    u.last_active_at = ago(hours=2)
    finish_bab1(s, u, 16, mentor, kuis_wrong=["h8", "h13"])
    start = ago(days=4)
    bab2_pahami(s, u, start)
    data = s.perkuat_run(u, "variabel", 3, ago(days=1), wrong_first={"q1": 1})
    wrong_order = ["1", "3", "2", "4"]
    for k in range(4):
        s.attempt(u, "variabel", "perkuat", "q4", False, ago(hours=2, minutes=40 - 9 * k), n=k + 1, answer=wrong_order, hint=min(5, 3 + k))
    data["attempts"]["q4"] = 4
    data["hint"]["q4"] = 5
    data["index"] = data["order"].index("q4")
    data["order"].insert(data["order"].index("q4") + 1, "q4b")
    data["inserted"].append("q4b")
    data["inserted_for"].append("q4")
    s.state(u, "variabel", "perkuat", data, ago(hours=2, minutes=13))
    s.progress(u, "variabel", "pahami", current_progress=0.25, started=start, since=start + timedelta(minutes=9), updated=ago(hours=2), active_min=26)
    s.mastery(u, "hitung", 2, weak=True, phase="perkuat", note="Salah 4× di soal “Susun total belanja”.")
    s.mastery(u, "let", 2)
    s.mastery(u, "const", 4)
    for d in range(0, 9):
        s.minutes(u, d, rng.randint(10, 30))


def story_rizky(s: Seeder, u: User) -> None:
    u.last_active_at = ago(days=1, hours=3)
    finish_bab1(s, u, 18, None, kuis_wrong=["h3", "h9"])
    start = ago(days=6)
    bab2_pahami(s, u, start)
    data = s.perkuat_run(u, "variabel", 8, ago(days=4), wrong_first={"q5": 1, "q3": 1})
    s.state(u, "variabel", "perkuat", data, ago(days=3))
    s.xp(u, 75, "perkuat selesai · Variabel", ago(days=3))
    r1 = s.kuis_round(u, "variabel", ["k9", "k2", "k16", "k19"], ago(days=2, hours=5))
    r2 = s.kuis_round(u, "variabel", ["k9", "k5", "k13", "k19", "k6"], ago(days=1, hours=4))
    for r in (r1, r2):
        s.xp(u, r.score // 20, "Kuis · Variabel", r.created_at)
    s.progress(u, "variabel", "perkuat", current_progress=0.5, started=start, since=ago(days=3), updated=ago(days=1, hours=4),
               scores={"perkuat": 75, "kuis_best": 60}, active_min=34)
    s.mastery(u, "salinan", 2, weak=True, phase="kuis", note="Kamu menjawab 5, seharusnya 2.")
    s.mastery(u, "const", 3)
    s.mastery(u, "let", 3)
    for d in range(1, 7):
        s.minutes(u, d, rng.randint(12, 28))


def story_maya(s: Seeder, u: User) -> None:
    u.last_active_at = ago(hours=1)
    finish_bab1(s, u, 14, None, kuis_wrong=["h20"])
    start = ago(days=3)
    bab2_pahami(s, u, start)
    data = s.perkuat_run(u, "variabel", 6, ago(hours=5))
    for iid, base_min in (("q4", 70), ("q5", 50), ("q6", 30)):
        for lvl, ms in ((3, 6000), (4, 11000), (5, 17000)):
            s.add(HintOpen(user_id=u.id, chapter_id=s.ch["variabel"].id, item_id=iid, level=lvl, ms_since_shown=ms + rng.randint(0, 5000),
                           created_at=ago(minutes=base_min - lvl)))
        data["hint"][iid] = 5
    s.state(u, "variabel", "perkuat", data, ago(hours=1))
    s.progress(u, "variabel", "pahami", current_progress=0.75, started=start, since=start + timedelta(minutes=8), updated=ago(hours=1), active_min=22)
    for d in range(0, 5):
        s.minutes(u, d, rng.randint(15, 30))


def story_bayu(s: Seeder, u: User) -> None:
    u.last_active_at = ago(days=5, hours=2)
    finish_bab1(s, u, 25, None, kuis_wrong=["h4", "h12", "h17"], perkuat_wrong={"b3": 2, "b5": 1})
    start = ago(days=7)
    s.state(u, "variabel", "pahami", {"scene": 4, "max_scene": 4}, ago(days=5, hours=2))
    s.progress(u, "variabel", None, current_progress=round(3 / 7, 3), started=start, since=start, updated=ago(days=5, hours=2), active_min=9)
    for k in ("let", "assign"):
        s.mastery(u, k, 1)
    for d in (5, 7, 8, 11):
        s.minutes(u, d, rng.randint(8, 22))


def story_salsa(s: Seeder, u: User, mentor: User, proj: Project) -> None:
    u.last_active_at = ago(hours=1)
    finish_bab1(s, u, 22, mentor)
    start = ago(days=9)
    bab2_pahami(s, u, start)
    data = s.perkuat_run(u, "variabel", 8, ago(days=7), wrong_first={"q5": 1})
    s.state(u, "variabel", "perkuat", data, ago(days=6))
    s.xp(u, 75, "perkuat selesai · Variabel", ago(days=6))
    r = s.kuis_round(u, "variabel", ["k15"], ago(days=4))
    s.xp(u, r.score // 20 + 60, "Kuis · Variabel", ago(days=4))
    bug = bab2_variabel.CHALLENGE["starter"] + 'const namaTim = "Garuda";\nconst skor = 0;\n\nskor = skor + 3;\nskor = skor + 3;\n\nconsole.log(namaTim + ": " + skor);\n'
    good = '// Papan skor lomba\nconst namaTim = "Garuda";\nlet skor = 0;\n\nskor = skor + 3;\nskor = skor + 3;\n\nconsole.log(namaTim + ": " + skor);\n'
    s.attempt(u, "variabel", "challenge", "challenge", False, ago(days=1, hours=2), n=1, answer={"code": bug, "passed": 1, "total": 4, "error": None})
    s.attempt(u, "variabel", "challenge", "challenge", True, ago(days=1, hours=1), n=2, answer={"code": good, "passed": 4, "total": 4, "error": None})
    s.state(u, "variabel", "challenge", {"code": good}, ago(days=1, hours=1))
    s.xp(u, 180, "Bab selesai · Variabel", ago(days=1, hours=1))
    s.progress(u, "variabel", "uji", started=start, completed=ago(days=1, hours=1), scores={"perkuat": 88, "kuis": r.pct, "uji": 100}, active_min=33)
    s.add(Submission(user_id=u.id, kind="challenge", chapter_id=s.ch["variabel"].id, title="Challenge · Bab 2 · Papan skor lomba",
                     filename="papan-skor.js", code=good, attempt_no=2, tests_passed=4, tests_total=4, status="pending", created_at=ago(days=1, hours=1)))
    for k, t in (("let", 5), ("const", 5), ("assign", 4), ("hitung", 4), ("penamaan", 4), ("salinan", 4)):
        s.mastery(u, k, t)
    ms_code = ("// Milestone 1 · data uang saku\nconst uangSaku = 100000;\nconst jajanSenin = 15000;\nconst jajanSelasa = 30000;\nconst jajanRabu = 12000;\n"
               'console.log("Uang saku:", uangSaku);\n')
    s.add(ProjectProgress(user_id=u.id, project_id=proj.id, milestone=0, code=ms_code, status="waiting", updated_at=ago(hours=1),
                          last_run={"results": [{"id": "m1a", "pass": True, "detail": "", "ms": 2}, {"id": "m1b", "pass": True, "detail": "", "ms": 1},
                                                {"id": "m1c", "pass": True, "detail": "", "ms": 1}], "logs": ["Uang saku: 100000"], "error": None}))
    s.add(Submission(user_id=u.id, kind="milestone", project_id=proj.id, milestone=0, title="Proyek · Kalkulator Uang Saku · milestone 1",
                     filename="uang-saku.js", code=ms_code, attempt_no=1, tests_passed=3, tests_total=3, status="pending", created_at=ago(hours=1)))
    s.add(Message(learner_id=u.id, author_id=u.id, project_id=proj.id, context="Proyek Kalkulator Uang Saku", read=True, created_at=ago(hours=1),
                  body="Kak, milestone 1 sudah. Nama variabel jajannya sudah jelas belum?"))
    for d in range(0, 14):
        s.minutes(u, d, rng.randint(20, 40))


FIRST = ["Adit", "Bella", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hana", "Indra", "Joko", "Kiki", "Lala", "Mira", "Nando", "Oki", "Putra",
         "Qori", "Rani", "Sinta", "Tegar", "Umi", "Vino", "Wulan", "Yoga", "Zahra", "Arif", "Bima", "Cahya", "Dian", "Elsa"]
LAST = ["Pratama", "Lestari", "Wijaya", "Santoso", "Hidayat", "Kusuma", "Saputri", "Nugroho", "Rahmawati", "Firmansyah", "Permata", "Utami"]
FIRST_TRY_WRONG = {"q1": .12, "q2": .25, "q3": .2, "q4": .35, "q5": .58, "q6": .15, "q7": .1, "q8": .12}
KUIS_WRONG = {"k9": .58, "k5": .3, "k6": .33, "k15": .85, "k4": .45, "k19": .4, "k16": .3}


def generic_class(s: Seeder, klass: Klass, n: int, pw: str, org: Organization, only_bab1: bool = False) -> None:
    plan = (["bab1"] * n) if only_bab1 else (["bab1"] * 3 + ["pahami"] * 4 + ["perkuat"] * 11 + ["kuis"] * 4 + ["uji"] * 3 + ["done"] * 1)
    used = set()
    for i, where in enumerate(plan[:n]):
        while True:
            name = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
            if name not in used:
                used.add(name)
                break
        email = name.lower().replace(" ", ".") + "@smksig.sch.id"
        u = s.add(User(email=email, name=name, password_hash=pw, role="learner", org_id=org.id, class_id=klass.id,
                       avatar=rng.choice(["", "a2", "a3", "a4", "a5"]), onboarded=True, goal="sekolah", daily_goal_min=rng.choice([10, 20, 20, 30]),
                       prefs={"nosi": True, "reminders": True, "mentor_sees_wrong": True, "language": "id"}, created_at=ago(days=40 + rng.randint(0, 8))))
        s.db.flush()
        stalled = where in ("perkuat", "bab1") and i % 7 == 3
        last = ago(days=rng.randint(8, 9)) if stalled else ago(hours=rng.randint(1, 40))
        u.last_active_at = last
        for d in range(0, 9):
            if rng.random() < .75 and ago(days=d) <= last + timedelta(hours=1):
                s.minutes(u, d, rng.randint(8, 35))
        if where == "bab1":
            t = ago(days=rng.randint(3, 9)) if not stalled else last
            s.state(u, "halo", "pahami", {"scene": 6, "max_scene": 6}, t)
            data = s.perkuat_run(u, "halo", rng.randint(1, 5), t)
            s.state(u, "halo", "perkuat", data, t)
            s.progress(u, "halo", "pahami", current_progress=len(data["solved"]) / 7, started=t - timedelta(days=1), since=t, updated=last)
            s.mastery(u, "consolelog", 2)
            continue
        finish_bab1(s, u, rng.randint(12, 24), None, kuis_wrong=rng.sample(["h3", "h8", "h12", "h14", "h20"], rng.randint(0, 2)),
                    perkuat_wrong={k: 1 for k in rng.sample(["b3", "b4", "b5"], rng.randint(0, 2))})
        start = ago(days=rng.randint(5, 9))
        if where == "pahami":
            scene = rng.randint(2, 6)
            s.state(u, "variabel", "pahami", {"scene": scene, "max_scene": scene}, last)
            s.progress(u, "variabel", None, current_progress=(scene - 1) / 7, started=start, since=ago(days=rng.uniform(.5, 2)), updated=last)
            s.mastery(u, "let", 1)
            continue
        bab2_pahami(s, u, start)
        wrong = {k: 1 for k, p in FIRST_TRY_WRONG.items() if rng.random() < p}
        if where == "perkuat":
            upto = rng.randint(2, 7)
            data = s.perkuat_run(u, "variabel", upto, ago(days=rng.randint(1, 3)), {k: v for k, v in wrong.items()})
            s.state(u, "variabel", "perkuat", data, last)
            since = ago(days=rng.uniform(2.5, 4.5)) if not stalled else ago(days=9)
            s.progress(u, "variabel", "pahami", current_progress=upto / 8, started=start, since=since, updated=last)
            for k in ("let", "const", "assign"):
                s.mastery(u, k, 2, weak=rng.random() < .25, phase="perkuat", note="Salah 2× di soal “temukan bug const”.")
            continue
        data = s.perkuat_run(u, "variabel", 8, start + timedelta(days=1), wrong)
        s.state(u, "variabel", "perkuat", data, start + timedelta(days=1))
        acc = round(100 * sum(1 for i in data["first_try"] if data["first_try"][i] and i not in data["inserted"]) / 8)
        s.xp(u, 75, "perkuat selesai · Variabel", start + timedelta(days=1))
        misses = [k for k, p in KUIS_WRONG.items() if rng.random() < p][:3]
        rounds = []
        if where == "kuis" or rng.random() < .3:
            filler = rng.sample([q["id"] for q in bab2_variabel.BANK if q["id"] not in misses and not q.get("trivia")], 5)
            fail_with = (misses + filler)[:5]
            rounds.append(s.kuis_round(u, "variabel", fail_with, start + timedelta(days=2)))  # 50%: not passed
        if where in ("uji", "done"):
            rounds.append(s.kuis_round(u, "variabel", misses, start + timedelta(days=2, hours=3)))
        for r in rounds:
            s.xp(u, r.score // 20, "Kuis · Variabel", r.created_at)
        best = max((r.pct for r in rounds), default=None)
        if where == "kuis":
            s.progress(u, "variabel", "perkuat", current_progress=(best or 0) / 100, started=start, since=ago(days=rng.uniform(.5, 1.8)),
                       updated=last, scores={"perkuat": acc, "kuis_best": best})
            for k in ("let", "const", "assign", "hitung"):
                s.mastery(u, k, 3)
            if "k9" in misses:
                s.mastery(u, "salinan", 2, weak=True, phase="kuis", note="Kamu menjawab 5, seharusnya 2.")
            continue
        s.xp(u, 60, "kuis selesai · Variabel", start + timedelta(days=2, hours=3))
        if where == "uji":
            s.state(u, "variabel", "challenge", {"code": bab2_variabel.CHALLENGE["starter"] + 'const namaTim = "Garuda";\n'}, last)
            s.progress(u, "variabel", "kuis", current_progress=0.2, started=start, since=ago(days=rng.uniform(.3, 1.5)), updated=last,
                       scores={"perkuat": acc, "kuis": best})
            for k in ("let", "const", "assign", "hitung", "penamaan"):
                s.mastery(u, k, 3)
            continue
        done_at = start + timedelta(days=3)
        s.progress(u, "variabel", "uji", started=start, completed=done_at, scores={"perkuat": acc, "kuis": best, "uji": 85}, active_min=rng.randint(26, 38))
        s.add(exam_done(u, s, done_at))
        s.xp(u, 180, "Bab selesai · Variabel", done_at)
        for k in ("let", "const", "assign", "hitung", "penamaan", "salinan"):
            s.mastery(u, k, 4)


def exam_done(u: User, s: Seeder, when: datetime) -> ExamSession:
    qs = bab2_variabel.EXAM
    rows = []
    for i, q in enumerate(qs, 1):
        ok = q["id"] != "u4"
        rows.append({"n": i, "label": q["label"], "ok": ok, "pts": q["pts"] if ok else 0, "max": q["pts"],
                     "note": "" if ok else "Kamu menjawab 5, seharusnya 2. Konsep ini ditambahkan ke <b>Perlu diulang</b>."})
        s.attempt(u, "variabel", "ulangan", q["id"], ok, when, n=1, answer=q.get("answer"))
    return ExamSession(user_id=u.id, chapter_id=s.ch["variabel"].id, version=s.ch["variabel"].version, started_at=when - timedelta(minutes=19),
                       deadline=when + timedelta(minutes=11), answers={}, flags=[], submitted_at=when, score=90, passed=True, results=rows)
