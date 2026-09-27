"""Admin: curriculum dashboard with data-driven content flags, people, and the Builder API."""
from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import (Attempt, Chapter, ChapterProgress, ChapterVersion, Concept, ContentReport, DailyActivity, Klass, Organization,
                      Path, PlayerState, QuizRound, User, now)
from ..security import hash_password, require_role
from ..services import activity, content as content_svc, unlock
from ..views import ago, person

router = APIRouter(prefix="/api/admin", tags=["admin"])
admin_only = require_role("admin")
staff = require_role("admin", "mentor")


def _summary(content: dict[str, Any]) -> str:
    c = content_svc.phase_counts(content)
    parts = []
    if c["scenes"]:
        parts.append(f"{c['scenes']} scene")
    if c["items"]:
        parts.append(f"{c['items']} soal")
    if c["bank"]:
        parts.append(f"{c['bank']} kuis")
    uji = [x for x, ok in (("ulangan", c["exam"]), ("challenge", content.get("challenge"))) if ok]
    if uji:
        parts.append(" + ".join(uji))
    return " · ".join(parts) or "kosong"


def _content_of(db: Session, ch: Chapter) -> dict[str, Any]:
    return content_svc.published(db, ch) or ch.draft or {}


@router.get("/overview")
def overview(me: User = Depends(admin_only), db: Session = Depends(get_db)) -> dict[str, Any]:
    today = activity.local_today()
    learners = list(db.scalars(select(User).where(User.role == "learner")))
    ids = [u.id for u in learners]
    spark = []
    for i in range(8):
        d = today - timedelta(days=7 - i)
        spark.append(db.scalar(select(func.count()).select_from(DailyActivity).where(DailyActivity.day == d, DailyActivity.seconds > 0)) or 0)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    active = sum(1 for u in learners if u.last_active_at and (u.last_active_at if u.last_active_at.tzinfo else u.last_active_at.replace(tzinfo=timezone.utc)) >= week_ago)
    chapters = list(db.scalars(select(Chapter).where(Chapter.kind == "chapter").order_by(Chapter.position)))
    published = [c for c in chapters if c.version]
    # gate pass on first try: the first gate round of each learner per chapter
    first_rounds: dict[tuple[int, int], QuizRound] = {}
    for r in db.scalars(select(QuizRound).where(QuizRound.kind == "gate", QuizRound.finished.is_(True)).order_by(QuizRound.created_at)):
        first_rounds.setdefault((r.user_id, r.chapter_id), r)
    gate = round(100 * sum(1 for r in first_rounds.values() if r.passed) / len(first_rounds)) if first_rounds else 0
    done = list(db.scalars(select(ChapterProgress).where(ChapterProgress.completed_at.is_not(None), ChapterProgress.active_seconds > 0)))
    avg_min = round(sum(p.active_seconds for p in done) / len(done) / 60) if done else 0
    dist = {p: 0 for p in unlock.PHASES}
    for p in db.scalars(select(ChapterProgress).where(ChapterProgress.completed_at.is_(None), ChapterProgress.user_id.in_(ids))):
        dist[unlock.current_phase(p.phases)] += 1
    items_total = 0
    for c in published:
        cc = content_svc.published(db, c) or {}
        k = content_svc.phase_counts(cc)
        items_total += k["items"] + k["similar"] + k["bank"] + k["exam"]
    recent = list(db.scalars(select(Chapter).order_by(Chapter.updated_at.desc()).limit(6)))
    return {
        "org": (db.get(Organization, me.org_id).name if me.org_id else ""),
        "kpis": {"active": active, "spark": spark, "published": len(published), "chapters": len(chapters),
                 "review": len([c for c in chapters if c.status == "review"]), "gate_first_try": gate, "avg_minutes": avg_min},
        "flags": content_flags(db),
        "distribution": dist,
        "status": {"published": len(published), "items": items_total, "review": len([c for c in chapters if c.status == "review"]),
                   "draft": len([c for c in chapters if not c.version])},
        "recent": [{"id": c.id, "title": f"{c.number} · {c.title}" if c.kind == "chapter" else c.title, "path": db.get(Path, c.path_id).title,
                    "summary": _summary(_content_of(db, c)), "status": c.status, "kind": c.kind,
                    "by": (db.get(User, c.updated_by).name.split()[0] if c.updated_by else "sistem"), "ago": ago(c.updated_at)} for c in recent],
    }


def content_flags(db: Session, limit: int = 6) -> list[dict[str, Any]]:
    flags: list[dict[str, Any]] = []
    for ch in db.scalars(select(Chapter).where(Chapter.version > 0)):
        content = content_svc.published(db, ch) or {}
        # Perkuat: first-try wrong % far above the chapter average
        stats = item_stats(db, ch.id, "perkuat")
        if stats:
            avg = sum(s["wrong_pct"] for s in stats.values()) / len(stats)
            for iid, s in stats.items():
                if s["n"] >= 5 and s["wrong_pct"] >= max(40, avg * 1.8):
                    item = content_svc.find(content.get("perkuat", {}).get("items", []), iid) or {}
                    order = [i["id"] for i in content.get("perkuat", {}).get("items", []) if not i.get("adaptive")]
                    num = order.index(iid) + 1 if iid in order else "serupa"
                    flags.append({"phase": "perkuat", "icon": "bug" if item.get("type") == "bug" else "list-checks", "score": s["wrong_pct"],
                                  "title": f"Perkuat · {ch.title} · soal {num} “{item.get('label') or _plain(item.get('title', ''))}”",
                                  "reason": f"{s['wrong_pct']}% salah di percobaan 1, jauh di atas rata-rata {round(avg)}%. Mungkin instruksinya ambigu.",
                                  "href": f"/admin/bab/{ch.id}?edit=item:{iid}"})
        # Pahami: learners stuck on one scene for more than 2 days
        stuck: dict[int, int] = defaultdict(int)
        started = 0
        cutoff = datetime.now(timezone.utc) - timedelta(days=2)
        for st in db.scalars(select(PlayerState).where(PlayerState.chapter_id == ch.id, PlayerState.phase == "pahami")):
            started += 1
            prog = db.scalar(select(ChapterProgress).where(ChapterProgress.user_id == st.user_id, ChapterProgress.chapter_id == ch.id))
            up = st.updated_at if st.updated_at.tzinfo else st.updated_at.replace(tzinfo=timezone.utc)
            if prog and prog.phases["pahami"]["state"] != "done" and up < cutoff:
                stuck[int(st.data.get("scene", 1))] += 1
        for scene, n in stuck.items():
            if started >= 4 and n / started >= 0.25:
                flags.append({"phase": "pahami", "icon": "clapperboard", "score": round(100 * n / started),
                              "title": f"Pahami · {ch.title} · scene {scene}",
                              "reason": f"{round(100 * n / started)}% siswa berhenti di scene ini lebih dari 2 hari.",
                              "href": f"/admin/bab/{ch.id}?edit=scene:{scene}"})
        # Kuis: questions almost nobody gets right
        for qid, s in item_stats(db, ch.id, "kuis").items():
            if s["n"] >= 5 and 100 - s["wrong_pct"] <= 20:
                q = content_svc.find(content.get("kuis", {}).get("bank", []), qid) or {}
                reason = ("Terlalu sulit untuk trivia; pertimbangkan pindah ke Perkuat." if q.get("trivia")
                          else "Hampir semua siswa salah. Cek kunci jawaban dan pilihan pengecohnya.")
                flags.append({"phase": "kuis", "icon": "zap", "score": s["wrong_pct"],
                              "title": f"Kuis · {ch.title} · soal “{_plain(q.get('t', qid))[:40]}”",
                              "reason": f"{s['wrong_pct']}% salah. {reason}",
                              "href": f"/admin/bab/{ch.id}?edit=kuis"})
        # Challenge: learner reports on a test
        reports = db.execute(select(ContentReport.item_id, func.count()).where(ContentReport.chapter_id == ch.id).group_by(ContentReport.item_id)).all()
        for item_id, n in reports:
            if n >= 3:
                tests = (content.get("challenge") or {}).get("tests", [])
                idx = next((i + 1 for i, t in enumerate(tests) if t["id"] == item_id), "?")
                flags.append({"phase": "uji", "icon": "flask-conical", "score": 50 + n,
                              "title": f"Challenge · {(content.get('challenge') or {}).get('title', ch.title)} · tes #{idx}",
                              "reason": f"{n} laporan “output benar tapi gagal”. Cek aturan pembanding tes ini.",
                              "href": f"/admin/bab/{ch.id}?edit=challenge"})
    flags.sort(key=lambda f: -f["score"])
    return flags[:limit]


def item_stats(db: Session, chapter_id: int, phase: str) -> dict[str, dict[str, int]]:
    tally: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for item_id, correct in db.execute(select(Attempt.item_id, Attempt.correct).where(
            Attempt.chapter_id == chapter_id, Attempt.phase == phase, Attempt.attempt_no == 1)).all():
        tally[item_id][1] += 1
        if not correct:
            tally[item_id][0] += 1
    return {k: {"n": n, "wrong_pct": round(100 * w / n)} for k, (w, n) in tally.items()}


def _plain(s: str) -> str:
    import re
    return re.sub(r"<[^>]+>", "", s or "")


@router.get("/counts")
def counts(me: User = Depends(staff), db: Session = Depends(get_db)) -> dict[str, int]:
    chapters = list(db.scalars(select(Chapter)))
    tot = {"chapters": len([c for c in chapters if c.kind == "chapter"]), "perkuat": 0, "kuis": 0, "challenge": 0, "ulangan": 0, "proyek": 0}
    for c in chapters:
        cc = c.draft or {}
        tot["perkuat"] += len(cc.get("perkuat", {}).get("items", []))
        tot["kuis"] += len(cc.get("kuis", {}).get("bank", []))
        tot["challenge"] += 1 if cc.get("challenge") else 0
        tot["ulangan"] += 1 if (cc.get("ulangan") or {}).get("questions") else 0
        tot["proyek"] += 1 if c.kind == "project" else 0
    return tot


@router.get("/export")
def export(me: User = Depends(admin_only), db: Session = Depends(get_db)) -> StreamingResponse:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["nama", "email", "kelas", "bab", "fase", "pahami", "perkuat", "kuis", "uji", "selesai", "menit aktif", "xp total"])
    for u in db.scalars(select(User).where(User.role == "learner").order_by(User.name)):
        klass = db.get(Klass, u.class_id) if u.class_id else None
        xp = activity.total_xp(db, u.id)
        for p in db.scalars(select(ChapterProgress).where(ChapterProgress.user_id == u.id)):
            ch = db.get(Chapter, p.chapter_id)
            w.writerow([u.name, u.email, klass.name if klass else "", f"{ch.number} · {ch.title}", unlock.current_phase(p.phases),
                        *[p.phases[ph]["state"] + (f" {p.phases[ph]['score']:.0f}" if p.phases[ph].get("score") is not None else "") for ph in unlock.PHASES],
                        "ya" if p.completed_at else "", p.active_seconds // 60, xp])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue().encode("utf-8-sig")]), media_type="text/csv",
                             headers={"Content-Disposition": 'attachment; filename="gnosia-progres.csv"'})


# ------------------------------------------------------------------ people
@router.get("/users")
def users(role: str | None = None, q: str = "", me: User = Depends(admin_only), db: Session = Depends(get_db)) -> dict[str, Any]:
    stmt = select(User).order_by(User.role, User.name)
    if role:
        stmt = stmt.where(User.role == role)
    rows = [u for u in db.scalars(stmt) if not q or q.lower() in (u.name + u.email).lower()]
    return {"items": [{**person(u), "email": u.email, "class": (db.get(Klass, u.class_id).name if u.class_id else ""),
                       "active": ago(u.last_active_at), "xp": activity.total_xp(db, u.id)} for u in rows],
            "classes": [{"id": k.id, "name": k.name, "mentor": person(db.get(User, k.mentor_id)) if k.mentor_id else None}
                        for k in db.scalars(select(Klass).order_by(Klass.name))]}


class UserIn(BaseModel):
    name: str = Field(min_length=1)
    email: str
    password: str = Field(min_length=1)
    role: str = "learner"
    class_id: int | None = None


@router.post("/users")
def create_user(body: UserIn, me: User = Depends(admin_only), db: Session = Depends(get_db)) -> dict[str, Any]:
    if body.role not in ("learner", "mentor", "admin"):
        raise HTTPException(422, "Peran tidak dikenal.")
    if db.scalar(select(User).where(func.lower(User.email) == body.email.lower())):
        raise HTTPException(422, {"fields": {"email": "Email sudah terdaftar."}})
    u = User(name=body.name.strip(), email=body.email.strip().lower(), password_hash=hash_password(body.password), role=body.role,
             org_id=me.org_id, class_id=body.class_id, onboarded=body.role != "learner", prefs={})
    db.add(u)
    db.commit()
    return person(u)


class UserPatch(BaseModel):
    role: str | None = None
    class_id: int | None = None


@router.patch("/users/{uid}")
def patch_user(uid: int, body: UserPatch, me: User = Depends(admin_only), db: Session = Depends(get_db)) -> dict[str, Any]:
    u = db.get(User, uid)
    if u is None:
        raise HTTPException(404, "Pengguna tidak ditemukan.")
    if body.role in ("learner", "mentor", "admin"):
        if u.id == me.id and body.role != "admin":
            raise HTTPException(409, "Kamu tidak bisa menurunkan peranmu sendiri.")
        u.role = body.role
    if body.class_id is not None:
        u.class_id = body.class_id or None
    db.commit()
    return person(u)


class ClassIn(BaseModel):
    name: str = Field(min_length=1)
    mentor_id: int | None = None


@router.post("/classes")
def create_class(body: ClassIn, me: User = Depends(admin_only), db: Session = Depends(get_db)) -> dict[str, Any]:
    path = db.scalar(select(Path).order_by(Path.id))
    k = Klass(org_id=me.org_id, name=body.name.strip(), path_id=path.id if path else None, mentor_id=body.mentor_id, started_on=activity.local_today())
    db.add(k)
    db.commit()
    return {"id": k.id, "name": k.name}


# ------------------------------------------------------------------ builder
@router.get("/chapters")
def chapters(me: User = Depends(staff), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    return [{"id": c.id, "number": c.number, "kind": c.kind, "title": c.title, "status": c.status, "version": c.version,
             "path": db.get(Path, c.path_id).title, "summary": _summary(c.draft or {}), "ago": ago(c.updated_at)}
            for c in db.scalars(select(Chapter).order_by(Chapter.path_id, Chapter.position))]


class NewChapter(BaseModel):
    title: str = Field(min_length=1)
    subtitle: str = ""
    icon: str = "box"


@router.post("/chapters")
def new_chapter(body: NewChapter, me: User = Depends(admin_only), db: Session = Depends(get_db)) -> dict[str, Any]:
    path = db.scalar(select(Path).order_by(Path.id))
    last = db.scalar(select(func.max(Chapter.position)).where(Chapter.path_id == path.id)) or 0
    num = (db.scalar(select(func.max(Chapter.number)).where(Chapter.path_id == path.id)) or 0) + 1
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", body.title.lower()).strip("-") or f"bab-{num}"
    while db.scalar(select(Chapter).where(Chapter.path_id == path.id, Chapter.slug == slug)):
        slug += "-baru"
    ch = Chapter(path_id=path.id, position=last + 1, number=num, kind="chapter", slug=slug, title=body.title.strip(),
                 subtitle=body.subtitle, icon=body.icon, map_x=50 if last % 2 else 36, status="draft", version=0,
                 draft=content_svc.empty_content(), updated_by=me.id)
    db.add(ch)
    db.commit()
    return {"id": ch.id}


@router.get("/chapters/{cid}")
def chapter(cid: int, me: User = Depends(staff), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = db.get(Chapter, cid)
    if ch is None:
        raise HTTPException(404, "Bab tidak ditemukan.")
    draft = ch.draft or content_svc.empty_content()
    return {
        "id": ch.id, "kind": ch.kind, "number": ch.number, "title": ch.title, "subtitle": ch.subtitle, "description": ch.description,
        "icon": ch.icon, "status": ch.status, "version": ch.version, "path": db.get(Path, ch.path_id).title,
        "draft": draft, "draft_saved": ago(ch.draft_saved_at) if ch.draft_saved_at else None,
        "dirty": bool(ch.version) and (content_svc.published(db, ch) != draft),
        "stats": {"perkuat": item_stats(db, ch.id, "perkuat"), "kuis": item_stats(db, ch.id, "kuis"), "scenes": _scene_stats(db, ch),
                  "wrong_lines": _wrong_line_stats(db, ch, draft)},
        "concepts": [{"key": c.key, "name": c.name} for c in db.scalars(select(Concept).where(Concept.path_id == ch.path_id))],
        "problems": validate(draft),
    }


def _scene_stats(db: Session, ch: Chapter) -> dict[str, dict[str, int]]:
    reached: dict[int, int] = defaultdict(int)
    total = 0
    for st in db.scalars(select(PlayerState).where(PlayerState.chapter_id == ch.id, PlayerState.phase == "pahami")):
        total += 1
        prog = db.scalar(select(ChapterProgress).where(ChapterProgress.user_id == st.user_id, ChapterProgress.chapter_id == ch.id))
        if prog and prog.phases["pahami"]["state"] != "done":
            reached[int(st.data.get("scene", 1))] += 1
    return {str(k): {"stopped_pct": round(100 * v / total) if total else 0} for k, v in reached.items()}


def _wrong_line_stats(db: Session, ch: Chapter, draft: dict[str, Any]) -> dict[str, dict[str, int]]:
    """For BugPick items: which wrong line learners pick most (for the data insight callout)."""
    out: dict[str, dict[str, int]] = {}
    bugs = {i["id"] for i in draft.get("perkuat", {}).get("items", []) if i.get("type") == "bug"}
    for item_id, ans in db.execute(select(Attempt.item_id, Attempt.answer).where(Attempt.chapter_id == ch.id, Attempt.phase == "perkuat",
                                                                                 Attempt.correct.is_(False), Attempt.item_id.in_(bugs))).all():
        if ans is None:
            continue
        d = out.setdefault(item_id, {})
        d[str(ans)] = d.get(str(ans), 0) + 1
    return out


def validate(c: dict[str, Any]) -> list[str]:
    """Problems that block publishing."""
    p: list[str] = []
    scenes = c.get("pahami", {}).get("scenes", [])
    if not scenes:
        p.append("Pahami belum punya scene.")
    for i, s in enumerate(scenes, 1):
        if not s.get("title"):
            p.append(f"Scene {i} belum punya judul.")
    items = c.get("perkuat", {}).get("items", [])
    ids = [i.get("id") for i in items]
    if len(ids) != len(set(ids)):
        p.append("Ada ID soal Perkuat yang kembar.")
    if len([i for i in items if not i.get("adaptive")]) < 1:
        p.append("Perkuat belum punya soal.")
    for n, it in enumerate(items, 1):
        t = it.get("type")
        if t in ("choice", "predict"):
            if not it.get("choices") or not isinstance(it.get("answer"), int) or not 0 <= it["answer"] < len(it["choices"]):
                p.append(f"Soal Perkuat {n}: pilihan atau kunci jawaban belum lengkap.")
        elif t == "bug":
            if not it.get("lines") or not isinstance(it.get("answer"), int) or not 1 <= it["answer"] <= len(it["lines"]):
                p.append(f"Soal Perkuat {n}: tandai baris yang error.")
        elif t == "fill":
            if it.get("code", "").count("{{slot}}") != len(it.get("answer", [])):
                p.append(f"Soal Perkuat {n}: jumlah kotak kosong tidak sama dengan jawaban.")
        elif t == "parsons":
            if sorted(str(x) for x in it.get("answer", [])) != sorted(str(line.get("id")) for line in it.get("lines", [])):
                p.append(f"Soal Perkuat {n}: urutan jawaban harus memakai semua baris.")
        if it.get("similar_id") and it["similar_id"] not in ids:
            p.append(f"Soal Perkuat {n}: soal serupa yang ditautkan tidak ada.")
    k = c.get("kuis", {})
    bank = k.get("bank", [])
    if len(bank) < k.get("round_size", 10):
        p.append(f"Bank Kuis butuh minimal {k.get('round_size', 10)} soal (sekarang {len(bank)}).")
    for n, q in enumerate(bank, 1):
        if len(q.get("o", [])) < 2 or not isinstance(q.get("a"), int) or not 0 <= q["a"] < len(q.get("o", [])):
            p.append(f"Soal Kuis {n}: pilihan atau kunci belum lengkap.")
    mode = c.get("uji_mode", "any")
    has_exam = bool((c.get("ulangan") or {}).get("questions"))
    has_ch = bool(c.get("challenge"))
    if not has_exam and not has_ch:
        p.append("Uji butuh Ulangan atau Challenge.")
    if mode == "ulangan" and not has_exam:
        p.append("Mode Uji = Ulangan, tapi ulangan kosong.")
    if mode == "challenge" and not has_ch:
        p.append("Mode Uji = Challenge, tapi challenge kosong.")
    if has_ch and not c["challenge"].get("tests"):
        p.append("Challenge belum punya tes.")
    return p


class DraftIn(BaseModel):
    draft: dict[str, Any]
    title: str | None = None
    subtitle: str | None = None
    description: str | None = None
    icon: str | None = None


@router.put("/chapters/{cid}/draft")
def save_draft(cid: int, body: DraftIn, me: User = Depends(admin_only), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = db.get(Chapter, cid)
    if ch is None:
        raise HTTPException(404, "Bab tidak ditemukan.")
    ch.draft = body.draft
    for f in ("title", "subtitle", "description", "icon"):
        v = getattr(body, f)
        if v is not None:
            setattr(ch, f, v)
    ch.draft_saved_at = ch.updated_at = now()
    ch.updated_by = me.id
    db.commit()
    return {"saved": True, "problems": validate(ch.draft), "next_version": ch.version + 1}


@router.post("/chapters/{cid}/publish")
def publish(cid: int, me: User = Depends(admin_only), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = db.get(Chapter, cid)
    if ch is None:
        raise HTTPException(404, "Bab tidak ditemukan.")
    problems = validate(ch.draft or {})
    if problems:
        raise HTTPException(422, {"message": "Belum bisa diterbitkan.", "problems": problems})
    ch.version += 1
    db.add(ChapterVersion(chapter_id=ch.id, version=ch.version, content=content_svc.clone(ch.draft), published_by=me.id))
    ch.status = "published"
    ch.updated_at = now()
    ch.updated_by = me.id
    # make sure concepts referenced by the content exist on the constellation
    for key in ch.draft.get("concepts", []):
        if not db.scalar(select(Concept).where(Concept.path_id == ch.path_id, Concept.key == key)):
            db.add(Concept(path_id=ch.path_id, key=key, name=key, chapter_id=ch.id, x=100 + 60 * ch.number, y=240))
    db.commit()
    return {"version": ch.version, "status": ch.status}


class StatusIn(BaseModel):
    status: str


@router.post("/chapters/{cid}/status")
def set_status(cid: int, body: StatusIn, me: User = Depends(staff), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = db.get(Chapter, cid)
    if ch is None:
        raise HTTPException(404, "Bab tidak ditemukan.")
    if body.status not in ("draft", "review"):
        raise HTTPException(422, "Status tidak dikenal.")
    ch.status = body.status if not ch.version or body.status == "review" else "published"
    db.commit()
    return {"status": ch.status}


class ConceptIn(BaseModel):
    key: str = Field(min_length=1, max_length=60)
    name: str = Field(min_length=1, max_length=80)
    chapter_id: int | None = None


@router.post("/concepts")
def add_concept(body: ConceptIn, me: User = Depends(admin_only), db: Session = Depends(get_db)) -> dict[str, Any]:
    path = db.scalar(select(Path).order_by(Path.id))
    if db.scalar(select(Concept).where(Concept.path_id == path.id, Concept.key == body.key)):
        raise HTTPException(422, "Kunci konsep sudah ada.")
    c = Concept(path_id=path.id, key=body.key, name=body.name, chapter_id=body.chapter_id, x=500, y=240)
    db.add(c)
    db.commit()
    return {"key": c.key, "name": c.name}
