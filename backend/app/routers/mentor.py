"""Mentor: class overview with attention signals, student detail, review queue."""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import (Assignment, Attempt, Chapter, ChapterProgress, ConceptMastery, Concept, Klass, Message, Path, Project,
                      ProjectProgress, QuizRound, ReviewComment, Submission, User, now)
from ..security import require_role
from ..services import activity, content as content_svc, learning, signals, unlock
from ..views import ago, person
from .learner import phase_meta

router = APIRouter(prefix="/api/mentor", tags=["mentor"])
staff = require_role("mentor", "admin")


def _classes(db: Session, me: User) -> list[Klass]:
    q = select(Klass).order_by(Klass.id)
    if me.role == "mentor":
        q = q.where(Klass.mentor_id == me.id)
    return list(db.scalars(q))


def _klass(db: Session, me: User, class_id: int | None) -> Klass:
    cls = _classes(db, me)
    if not cls:
        raise HTTPException(404, "Kamu belum punya kelas.")
    if class_id is None:
        return cls[0]
    k = next((c for c in cls if c.id == class_id), None)
    if k is None:
        raise HTTPException(403, "Kelas ini bukan milikmu.")
    return k


def _learners(db: Session, k: Klass) -> list[User]:
    return list(db.scalars(select(User).where(User.class_id == k.id, User.role == "learner").order_by(User.name)))


def _student(db: Session, me: User, uid: int) -> User:
    u = db.get(User, uid)
    if u is None or u.role != "learner":
        raise HTTPException(404, "Siswa tidak ditemukan.")
    if me.role == "mentor" and u.class_id not in {k.id for k in _classes(db, me)}:
        raise HTTPException(403, "Siswa ini bukan di kelasmu.")
    return u


def _position(db: Session, u: User) -> dict[str, Any]:
    """Where a learner is now: chapter, phase and a short progress label."""
    klass = db.get(Klass, u.class_id) if u.class_id else None
    path = db.get(Path, klass.path_id) if klass and klass.path_id else db.scalar(select(Path))
    chapters = learning.path_chapters(db, path.id)
    pm = learning.progress_map(db, u.id)
    cur = learning.current_chapter(db, u, chapters, pm)
    if cur is None:
        done = [c for c in chapters if c.kind == "chapter" and pm.get(c.id) and pm[c.id].completed_at]
        last = done[-1] if done else None
        return {"chapter": learning.chapter_ref(last) if last else None, "phase": "uji",
                "label": "selesai · bab berikutnya segera" if last else "belum mulai", "ring": [1, 1, 1, 1] if last else [0, 0, 0, 0],
                "number": last.number if last else 0, "total": len([c for c in chapters if c.kind == "chapter"]), "path_id": path.id}
    prog = pm.get(cur.id)
    phases = prog.phases if prog else unlock.initial_phases()
    ph = unlock.current_phase(phases)
    content = content_svc.published(db, cur, prog.version if prog else None) or {}
    meta = next(m for m in phase_meta(db, u, cur, prog, content) if m["id"] == ph)
    short = meta["short"].replace(" soal", "")
    label = f"{unlock.PHASE_LABEL[ph]} {short}" if "/" in short else unlock.PHASE_LABEL[ph]
    if ph == "kuis":
        fails = [r for r in db.scalars(select(QuizRound).where(QuizRound.user_id == u.id, QuizRound.chapter_id == cur.id, QuizRound.kind == "gate",
                                                               QuizRound.finished.is_(True), QuizRound.passed.is_(False)))]
        if fails:
            label = f"Kuis · gagal {len(fails)}×"
    if ph == "uji":
        pend = db.scalar(select(Submission).where(Submission.user_id == u.id, Submission.chapter_id == cur.id, Submission.status == "pending"))
        label = "Uji · challenge" if pend else "Uji"
    if ph == "pahami" and "scene" in short:
        label = f"Pahami {short.replace('scene ', '')}"
    return {"chapter": learning.chapter_ref(cur), "phase": ph, "label": label, "ring": unlock.ring_values(phases), "number": cur.number,
            "total": len([c for c in chapters if c.kind == "chapter"]), "path_id": path.id}


def _avg_tier(db: Session, u: User) -> int:
    rows = list(db.scalars(select(ConceptMastery.tier).where(ConceptMastery.user_id == u.id, ConceptMastery.tier > 0)))
    return round(sum(rows) / len(rows)) if rows else 0


def _weak(db: Session, u: User) -> bool:
    return bool(db.scalar(select(ConceptMastery.id).where(ConceptMastery.user_id == u.id, ConceptMastery.weak.is_(True)).limit(1)))


def _badge(sigs: list[dict[str, Any]], u: User, db: Session) -> dict[str, str]:
    kinds = {s["kind"]: s for s in sigs}
    if "repeated" in kinds:
        return {"text": f"salah {kinds['repeated']['count']}×", "tone": "danger"}
    if "gate" in kinds:
        return {"text": "gerbang", "tone": "warning"}
    if "review" in kinds:
        return {"text": "minta review", "tone": "accent"}
    if "hints" in kinds:
        return {"text": "buru-buru petunjuk", "tone": "warning"}
    if "stalled" in kinds:
        return {"text": "tidak aktif", "tone": ""}
    st = activity.streak(db, u)
    if st >= 3:
        return {"text": f"streak {st}", "tone": "success"}
    return {"text": "–", "tone": ""}


@router.get("/classes")
def classes(me: User = Depends(staff), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    return [{"id": k.id, "name": k.name} for k in _classes(db, me)]


@router.get("/overview")
def overview(class_id: int | None = None, me: User = Depends(staff), db: Session = Depends(get_db)) -> dict[str, Any]:
    k = _klass(db, me, class_id)
    learners = _learners(db, k)
    ids = [u.id for u in learners]
    path = db.get(Path, k.path_id) if k.path_id else db.scalar(select(Path))
    cache: dict[int, dict[str, Any]] = {}
    all_signals: list[dict[str, Any]] = []
    roster = []
    positions: dict[int, dict[str, Any]] = {}
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    active = 0
    for u in learners:
        sigs = signals.learner_signals(db, u, cache)
        for s in sigs:
            s["learner"] = person(u)
        all_signals += sigs
        pos = _position(db, u)
        positions[u.id] = pos
        la = u.last_active_at
        if la and (la if la.tzinfo else la.replace(tzinfo=timezone.utc)) >= week_ago:
            active += 1
        roster.append({"learner": person(u), "chapter": f"{pos['number']} · {pos['chapter']['title']}" if pos["chapter"] else "–",
                       "phase": pos["phase"], "phase_label": pos["label"], "tier": _avg_tier(db, u), "weak": _weak(db, u),
                       "activity": ago(u.last_active_at), "badge": _badge(sigs, u, db),
                       "flags": sorted({s["kind"] for s in sigs})})
    ranked = signals.rank([s for s in all_signals if s["kind"] != "review"])
    reviews = [s for s in all_signals if s["kind"] == "review"]
    attention = []
    for s in ranked[:6]:
        attention.append({**{k2: v for k2, v in s.items() if k2 != "at"}, "ago": ago(s["at"])})
    # funnel for the chapter most of the class is on
    focus = Counter(p["chapter"]["id"] for p in positions.values() if p["chapter"])
    focus_id = focus.most_common(1)[0][0] if focus else None
    funnel = signals.phase_funnel(db, ids, focus_id) if focus_id else None
    focus_ch = db.get(Chapter, focus_id) if focus_id else None
    pile_text = None
    if funnel and funnel["pile"]:
        ph = funnel["pile"]["phase"]
        hard = _hardest_item(db, ids, focus_ch, ph) if focus_ch else None
        pile_text = (f"<b>Penumpukan di {unlock.PHASE_LABEL[ph]}.</b> {funnel['pile']['count']} siswa ada di sini, rata-rata "
                     f"{str(funnel['pile']['avg_days']).replace('.', ',')} hari." + (f" {hard}" if hard else ""))
    return {
        "mentor": person(me), "class": {"id": k.id, "name": k.name}, "classes": [{"id": c.id, "name": c.name} for c in _classes(db, me)],
        "path": {"title": path.title if path else ""}, "week": _week_no(k),
        "kpis": {"active": active, "total": len(learners), "attention": len({s["learner"]["id"] for s in ranked}),
                 "stalled": len([s for s in all_signals if s["kind"] == "stalled"]), "review": len(reviews)},
        "attention": attention,
        "funnel": {"chapter": learning.chapter_ref(focus_ch) if focus_ch else None, **(funnel or {}), "pile_text": pile_text},
        "hardest": signals.hardest_concepts(db, ids, path.id) if path else [],
        "roster": roster,
    }


def _week_no(k: Klass) -> int:
    if not k.started_on:
        return 1
    return max(1, (activity.local_today() - k.started_on).days // 7 + 1)


def _hardest_item(db: Session, ids: list[int], ch: Chapter, phase: str) -> str | None:
    if phase not in ("perkuat", "kuis"):
        return None
    content = content_svc.published(db, ch) or {}
    tally: dict[str, list[int]] = {}
    for a in db.scalars(select(Attempt).where(Attempt.user_id.in_(ids), Attempt.chapter_id == ch.id, Attempt.phase == phase, Attempt.attempt_no == 1)):
        t = tally.setdefault(a.item_id, [0, 0])
        t[1] += 1
        t[0] += 0 if a.correct else 1
    if not tally:
        return None
    iid, (w, n) = max(tally.items(), key=lambda kv: kv[1][0] / kv[1][1])
    pool = content.get("perkuat", {}).get("items", []) if phase == "perkuat" else content.get("kuis", {}).get("bank", [])
    item = content_svc.find(pool, iid) or {}
    name = item.get("label") or signals._plain(item.get("title") or item.get("t") or iid)
    return f"Soal “{name}” paling sering salah ({round(100 * w / n)}%)."


@router.get("/students/{uid}")
def student(uid: int, me: User = Depends(staff), db: Session = Depends(get_db)) -> dict[str, Any]:
    u = _student(db, me, uid)
    klass = db.get(Klass, u.class_id) if u.class_id else None
    sigs = signals.learner_signals(db, u)
    pos = _position(db, u)
    allow_wrong = (u.prefs or {}).get("mentor_sees_wrong", True)
    patterns = signals.wrong_patterns(db, u) if allow_wrong else []
    subs = list(db.scalars(select(Submission).where(Submission.user_id == u.id).order_by(Submission.created_at.desc()).limit(10)))
    weak_rows = db.execute(select(ConceptMastery, Concept).join(Concept, Concept.id == ConceptMastery.concept_id)
                           .where(ConceptMastery.user_id == u.id).order_by(ConceptMastery.weak.desc(), ConceptMastery.tier)).all()
    rep = next((s for s in sigs if s["kind"] == "repeated"), None)
    return {
        "learner": {**person(u), "class": klass.name if klass else "", "joined": _joined(u), "assist_cap": u.assist_cap,
                    "email": u.email, "allow_wrong": allow_wrong},
        "position": pos,
        "badge": ({"text": f"salah {rep['count']}× di soal yang sama", "tone": "danger"} if rep else _badge(sigs, u, db)),
        "mastery_avg": learning.overall_mastery_pct(db, u, pos.get("path_id") or 1),
        "signals": [{**{k2: v for k2, v in s.items() if k2 != "at"}, "ago": ago(s["at"])} for s in signals.rank(sigs)],
        "patterns": patterns,
        "submissions": [{"id": s.id, "title": s.title, "status": s.status, "tests": f"{s.tests_passed}/{s.tests_total}",
                         "attempt": s.attempt_no, "ago": ago(s.created_at)} for s in subs],
        "timeline": _timeline(db, u),
        "concepts": [{"key": c.key, "name": c.name, "tier": m.tier, "weak": m.weak} for m, c in weak_rows[:6]],
    }


def _joined(u: User) -> str:
    months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
    d = activity.local_day(u.created_at)
    return f"{d.day} {months[d.month - 1]}"


def _timeline(db: Session, u: User, limit: int = 12) -> list[dict[str, Any]]:
    events: list[tuple[datetime, dict[str, Any]]] = []
    aware = lambda d: d if d.tzinfo else d.replace(tzinfo=timezone.utc)  # noqa: E731
    by_item: dict[tuple[int, str, str], list[Attempt]] = {}
    for a in db.scalars(select(Attempt).where(Attempt.user_id == u.id).order_by(Attempt.created_at.desc()).limit(300)):
        by_item.setdefault((a.chapter_id, a.phase, a.item_id if a.phase == "perkuat" else "*"), []).append(a)
    for (cid, phase, iid), atts in by_item.items():
        ch = db.get(Chapter, cid)
        latest = max(aware(a.created_at) for a in atts)
        if phase == "perkuat":
            wrong = sum(1 for a in atts if not a.correct)
            if wrong >= 2:
                content = content_svc.published(db, ch) or {}
                order = [i["id"] for i in content.get("perkuat", {}).get("items", []) if not i.get("adaptive")]
                num = order.index(iid) + 1 if iid in order else "?"
                events.append((latest, {"phase": "perkuat", "title": f"Perkuat · {ch.title}", "meta": f"soal {num} salah {wrong}×"}))
        elif phase == "challenge":
            best = max(atts, key=lambda a: (a.answer or {}).get("passed", 0))
            meta = f"challenge {(best.answer or {}).get('passed', 0)}/{(best.answer or {}).get('total', 0)}"
            events.append((latest, {"phase": "uji", "title": f"Uji · {ch.title}", "meta": meta}))
    for r in db.scalars(select(QuizRound).where(QuizRound.user_id == u.id, QuizRound.finished.is_(True), QuizRound.chapter_id.is_not(None))):
        ch = db.get(Chapter, r.chapter_id)
        events.append((aware(r.created_at), {"phase": "kuis", "title": f"Kuis · {ch.title}", "meta": f"{r.pct}% · {'lulus' if r.passed else 'belum lulus'}"}))
    for p in db.scalars(select(ChapterProgress).where(ChapterProgress.user_id == u.id)):
        ch = db.get(Chapter, p.chapter_id)
        if p.phases["pahami"]["state"] == "done":
            content = content_svc.published(db, ch, p.version) or {}
            n = len(content.get("pahami", {}).get("scenes", []))
            events.append((aware(p.started_at) + timedelta(minutes=1), {"phase": "pahami", "title": f"Pahami · {ch.title}", "meta": f"selesai {n} scene"}))
    for s in db.scalars(select(Submission).where(Submission.user_id == u.id)):
        events.append((aware(s.created_at), {"phase": "uji", "title": s.title, "meta": f"{s.tests_passed}/{s.tests_total} · minta review"}))
    events.sort(key=lambda e: e[0], reverse=True)
    out = []
    for at, ev in events[:limit]:
        out.append({**ev, "when": _when(at)})
    return out


def _when(dt: datetime) -> str:
    d = activity.local_day(dt)
    days = (activity.local_today() - d).days
    t = dt.astimezone(activity.LOCAL_TZ).strftime("%H.%M")
    if days == 0:
        return f"hari ini {t}"
    if days == 1:
        return "kemarin"
    return f"{days} hari lalu"


class CapIn(BaseModel):
    assist_cap: int = Field(ge=0, le=6)


@router.patch("/students/{uid}")
def set_cap(uid: int, body: CapIn, me: User = Depends(staff), db: Session = Depends(get_db)) -> dict[str, Any]:
    u = _student(db, me, uid)
    u.assist_cap = body.assist_cap
    learning.notify(db, u.id, "cap", "Pengaturan petunjuk diubah mentor", f"Petunjuk dibatasi sampai L{body.assist_cap}.", "")
    db.commit()
    return {"assist_cap": u.assist_cap}


class AssignIn(BaseModel):
    chapter_id: int | None = None
    kind: str = "mini"  # mini | scene
    concept: str | None = None
    note: str = ""


@router.post("/students/{uid}/assign")
def assign(uid: int, body: AssignIn, me: User = Depends(staff), db: Session = Depends(get_db)) -> dict[str, Any]:
    u = _student(db, me, uid)
    ch = db.get(Chapter, body.chapter_id) if body.chapter_id else None
    if ch is None:
        pos = _position(db, u)
        ch = db.get(Chapter, pos["chapter"]["id"]) if pos["chapter"] else None
    if ch is None:
        raise HTTPException(404, "Bab tidak ditemukan.")
    if body.kind == "scene":
        title = f"Ulas scene Pahami · {ch.title} + 3 soal"
        link = f"/bab/{ch.id}/pahami" + (f"?konsep={body.concept}" if body.concept else "")
    else:
        title = f"Perkuat mini · {ch.title} · 3 soal"
        link = f"/bab/{ch.id}/perkuat?latih={body.concept or ''}"
    db.add(Assignment(mentor_id=me.id, learner_id=u.id, chapter_id=ch.id, title=title, link=link))
    learning.notify(db, u.id, "assignment", f"Tugas dari {me.name.split()[0]}", title, link)
    text = body.note.strip() or f"Aku tugaskan {title}. Kerjakan pelan-pelan, ya."
    db.add(Message(learner_id=u.id, author_id=me.id, body=text, context=title))
    db.commit()
    return {"ok": True, "title": title}


class TextIn(BaseModel):
    body: str = Field(default="", max_length=2000)


@router.post("/students/{uid}/remind")
def remind(uid: int, body: TextIn, me: User = Depends(staff), db: Session = Depends(get_db)) -> dict[str, Any]:
    u = _student(db, me, uid)
    text = body.body.strip() or f"Halo {u.name.split()[0]}, yuk lanjut belajar hari ini. Sedikit saja sudah bagus."
    learning.notify(db, u.id, "reminder", f"Pengingat dari {me.name.split()[0]}", text, "/beranda")
    db.add(Message(learner_id=u.id, author_id=me.id, body=text, context="Pengingat"))
    db.commit()
    return {"ok": True}


@router.post("/students/{uid}/messages")
def message(uid: int, body: TextIn, me: User = Depends(staff), db: Session = Depends(get_db)) -> dict[str, Any]:
    u = _student(db, me, uid)
    if not body.body.strip():
        raise HTTPException(422, "Pesan tidak boleh kosong.")
    db.add(Message(learner_id=u.id, author_id=me.id, body=body.body.strip(), context="Pesan mentor"))
    learning.notify(db, u.id, "message", f"Pesan dari {me.name.split()[0]}", body.body.strip()[:120], "/progres#feedback")
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ reviews
def _sub(db: Session, me: User, sid: int) -> Submission:
    s = db.get(Submission, sid)
    if s is None:
        raise HTTPException(404, "Kiriman tidak ditemukan.")
    _student(db, me, s.user_id)
    return s


@router.get("/review")
def review_queue(class_id: int | None = None, me: User = Depends(staff), db: Session = Depends(get_db)) -> dict[str, Any]:
    ids = [u.id for k in ([_klass(db, me, class_id)] if class_id else _classes(db, me)) for u in _learners(db, k)]
    rows = db.scalars(select(Submission).where(Submission.user_id.in_(ids)).order_by(Submission.status != "pending", Submission.created_at.desc()).limit(40))
    return {"items": [{"id": s.id, "learner": person(db.get(User, s.user_id)), "title": s.title, "status": s.status,
                       "tests": f"{s.tests_passed}/{s.tests_total}", "attempt": s.attempt_no, "ago": ago(s.created_at)} for s in rows]}


@router.get("/submissions/{sid}")
def submission(sid: int, me: User = Depends(staff), db: Session = Depends(get_db)) -> dict[str, Any]:
    s = _sub(db, me, sid)
    comments = [{"id": c.id, "line": c.line, "body": c.body, "author": person(db.get(User, c.author_id))}
                for c in db.scalars(select(ReviewComment).where(ReviewComment.submission_id == s.id).order_by(ReviewComment.line, ReviewComment.id))]
    return {"id": s.id, "learner": person(db.get(User, s.user_id)), "title": s.title, "filename": s.filename, "kind": s.kind,
            "code": s.code, "attempt": s.attempt_no, "tests": {"passed": s.tests_passed, "total": s.tests_total},
            "error_line": s.error_line, "status": s.status, "summary": s.summary, "comments": comments, "ago": ago(s.created_at)}


class CommentIn(BaseModel):
    line: int = Field(ge=1)
    body: str = Field(min_length=1, max_length=2000)


@router.post("/submissions/{sid}/comments")
def add_comment(sid: int, body: CommentIn, me: User = Depends(staff), db: Session = Depends(get_db)) -> dict[str, Any]:
    s = _sub(db, me, sid)
    c = ReviewComment(submission_id=s.id, author_id=me.id, line=body.line, body=body.body.strip())
    db.add(c)
    db.commit()
    return {"id": c.id, "line": c.line, "body": c.body, "author": person(me)}


@router.delete("/submissions/{sid}/comments/{cid}")
def delete_comment(sid: int, cid: int, me: User = Depends(staff), db: Session = Depends(get_db)) -> dict[str, bool]:
    _sub(db, me, sid)
    c = db.get(ReviewComment, cid)
    if c and c.submission_id == sid and (c.author_id == me.id or me.role == "admin"):
        db.delete(c)
        db.commit()
    return {"ok": True}


class DecisionIn(BaseModel):
    decision: str  # approve | changes
    summary: str = ""


@router.post("/submissions/{sid}/decision")
def decide(sid: int, body: DecisionIn, me: User = Depends(staff), db: Session = Depends(get_db)) -> dict[str, Any]:
    s = _sub(db, me, sid)
    learner = db.get(User, s.user_id)
    s.summary = body.summary.strip()
    s.reviewed_by, s.reviewed_at, s.seen_by_learner = me.id, now(), False
    n_comments = len(list(db.scalars(select(ReviewComment.id).where(ReviewComment.submission_id == s.id))))
    xp = 0
    if body.decision == "approve":
        s.status = "approved"
        if s.kind == "challenge":
            xp = activity.add_xp(db, learner, 30, "Challenge disetujui mentor")
        if s.kind == "milestone" and s.project_id is not None:
            proj = db.get(Project, s.project_id)
            pp = db.scalar(select(ProjectProgress).where(ProjectProgress.user_id == learner.id, ProjectProgress.project_id == s.project_id))
            if pp and pp.milestone == s.milestone:
                if pp.milestone + 1 >= len(proj.milestones):
                    pp.status, pp.published_at = "portfolio", now()
                else:
                    pp.milestone += 1
                    pp.status = "work"
                    starter = proj.milestones[pp.milestone].get("starter")
                    if starter:
                        pp.code = pp.code.rstrip() + "\n\n" + starter
                    pp.last_run = None
        title = "Challenge disetujui" if s.kind == "challenge" else "Milestone disetujui"
        learning.notify(db, learner.id, "review", title, s.title, _learner_link(s))
    else:
        s.status = "changes"
        if s.kind == "milestone" and s.project_id is not None:
            pp = db.scalar(select(ProjectProgress).where(ProjectProgress.user_id == learner.id, ProjectProgress.project_id == s.project_id))
            if pp:
                pp.status = "feedback"
        learning.notify(db, learner.id, "review", f"{n_comments} komentar baru" if n_comments else "Mentor minta perbaikan", s.title, _learner_link(s))
    if s.summary:
        db.add(Message(learner_id=learner.id, author_id=me.id, project_id=s.project_id, body=s.summary, context=s.title.split("·")[-1].strip()))
    db.commit()
    return {"status": s.status, "xp": xp, "learner": person(learner), "comments": n_comments}


def _learner_link(s: Submission) -> str:
    return f"/proyek/{s.project_id}" if s.project_id else f"/bab/{s.chapter_id}"
