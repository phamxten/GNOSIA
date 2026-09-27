"""Learner screens around learning: Beranda, Peta, Bab, Progres, activity, palette."""
from __future__ import annotations

from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import (Attempt, Chapter, ChapterProgress, Concept, ConceptMastery, ExamSession, Klass, MasterySnapshot,
                      Message, Notebook, Notification, Path, Project, ProjectProgress, QuizRound, Submission, User)
from ..security import current_user
from ..services import activity, content as content_svc, learning, unlock
from ..views import ago, person

router = APIRouter(prefix="/api", tags=["learner"])

PHASE_ICON = {"pahami": "book-open", "perkuat": "dumbbell", "kuis": "zap", "uji": "swords"}


def get_chapter(db: Session, chapter_id: int) -> Chapter:
    ch = db.get(Chapter, chapter_id)
    if ch is None:
        raise HTTPException(404, "Bab tidak ditemukan.")
    return ch


def phase_link(chapter: Chapter, phase: str, content: dict[str, Any] | None = None) -> str:
    if phase == "uji":
        mode = (content or {}).get("uji_mode", "any")
        if mode == "challenge":
            return f"/bab/{chapter.id}/uji/challenge"
        if mode == "ulangan":
            return f"/bab/{chapter.id}/uji/ulangan"
        return f"/bab/{chapter.id}#uji"
    return f"/bab/{chapter.id}/{phase}"


def phase_meta(db: Session, user: User, chapter: Chapter, prog: ChapterProgress | None, content: dict[str, Any]) -> list[dict[str, Any]]:
    phases = prog.phases if prog else unlock.initial_phases()
    counts = content_svc.phase_counts(content)
    out = []
    for i, ph in enumerate(unlock.PHASES):
        st = phases[ph]
        state = st["state"]
        label = "terkunci"
        if ph == "pahami":
            if state == "done":
                label = "selesai"
            elif state == "open":
                scene = _pahami_scene(db, user, chapter)
                label = f"scene {scene}/{counts['scenes']}" if scene > 1 else "mulai"
        elif ph == "perkuat":
            if state == "done":
                label = f"{st.get('score', 100):.0f}% tepat" if st.get("score") is not None else "selesai"
            elif state == "open":
                solved = _perkuat_solved(db, user, chapter)
                label = f"{solved}/{counts['items']} soal"
        elif ph == "kuis":
            if state == "done":
                label = f"lulus {st.get('score', 0):.0f}%"
            elif state == "open":
                label = f"terbaik {st['score']:.0f}%" if st.get("score") is not None else "terbuka"
        else:
            if state == "done":
                label = "selesai"
            elif state == "open":
                label = "terbuka"
        out.append({
            "id": ph, "label": unlock.PHASE_LABEL[ph], "state": state, "progress": unlock.ring_values(phases)[i],
            "meta": f"{i + 1:02d} · {label}", "short": label, "icon": PHASE_ICON[ph], "score": st.get("score"),
            "link": phase_link(chapter, ph, content),
        })
    return out


def _pahami_scene(db: Session, user: User, chapter: Chapter) -> int:
    from ..models import PlayerState
    st = db.scalar(select(PlayerState).where(PlayerState.user_id == user.id, PlayerState.chapter_id == chapter.id, PlayerState.phase == "pahami"))
    return int((st.data or {}).get("scene", 1)) if st else 1


def _perkuat_solved(db: Session, user: User, chapter: Chapter) -> int:
    from ..models import PlayerState
    st = db.scalar(select(PlayerState).where(PlayerState.user_id == user.id, PlayerState.chapter_id == chapter.id, PlayerState.phase == "perkuat"))
    if not st:
        return 0
    data = st.data or {}
    base = [i for i in data.get("order", []) if i not in data.get("inserted", [])]
    return len([i for i in base if i in data.get("solved", {})])


def eta_minutes(content: dict[str, Any], phases: dict[str, Any]) -> int:
    mins = content.get("minutes") or {}
    total = 0.0
    for ph in unlock.PHASES:
        st = phases[ph]
        if st["state"] == "done":
            continue
        total += (mins.get(ph) or 5) * (1 - float(st.get("progress") or 0))
    return max(1, round(total))


def continue_card(db: Session, user: User, chapter: Chapter, prog: ChapterProgress, path: Path) -> dict[str, Any]:
    content = content_svc.published(db, chapter, prog.version) or {}
    cur = unlock.current_phase(prog.phases)
    st = prog.phases[cur]
    started = float(st.get("progress") or 0) > 0 or cur != "pahami"
    verb = {"pahami": "Lanjut Pahami" if started else "Mulai Pahami", "perkuat": "Lanjut Perkuat" if float(st.get("progress") or 0) > 0 else "Mulai Perkuat",
            "kuis": "Mulai Kuis", "uji": "Pilih Uji"}[cur]
    return {
        "chapter": learning.chapter_ref(chapter),
        "path": {"slug": path.slug, "title": path.title},
        "phase": cur,
        "phase_label": f"Sedang {unlock.PHASE_LABEL[cur]}",
        "phases": phase_meta(db, user, chapter, prog, content),
        "ring": unlock.ring_values(prog.phases),
        "done": unlock.done_count(prog.phases),
        "primary": {"label": verb, "href": phase_link(chapter, cur, content)},
        "eta": eta_minutes(content, prog.phases),
    }


def nudge_text(card: dict[str, Any] | None) -> str:
    if not card:
        return "Semua bab yang terbit sudah kamu selesaikan. Keren!"
    left = [p["label"] for p in card["phases"] if p["state"] != "done" and p["id"] != "uji"]
    title = card["chapter"]["title"]
    if not left:
        return f"Tinggal <b>Uji</b>, lalu {title} selesai!"
    if len(left) == 1:
        return f"Tinggal <b>{left[0]}</b>, lalu {title} bisa kamu uji!"
    return "Tinggal " + ", ".join(f"<b>{l}</b>" for l in left[:-1]) + f" dan <b>{left[-1]}</b>, lalu {title} bisa kamu uji!"


def review_cards(db: Session, user: User, limit: int = 3) -> list[dict[str, Any]]:
    rows = db.execute(
        select(ConceptMastery, Concept).join(Concept, Concept.id == ConceptMastery.concept_id)
        .where(ConceptMastery.user_id == user.id, ConceptMastery.weak.is_(True))
        .order_by(ConceptMastery.updated_at.desc()).limit(limit)
    ).all()
    out = []
    for m, c in rows:
        ch = db.get(Chapter, c.chapter_id) if c.chapter_id else None
        phase = m.weak_phase or "perkuat"
        if phase == "kuis":
            action = {"label": "Kuis 3 soal", "icon": "zap", "href": f"/bab/{c.chapter_id}/kuis?ulang={c.key}"}
        elif phase in ("uji", "ulangan"):
            action = {"label": "Ulang · 3 menit", "icon": "rotate-ccw", "href": f"/bab/{c.chapter_id}/perkuat?latih={c.key}"}
        else:
            action = {"label": "Lihat lagi scene-nya", "icon": "book-open", "href": f"/bab/{c.chapter_id}/pahami?konsep={c.key}"}
        src = {"kuis": "dari Kuis", "ulangan": "dari Ulangan", "uji": "dari Challenge", "perkuat": "dari Perkuat"}.get(phase, "dari Perkuat")
        out.append({"concept": c.key, "name": c.name, "phase": "uji" if phase in ("ulangan", "uji") else phase, "source": src,
                    "note": m.weak_note, "tier": m.tier, "chapter": ch.title if ch else "", "action": action})
    return out


def mentor_note(db: Session, user: User) -> dict[str, Any] | None:
    msg = db.scalar(select(Message).where(Message.learner_id == user.id, Message.author_id != user.id).order_by(Message.created_at.desc()))
    if not msg:
        return None
    author = db.get(User, msg.author_id)
    unread = db.scalar(select(func.count()).select_from(Message).where(Message.learner_id == user.id, Message.author_id != user.id, Message.read.is_(False))) or 0
    href = f"/proyek/{msg.project_id}" if msg.project_id else "/progres#feedback"
    return {"mentor": person(author), "ago": ago(msg.created_at), "context": msg.context, "body": msg.body, "unread": unread, "href": href}


def project_cards(db: Session, user: User) -> list[dict[str, Any]]:
    out = []
    for proj in db.scalars(select(Project).order_by(Project.number)):
        pp = db.scalar(select(ProjectProgress).where(ProjectProgress.user_id == user.id, ProjectProgress.project_id == proj.id))
        if not pp:
            continue
        n = len(proj.milestones)
        ring = [1.0 if i < pp.milestone else (0.5 if i == pp.milestone and pp.status != "portfolio" else 0.0) for i in range(4)]
        if pp.status == "portfolio":
            ring, meta = [1.0] * 4, "terbit di portofolio"
        else:
            meta = f"milestone {pp.milestone + 1} dari {n}" + {"waiting": " · menunggu review", "feedback": " · feedback baru"}.get(pp.status, "")
        out.append({"id": proj.id, "title": proj.title, "meta": meta, "ring": ring, "href": f"/proyek/{proj.id}"})
    return out


def next_project_hint(db: Session, user: User) -> dict[str, Any] | None:
    proj = db.scalar(select(Project).order_by(Project.number))
    if not proj:
        return None
    return {"title": proj.title, "after": proj.unlock_after}


@router.get("/home")
def home(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    path = _user_path(db, user)
    chapters = learning.path_chapters(db, path.id)
    pm = learning.progress_map(db, user.id)
    cur = learning.current_chapter(db, user, chapters, pm)
    card = continue_card(db, user, cur, learning.ensure_progress(db, user, cur), path) if cur else None
    db.commit()
    from ..models import PlayerState
    first_time = activity.total_xp(db, user.id) == 0 and not db.scalar(
        select(func.count()).select_from(PlayerState).where(PlayerState.user_id == user.id))
    nb = db.scalar(select(Notebook).where(Notebook.user_id == user.id).order_by(Notebook.updated_at.desc()))
    today = activity.local_today()
    daily_done = db.scalar(select(func.count()).select_from(QuizRound).where(
        QuizRound.user_id == user.id, QuizRound.kind == "daily", QuizRound.finished.is_(True),
        QuizRound.created_at >= _day_start(today))) or 0
    return {
        "first_time": first_time,
        "nudge": nudge_text(card),
        "continue": card,
        "goal": {"minutes": activity.minutes_on(db, user.id, today), "target": user.daily_goal_min},
        "streak": {"days": activity.streak(db, user), "week": activity.week_dots(db, user)},
        "daily_quiz": {"available": _studied_chapters(db, user, pm) > 0, "done_today": daily_done > 0, "xp": 20},
        "review": review_cards(db, user),
        "mentor": mentor_note(db, user),
        "projects": project_cards(db, user),
        "notebook": {"id": nb.id, "title": nb.title, "ago": ago(nb.updated_at)} if nb else None,
        "next_project": next_project_hint(db, user),
        "first_chapter": learning.chapter_ref(next(c for c in chapters if c.kind == "chapter")) if chapters else None,
    }


def _day_start(day):
    from datetime import datetime
    return datetime.combine(day, datetime.min.time(), activity.LOCAL_TZ)


def _studied_chapters(db: Session, user: User, pm: dict[int, ChapterProgress]) -> int:
    return sum(1 for p in pm.values() if p.phases["pahami"]["state"] == "done")


def _user_path(db: Session, user: User) -> Path:
    klass = db.get(Klass, user.class_id) if user.class_id else None
    path = db.get(Path, klass.path_id) if klass and klass.path_id else db.scalar(select(Path).order_by(Path.id))
    if path is None:
        raise HTTPException(404, "Belum ada jalur belajar.")
    return path


@router.get("/paths")
def paths(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    return [{"slug": p.slug, "title": p.title} for p in db.scalars(select(Path).order_by(Path.id))]


@router.get("/paths/{slug}/map")
def path_map(slug: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    path = db.scalar(select(Path).where(Path.slug == slug))
    if path is None:
        raise HTTPException(404, "Jalur tidak ditemukan.")
    chapters = learning.path_chapters(db, path.id)
    pm = learning.progress_map(db, user.id)
    cur = learning.current_chapter(db, user, chapters, pm)
    nodes = []
    prev_learn: Chapter | None = None
    for c in chapters:
        prog = pm.get(c.id)
        state = learning.node_state(db, user, c, chapters, pm, cur.id if cur else None)
        content = content_svc.published(db, c, prog.version if prog else None) or {}
        ring = unlock.ring_values(prog.phases) if prog else [0.0] * 4
        phases = [{"id": ph, "label": unlock.PHASE_LABEL[ph], "value": ring[i]} for i, ph in enumerate(unlock.PHASES)]
        if c.kind == "project" and c.project_id:
            pp = db.scalar(select(ProjectProgress).where(ProjectProgress.user_id == user.id, ProjectProgress.project_id == c.project_id))
            proj = db.get(Project, c.project_id)
            n = len(proj.milestones) if proj else 4
            done_ms = (n if pp and pp.status == "portfolio" else pp.milestone) if pp else 0
            ring = [1.0 if i < done_ms else 0.0 for i in range(4)]
            lock_msg = f"Selesaikan Bab {proj.unlock_after} dulu untuk membuka proyek ini." if proj else ""
            href = f"/proyek/{c.project_id}"
        else:
            need = prev_learn
            lock_msg = (f"Selesaikan Uji di Bab {need.number} · {need.title} untuk membukanya." if need
                        else "Bab ini belum terbuka.") if c.kind == "chapter" else "Selesaikan semua bab untuk membuka ujian akhir."
            href = f"/bab/{c.id}"
        if state == "soon":
            lock_msg = "Bab ini sedang disiapkan tim kurikulum. Segera hadir."
        nodes.append({
            "id": c.id, "number": c.number, "kind": c.kind, "title": c.title, "subtitle": c.subtitle, "icon": c.icon,
            "module": c.module_label, "x": c.map_x, "ring": ring, "phases": phases, "state": state, "href": href,
            "lock_message": lock_msg, "published": bool(c.version),
        })
        if c.kind == "chapter":
            prev_learn = c
    learn = [c for c in chapters if c.kind == "chapter"]
    done = sum(1 for c in learn if pm.get(c.id) and pm[c.id].completed_at)
    total_phases = 4 * len(learn)
    done_phases = sum(unlock.done_count(pm[c.id].phases) for c in learn if c.id in pm)
    return {
        "path": {"slug": path.slug, "title": path.title, "description": path.description},
        "nodes": nodes,
        "current_id": cur.id if cur else None,
        "summary": {"chapters_done": done, "chapters_total": len(learn), "phases_done": done_phases, "phases_total": total_phases,
                    "pct": round(100 * done_phases / total_phases) if total_phases else 0,
                    "ring": [min(1.0, max(0.0, done_phases / total_phases * 4 - i)) if total_phases else 0 for i in range(4)]},
        "other_paths": [{"slug": p.slug, "title": p.title} for p in db.scalars(select(Path).where(Path.id != path.id))],
    }


@router.get("/chapters/{chapter_id}")
def chapter_overview(chapter_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = get_chapter(db, chapter_id)
    if ch.kind != "chapter":
        raise HTTPException(404, "Bukan bab belajar.")
    chapters = learning.path_chapters(db, ch.path_id)
    pm = learning.progress_map(db, user.id)
    unlocked = learning.is_unlocked(db, user, ch, chapters, pm)
    if not ch.version:
        raise HTTPException(409, {"code": "soon", "message": f"Bab {ch.number} segera hadir", "detail": "Bab ini sedang disiapkan tim kurikulum.",
                                  "redirect": "/peta"})
    if not unlocked and user.role == "learner":
        prev = [c for c in chapters if c.kind == "chapter" and c.position < ch.position]
        need = prev[-1] if prev else None
        raise HTTPException(409, {"code": "locked", "message": f"Bab {ch.number} masih terkunci", "redirect": "/peta",
                                  "detail": f"Selesaikan Uji di Bab {need.number} · {need.title} untuk membukanya." if need else ""})
    prog = learning.ensure_progress(db, user, ch)
    db.commit()
    content = content_svc.published(db, ch, prog.version) or {}
    path = db.get(Path, ch.path_id)
    counts = content_svc.phase_counts(content)
    kuis = content.get("kuis") or {}
    ul = content.get("ulangan") or {}
    chal = content.get("challenge") or {}
    phases = phase_meta(db, user, ch, prog, content)
    cur = unlock.current_phase(prog.phases)
    concepts = learning.concepts_by_key(db, ch.path_id, content.get("concepts", []))
    mrows = {r.concept_id: r for r in db.scalars(select(ConceptMastery).where(ConceptMastery.user_id == user.id))}
    order = {k: i for i, k in enumerate(content.get("concepts", []))}
    skills = sorted(
        [{"key": c.key, "name": c.name, "skill": _skill(c), "tier": mrows[c.id].tier if c.id in mrows else 0,
          "weak": bool(mrows[c.id].weak) if c.id in mrows else False} for c in concepts],
        key=lambda s: order.get(s["key"], 99))
    learn = [c for c in chapters if c.kind == "chapter"]
    primary_label = {"pahami": "Mulai Pahami", "perkuat": "Lanjut Perkuat", "kuis": "Mulai Kuis", "uji": "Pilih Uji"}[cur]
    if cur == "pahami" and float(prog.phases["pahami"].get("progress") or 0) > 0:
        primary_label = f"Lanjut Pahami · scene {_pahami_scene(db, user, ch)}"
    if cur == "perkuat" and _perkuat_solved(db, user, ch) > 0:
        primary_label = f"Lanjut Perkuat · soal {_perkuat_solved(db, user, ch) + 1}"
    if prog.completed_at:
        primary_label = "Ulas Pahami"
    mins = content.get("minutes") or {}
    return {
        "chapter": {**learning.chapter_ref(ch), "description": ch.description, "subtitle": ch.subtitle, "icon": ch.icon,
                    "module": _module_of(ch, chapters)},
        "path": {"slug": path.slug, "title": path.title},
        "position": {"number": ch.number, "total": len(learn)},
        "phases": phases,
        "current": cur,
        "completed": bool(prog.completed_at),
        "ring": unlock.ring_values(prog.phases),
        "primary": {"label": primary_label, "href": phase_link(ch, "pahami" if prog.completed_at else cur, content), "phase": "pahami" if prog.completed_at else cur},
        "eta": {"total": sum(int(v or 0) for v in mins.values()), "left": 0 if prog.completed_at else eta_minutes(content, prog.phases)},
        "facts": {
            "scenes": counts["scenes"], "live": sum(1 for s in content.get("pahami", {}).get("scenes", []) if (s.get("visual") or {}).get("type") in ("livecode", "knobcalc")),
            "pahami_minutes": mins.get("pahami", 6), "items": counts["items"],
            "types": len({i["type"] if i["type"] != "predict" else "choice" for i in content.get("perkuat", {}).get("items", [])}),
            "round": kuis.get("round_size", 10), "seconds": kuis.get("seconds", 20), "pass_pct": kuis.get("pass_pct", 70),
            "exam": {"count": len(ul.get("questions", [])), "minutes": ul.get("minutes", 30), "pass": ul.get("pass_mark", 75)} if ul.get("questions") else None,
            "challenge": {"title": chal.get("title", "")} if chal else None,
            "uji_mode": content.get("uji_mode", "any"),
        },
        "skills": skills,
        "cheatsheet": content.get("cheatsheet", "") if prog.phases["pahami"]["state"] == "done" else None,
    }


def _skill(c: Concept) -> str:
    return c.skill or c.name


def _module_of(ch: Chapter, chapters: list[Chapter]) -> str:
    label = ""
    for c in chapters:
        if c.module_label:
            label = c.module_label
        if c.id == ch.id:
            break
    return label.split("·")[-1].strip() if label else ""


@router.get("/progress")
def progress(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    path = _user_path(db, user)
    chapters = learning.path_chapters(db, path.id)
    pm = learning.progress_map(db, user.id)
    learn = [c for c in chapters if c.kind == "chapter"]
    cur = learning.current_chapter(db, user, chapters, pm)
    # constellation
    concepts = list(db.scalars(select(Concept).where(Concept.path_id == path.id)))
    mrows = {r.concept_id: r for r in db.scalars(select(ConceptMastery).where(ConceptMastery.user_id == user.id))}
    by_key = {c.key: c for c in concepts}
    stars = []
    for c in concepts:
        m = mrows.get(c.id)
        tier = m.tier if m else 0
        state = "off" if tier == 0 else ("weak" if m and m.weak else "on")
        stars.append({"key": c.key, "name": c.name, "x": c.x, "y": c.y, "mastery": round(tier / 5, 2), "state": state, "tier": tier})
    edges = [[req, c.key] for c in concepts for req in (c.requires or []) if req in by_key]
    # kpis
    first_try = db.execute(select(Attempt.correct).where(Attempt.user_id == user.id, Attempt.phase == "perkuat", Attempt.attempt_no == 1)).scalars().all()
    acc = round(100 * sum(1 for x in first_try if x) / len(first_try)) if first_try else 0
    mastery = learning.overall_mastery_pct(db, user, path.id)
    snaps = list(db.scalars(select(MasterySnapshot).where(MasterySnapshot.user_id == user.id).order_by(MasterySnapshot.week_start)))
    trend = _trend(snaps)
    delta = trend[-1]["pct"] - trend[-2]["pct"] if len(trend) >= 2 else 0
    cur_prog = pm.get(cur.id) if cur else None
    rows = []
    for c in learn:
        p = pm.get(c.id)
        unlocked = learning.is_unlocked(db, user, c, chapters, pm)
        rows.append(_table_row(db, user, c, p, unlocked))
    return {
        "kpis": {
            "mastery": mastery, "mastery_delta": delta,
            "chapters_done": sum(1 for c in learn if pm.get(c.id) and pm[c.id].completed_at), "chapters_total": len(learn),
            "current_text": f"Bab {cur.number} di fase {unlock.PHASE_LABEL[unlock.current_phase(cur_prog.phases)]}" if cur and cur_prog else "semua bab terbit selesai",
            "accuracy": acc, "xp": activity.total_xp(db, user.id), "streak": activity.streak(db, user),
        },
        "path": {"slug": path.slug, "title": path.title},
        "stars": stars, "edges": edges, "trend": trend,
        "review": review_cards(db, user, limit=5),
        "mentor": mentor_note(db, user),
        "table": rows,
    }


def _trend(snaps: list[MasterySnapshot]) -> list[dict[str, Any]]:
    today = activity.local_today()
    this_week = today - timedelta(days=today.weekday())
    weeks = [this_week - timedelta(weeks=7 - i) for i in range(8)]
    by_week = {s.week_start: s.pct for s in snaps}
    out, last = [], 0
    for w in weeks:
        earlier = [s.pct for s in snaps if s.week_start <= w]
        last = by_week.get(w, earlier[-1] if earlier else 0)
        out.append({"week": w.isoformat(), "pct": last})
    return out


def _table_row(db: Session, user: User, c: Chapter, p: ChapterProgress | None, unlocked: bool) -> dict[str, Any]:
    content = content_svc.published(db, c, p.version if p else None) or {}
    tier = 0
    if content.get("concepts"):
        tier = round(learning.chapter_mastery_pct(db, user, c, content["concepts"]) / 20)
    if not p:
        none = "terkunci" if not unlocked or not c.version else "–"
        return {"id": c.id, "title": f"{c.number} · {c.title}", "active": False, "cells": [{"text": none, "on": False}] + [{"text": "–", "on": False}] * 3, "tier": 0}
    ph = p.phases
    counts = content_svc.phase_counts(content)
    cells = []
    cells.append({"text": "selesai" if ph["pahami"]["state"] == "done" else f"{_pahami_scene(db, user, c)}/{counts['scenes']}", "on": True})
    if ph["perkuat"]["state"] == "done":
        cells.append({"text": f"{ph['perkuat'].get('score', 100):.0f}%", "on": True})
    elif ph["perkuat"]["state"] == "open":
        cells.append({"text": f"{_perkuat_solved(db, user, c)}/{counts['items']}", "on": True})
    else:
        cells.append({"text": "–", "on": False})
    if ph["kuis"].get("score") is not None:
        cells.append({"text": f"{ph['kuis']['score']:.0f}%", "on": True})
    else:
        cells.append({"text": "–", "on": False})
    if ph["uji"]["state"] == "done":
        cells.append({"text": _uji_text(db, user, c), "on": True})
    else:
        cells.append({"text": "–", "on": False})
    return {"id": c.id, "title": f"{c.number} · {c.title}", "active": True, "cells": cells, "tier": tier}


def _uji_text(db: Session, user: User, c: Chapter) -> str:
    ex = db.scalar(select(ExamSession).where(ExamSession.user_id == user.id, ExamSession.chapter_id == c.id, ExamSession.passed.is_(True)).order_by(ExamSession.score.desc()))
    if ex:
        return f"Ul · {ex.score}"
    sub = db.scalar(select(Submission).where(Submission.user_id == user.id, Submission.chapter_id == c.id, Submission.kind == "challenge").order_by(Submission.created_at.desc()))
    if sub:
        return f"Ch · {sub.tests_passed}/{sub.tests_total}"
    return "selesai"


class Heartbeat(BaseModel):
    seconds: int = 30
    chapter_id: int | None = None


@router.post("/activity/heartbeat")
def heartbeat(body: Heartbeat, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    activity.record_activity(db, user, body.seconds)
    if body.chapter_id:
        p = db.scalar(select(ChapterProgress).where(ChapterProgress.user_id == user.id, ChapterProgress.chapter_id == body.chapter_id))
        if p and not p.completed_at:
            p.active_seconds += max(0, min(activity.HEARTBEAT_MAX_SECONDS, body.seconds))
    db.commit()
    return {"today_minutes": activity.minutes_on(db, user.id, activity.local_today()), "streak": activity.streak(db, user)}


@router.get("/notifications")
def notifications(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(30))
    return [{"id": n.id, "kind": n.kind, "title": n.title, "body": n.body, "link": n.link, "read": n.read, "ago": ago(n.created_at)} for n in rows]


@router.post("/notifications/read")
def notifications_read(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, bool]:
    for n in db.scalars(select(Notification).where(Notification.user_id == user.id, Notification.read.is_(False))):
        n.read = True
    db.commit()
    return {"ok": True}


@router.get("/palette")
def palette(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    """Items for the ⌘K command palette."""
    if user.role != "learner":
        return {"continue": [], "chapters": [], "concepts": []}
    path = _user_path(db, user)
    chapters = learning.path_chapters(db, path.id)
    pm = learning.progress_map(db, user.id)
    cur = learning.current_chapter(db, user, chapters, pm)
    cont = []
    if cur and cur.id in pm:
        p = pm[cur.id]
        content = content_svc.published(db, cur, p.version) or {}
        ph = unlock.current_phase(p.phases)
        meta = next(m for m in phase_meta(db, user, cur, p, content) if m["id"] == ph)
        cont.append({"icon": "play", "title": f"Lanjut: {cur.title}", "hint": f"{unlock.PHASE_LABEL[ph]} · {meta['short']}", "href": meta["link"]})
    if _studied_chapters(db, user, pm):
        cont.append({"icon": "zap", "title": "Kuis harian", "hint": "5 soal · 2 menit", "href": "/kuis-harian"})
    chs = []
    for c in chapters:
        if c.kind != "chapter" or not c.version:
            continue
        if learning.is_unlocked(db, user, c, chapters, pm):
            chs.append({"icon": c.icon, "title": f"Bab {c.number} · {c.title}", "hint": c.subtitle, "href": f"/bab/{c.id}"})
    concepts = []
    for c in db.scalars(select(Concept).where(Concept.path_id == path.id)):
        ch = db.get(Chapter, c.chapter_id) if c.chapter_id else None
        if ch and ch.version and ch.id in pm:
            concepts.append({"icon": "sparkles", "title": c.name, "hint": f"konsep · Bab {ch.number}", "href": f"/bab/{ch.id}/pahami?konsep={c.key}"})
    return {"continue": cont, "chapters": chs, "concepts": concepts}
