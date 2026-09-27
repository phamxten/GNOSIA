"""The four phases inside the lesson player: Pahami, Perkuat, Kuis, Uji (Ulangan / Challenge).

Answer keys never leave the server. Every endpoint checks that the phase is
open for the learner; deep links to a locked phase get HTTP 409 with a
`redirect` so the UI can send the learner back to the chapter page.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import SessionLocal, get_db
from ..models import (Attempt, Chapter, ChapterProgress, ExamSession, HintOpen, Klass, QuizRound, Submission, User, now)
from ..security import current_user, user_from_token
from ..services import activity, content as content_svc, learning, runner, scoring, unlock
from .learner import get_chapter, phase_meta

router = APIRouter(prefix="/api", tags=["player"])
ws_router = APIRouter(tags=["ws"])

PRAISE = ["Mantap!", "Tepat sekali!", "Keren!", "Betul!"]


# ------------------------------------------------------------------ guards
def require_phase(db: Session, user: User, ch: Chapter, phase: str) -> tuple[ChapterProgress, dict[str, Any]]:
    if not ch.version:
        raise HTTPException(409, {"code": "soon", "message": "Bab ini sedang disiapkan.", "redirect": "/peta"})
    if user.role == "learner" and not learning.is_unlocked(db, user, ch):
        raise HTTPException(409, {"code": "locked", "message": f"Bab {ch.number} masih terkunci", "redirect": "/peta"})
    prog = learning.ensure_progress(db, user, ch)
    if not unlock.is_open(prog.phases, phase):
        prev = unlock.PHASES[unlock.PHASES.index(phase) - 1]
        db.commit()
        raise HTTPException(409, {"code": "phase_locked", "message": f"Selesaikan {unlock.PHASE_LABEL[prev]} dulu",
                                  "detail": f"{unlock.PHASE_LABEL[phase]} terbuka setelah {unlock.PHASE_LABEL[prev]} selesai.",
                                  "redirect": f"/bab/{ch.id}"})
    content = content_svc.published(db, ch, prog.version) or {}
    return prog, content


def header(db: Session, user: User, ch: Chapter, prog: ChapterProgress, content: dict[str, Any]) -> dict[str, Any]:
    return {
        "chapter": learning.chapter_ref(ch),
        "phases": phase_meta(db, user, ch, prog, content),
        "xp": activity.week_xp(db, user.id),
        "streak": activity.streak(db, user),
    }


def _assist_cap(user: User) -> int:
    return max(0, min(6, user.assist_cap if user.assist_cap is not None else 6))


# ================================================================== PAHAMI
@router.get("/chapters/{chapter_id}/pahami")
def pahami(chapter_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = get_chapter(db, chapter_id)
    prog, content = require_phase(db, user, ch, "pahami")
    st = learning.player_state(db, user, ch, "pahami")
    db.commit()
    scenes = content.get("pahami", {}).get("scenes", [])
    counts = content_svc.phase_counts(content)
    return {
        **header(db, user, ch, prog, content),
        "scenes": scenes,
        "scene": min(max(1, int(st.data.get("scene", 1))), max(1, len(scenes))),
        "done": prog.phases["pahami"]["state"] == "done",
        "minutes": (content.get("minutes") or {}).get("pahami", 6),
        "next": {"items": counts["items"]},
    }


class SceneIn(BaseModel):
    scene: int


@router.post("/chapters/{chapter_id}/pahami/scene")
def pahami_scene(chapter_id: int, body: SceneIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = get_chapter(db, chapter_id)
    prog, content = require_phase(db, user, ch, "pahami")
    n = len(content.get("pahami", {}).get("scenes", [])) or 1
    scene = max(1, min(n, body.scene))
    st = learning.player_state(db, user, ch, "pahami")
    data = dict(st.data)
    data["scene"] = scene
    data["max_scene"] = max(scene, int(data.get("max_scene", 1)))
    learning.save_state(st, data)
    learning.set_phase_progress(db, prog, "pahami", (data["max_scene"] - 1) / n)
    activity.record_activity(db, user, 0)
    db.commit()
    return {"scene": scene, "progress": prog.phases["pahami"]["progress"]}


@router.post("/chapters/{chapter_id}/pahami/complete")
def pahami_complete(chapter_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = get_chapter(db, chapter_id)
    prog, content = require_phase(db, user, ch, "pahami")
    res = learning.complete_phase(db, user, ch, "pahami")
    db.commit()
    return {**res, "xp_week": activity.week_xp(db, user.id), "next": {"items": content_svc.phase_counts(content)["items"]}}


# ================================================================= PERKUAT
def _perkuat_items(content: dict[str, Any]) -> list[dict[str, Any]]:
    return content.get("perkuat", {}).get("items", [])


def _perkuat_state(db: Session, user: User, ch: Chapter, content: dict[str, Any], mode: str) -> Any:
    st = learning.player_state(db, user, ch, "perkuat" if mode == "phase" else "mini")
    data = dict(st.data)
    items = _perkuat_items(content)
    if mode == "phase" and not data.get("order"):
        data = {"order": [i["id"] for i in items if not i.get("adaptive")], "index": 0, "solved": {}, "attempts": {},
                "hint": {}, "first_try": {}, "inserted": [], "inserted_for": []}
        learning.save_state(st, data)
    return st, data


def _perkuat_view(db: Session, user: User, ch: Chapter, prog: ChapterProgress, content: dict[str, Any], data: dict[str, Any], mode: str) -> dict[str, Any]:
    items = _perkuat_items(content)
    by_id = {i["id"]: i for i in items}
    order = [i for i in data.get("order", []) if i in by_id]
    pub = []
    for iid in order:
        it = content_svc.perkuat_item_public(by_id[iid])
        it["similar"] = iid in data.get("inserted", [])
        pub.append(it)
    cap = _assist_cap(user)
    return {
        **header(db, user, ch, prog, content),
        "mode": mode,
        "items": pub,
        "index": min(int(data.get("index", 0)), max(0, len(order) - 1)),
        "solved": data.get("solved", {}),
        "attempts": data.get("attempts", {}),
        "hint": data.get("hint", {}),
        "assist_cap": min(cap, 5),
        "solution_allowed": cap >= 6,
        "done": prog.phases["perkuat"]["state"] == "done" if mode == "phase" else False,
        "kuis": {"round": content.get("kuis", {}).get("round_size", 10)},
        "praise": PRAISE,
    }


@router.get("/chapters/{chapter_id}/perkuat")
def perkuat(chapter_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = get_chapter(db, chapter_id)
    prog, content = require_phase(db, user, ch, "perkuat")
    st, data = _perkuat_state(db, user, ch, content, "phase")
    db.commit()
    return _perkuat_view(db, user, ch, prog, content, data, "phase")


class MiniIn(BaseModel):
    concepts: list[str] = []
    round_id: int | None = None  # build from the misses of a Kuis round


@router.post("/chapters/{chapter_id}/perkuat/mini")
def perkuat_mini(chapter_id: int, body: MiniIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    """Perkuat mini: 3 items for the missed concepts. Available once Perkuat is open; never changes phase state."""
    ch = get_chapter(db, chapter_id)
    prog, content = require_phase(db, user, ch, "perkuat")
    concepts = set(body.concepts)
    if body.round_id:
        rnd = db.get(QuizRound, body.round_id)
        if rnd and rnd.user_id == user.id:
            bank = {q["id"]: q for q in content.get("kuis", {}).get("bank", [])}
            for (cid, qid), ans in zip(rnd.question_refs, rnd.answers):
                if not ans.get("correct") and qid in bank:
                    concepts.update(bank[qid].get("concepts", []))
    items = _perkuat_items(content)
    pool = [i for i in items if concepts & set(i.get("concepts", []))] or items
    random.shuffle(pool)
    chosen = [i["id"] for i in pool[:3]]
    st = learning.player_state(db, user, ch, "mini")
    learning.save_state(st, {"order": chosen, "index": 0, "solved": {}, "attempts": {}, "hint": {}, "first_try": {},
                             "inserted": [], "inserted_for": [], "concepts": sorted(concepts)})
    db.commit()
    return _perkuat_view(db, user, ch, prog, content, st.data, "mini")


class CheckIn(BaseModel):
    item_id: str
    answer: Any = None
    ms: int = 0
    mode: str = "phase"


@router.post("/chapters/{chapter_id}/perkuat/check")
def perkuat_check(chapter_id: int, body: CheckIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = get_chapter(db, chapter_id)
    prog, content = require_phase(db, user, ch, "perkuat")
    mode = "mini" if body.mode == "mini" else "phase"
    st, data = _perkuat_state(db, user, ch, content, mode)
    items = _perkuat_items(content)
    item = content_svc.find(items, body.item_id)
    if item is None or body.item_id not in data.get("order", []):
        raise HTTPException(404, "Soal tidak ditemukan.")
    ok, marks = content_svc.check_perkuat(item, body.answer)
    iid = item["id"]
    attempts = dict(data.get("attempts", {}))
    attempts[iid] = attempts.get(iid, 0) + 1
    n = attempts[iid]
    data["attempts"] = attempts
    hint = dict(data.get("hint", {}))
    db.add(Attempt(user_id=user.id, chapter_id=ch.id, phase="perkuat", item_id=iid, attempt_no=n, correct=ok,
                   answer=body.answer, hint_level=hint.get(iid, 0), ms=max(0, body.ms), version=prog.version))
    out: dict[str, Any] = {"correct": ok, "marks": marks, "attempt": n}
    if ok:
        solved = dict(data.get("solved", {}))
        xp = 0
        if iid not in solved:
            first = n == 1
            solved[iid] = True
            ft = dict(data.get("first_try", {}))
            ft[iid] = first
            data["first_try"] = ft
            xp = activity.add_xp(db, user, scoring.perkuat_item_xp(first), f"Perkuat · {ch.title}")
            learning.touch_mastery(db, user, ch.path_id, item.get("concepts", []), 2, "Perkuat benar", clear_weak=mode == "mini")
        data["solved"] = solved
        out.update({"xp": xp, "explain": item.get("explain", ""), "praise": PRAISE[len(solved) % len(PRAISE)]})
        if mode == "phase":
            base = [i for i in data["order"] if i not in data.get("inserted", [])]
            learning.set_phase_progress(db, prog, "perkuat", len([i for i in base if i in solved]) / max(1, len(base)))
    else:
        # the ladder advances one step on a wrong answer (L3 → L4 → L5), capped by the mentor setting
        cap = min(5, _assist_cap(user))
        hints = item.get("hints") or {}
        avail = [lvl for lvl in (3, 4, 5) if hints.get(f"l{lvl}") and lvl <= cap]
        nxt = next((lvl for lvl in avail if lvl > hint.get(iid, 0)), None)
        if nxt:
            hint[iid] = nxt
        data["hint"] = hint
        out["hint"] = hints.get("l3") if cap >= 3 and hints.get("l3") else "Coba lihat lagi pelan-pelan."
        out["hint_level"] = hint.get(iid, 0)
        out["solution_available"] = n >= 3 and bool(item.get("l6")) and _assist_cap(user) >= 6
        if n == 2:
            learning.mark_weak(db, user, ch.path_id, item.get("concepts", []), "perkuat",
                               f"Salah 2× di soal “{_plain(item.get('label') or item.get('title', ''))}”.")
        # adaptivity: first wrong answer on an item with a similar twin inserts it right after (once per item)
        sim = item.get("similar_id")
        if mode == "phase" and sim and n == 1 and iid not in data.get("inserted_for", []) and sim not in data["order"]:
            twin = content_svc.find(items, sim)
            if twin:
                order = list(data["order"])
                order.insert(order.index(iid) + 1, sim)
                data["order"] = order
                data["inserted"] = [*data.get("inserted", []), sim]
                data["inserted_for"] = [*data.get("inserted_for", []), iid]
                pub = content_svc.perkuat_item_public(twin)
                pub["similar"] = True
                out["inserted"] = pub
    learning.save_state(st, data)
    activity.record_activity(db, user, 0)
    db.commit()
    out["xp_week"] = activity.week_xp(db, user.id)
    return out


class HintIn(BaseModel):
    item_id: str
    ms_since_shown: int = 0
    mode: str = "phase"


@router.post("/chapters/{chapter_id}/perkuat/hint")
def perkuat_hint(chapter_id: int, body: HintIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = get_chapter(db, chapter_id)
    prog, content = require_phase(db, user, ch, "perkuat")
    mode = "mini" if body.mode == "mini" else "phase"
    st, data = _perkuat_state(db, user, ch, content, mode)
    item = content_svc.find(_perkuat_items(content), body.item_id)
    if item is None:
        raise HTTPException(404, "Soal tidak ditemukan.")
    hints = item.get("hints") or {}
    cap = min(5, _assist_cap(user))
    hint = dict(data.get("hint", {}))
    cur = hint.get(item["id"], 0)
    available = [lvl for lvl in (3, 4, 5) if hints.get(f"l{lvl}") and lvl <= cap]
    nxt = next((lvl for lvl in available if lvl > cur), None)
    if nxt is None:
        level = max([lvl for lvl in available if lvl <= cur], default=None)
        if level is None:
            return {"level": 0, "text": "Petunjuk untuk soal ini dibatasi mentormu. Coba lihat lagi pelan-pelan.", "max": True}
        return {"level": level, "text": hints[f"l{level}"], "max": True}
    hint[item["id"]] = nxt
    data["hint"] = hint
    learning.save_state(st, data)
    db.add(HintOpen(user_id=user.id, chapter_id=ch.id, item_id=item["id"], level=nxt, ms_since_shown=max(0, body.ms_since_shown)))
    db.commit()
    return {"level": nxt, "text": hints[f"l{nxt}"], "max": not any(lvl > nxt for lvl in available)}


class SolutionIn(BaseModel):
    item_id: str
    mode: str = "phase"


@router.post("/chapters/{chapter_id}/perkuat/solution")
def perkuat_solution(chapter_id: int, body: SolutionIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = get_chapter(db, chapter_id)
    prog, content = require_phase(db, user, ch, "perkuat")
    mode = "mini" if body.mode == "mini" else "phase"
    st, data = _perkuat_state(db, user, ch, content, mode)
    item = content_svc.find(_perkuat_items(content), body.item_id)
    if item is None:
        raise HTTPException(404, "Soal tidak ditemukan.")
    if data.get("attempts", {}).get(item["id"], 0) < 3 or _assist_cap(user) < 6 or not item.get("l6"):
        raise HTTPException(403, "Jawaban lengkap terbuka setelah 3 kali mencoba.")
    hint = dict(data.get("hint", {}))
    hint[item["id"]] = 6
    data["hint"] = hint
    learning.save_state(st, data)
    db.add(HintOpen(user_id=user.id, chapter_id=ch.id, item_id=item["id"], level=6))
    db.commit()
    return {"level": 6, "html": item["l6"]}


class IndexIn(BaseModel):
    index: int
    mode: str = "phase"


@router.post("/chapters/{chapter_id}/perkuat/index")
def perkuat_index(chapter_id: int, body: IndexIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = get_chapter(db, chapter_id)
    prog, content = require_phase(db, user, ch, "perkuat")
    st, data = _perkuat_state(db, user, ch, content, "mini" if body.mode == "mini" else "phase")
    data["index"] = max(0, min(body.index, len(data.get("order", [])) - 1))
    learning.save_state(st, data)
    db.commit()
    return {"index": data["index"]}


class CompleteIn(BaseModel):
    mode: str = "phase"


@router.post("/chapters/{chapter_id}/perkuat/complete")
def perkuat_complete(chapter_id: int, body: CompleteIn | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = get_chapter(db, chapter_id)
    prog, content = require_phase(db, user, ch, "perkuat")
    mode = "mini" if body and body.mode == "mini" else "phase"
    st, data = _perkuat_state(db, user, ch, content, mode)
    order = data.get("order", [])
    missing = [i for i in order if i not in data.get("solved", {})]
    if missing:
        raise HTTPException(409, {"code": "unfinished", "message": "Masih ada soal yang belum benar.", "missing": missing})
    base = [i for i in order if i not in data.get("inserted", [])]
    first = sum(1 for i in base if data.get("first_try", {}).get(i))
    acc = scoring.accuracy_pct(first, len(base))
    items = {i["id"]: i for i in _perkuat_items(content)}
    if mode == "mini":
        learning.touch_mastery(db, user, ch.path_id, sorted({c for i in order for c in items.get(i, {}).get("concepts", [])}), 2,
                               "Perkuat mini selesai", clear_weak=True)
        db.commit()
        return {"mode": "mini", "accuracy": acc, "first_try": first, "total": len(base), "xp": 0}
    # mastery: per concept, first-try accuracy ≥ 80% → Diterapkan (3), otherwise Dilatih (2)
    per: dict[str, list[bool]] = {}
    for i in base:
        for c in items.get(i, {}).get("concepts", []):
            per.setdefault(c, []).append(bool(data.get("first_try", {}).get(i)))
    for c, vals in per.items():
        learning.touch_mastery(db, user, ch.path_id, [c], 3 if sum(vals) / len(vals) >= 0.8 else 2, "Perkuat selesai")
    res = learning.complete_phase(db, user, ch, "perkuat", acc)
    db.commit()
    kuis = content.get("kuis", {})
    return {**res, "accuracy": acc, "first_try": first, "total": len(base), "xp_week": activity.week_xp(db, user.id),
            "kuis": {"round": kuis.get("round_size", 10), "pass_pct": kuis.get("pass_pct", 70)}}


def _plain(html_text: str) -> str:
    import re
    return re.sub(r"<[^>]+>", "", html_text or "").strip()


# ==================================================================== KUIS
def _kuis_cfg(content: dict[str, Any]) -> dict[str, Any]:
    k = content.get("kuis") or {}
    return {"round_size": k.get("round_size", 10), "seconds": k.get("seconds", 20), "pass_pct": k.get("pass_pct", 70),
            "combo_max": k.get("combo_max", 3)}


@router.get("/chapters/{chapter_id}/kuis")
def kuis_intro(chapter_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = get_chapter(db, chapter_id)
    prog, content = require_phase(db, user, ch, "kuis")
    tries = db.scalar(select(func.count()).select_from(QuizRound).where(QuizRound.user_id == user.id, QuizRound.chapter_id == ch.id,
                                                                     QuizRound.kind == "gate", QuizRound.finished.is_(True))) or 0
    db.commit()
    return {**header(db, user, ch, prog, content), **_kuis_cfg(content), "tries": tries,
            "best": prog.phases["kuis"].get("score"), "passed": prog.phases["kuis"]["state"] == "done",
            "bank": len(content.get("kuis", {}).get("bank", [])),
            "uji": _uji_options(content)}


def _uji_options(content: dict[str, Any]) -> dict[str, Any]:
    mode = content.get("uji_mode", "any")
    ul = content.get("ulangan") or {}
    return {"ulangan": bool(ul.get("questions")) and mode in ("any", "ulangan"),
            "challenge": bool(content.get("challenge")) and mode in ("any", "challenge"),
            "exam": {"count": len(ul.get("questions", [])), "minutes": ul.get("minutes", 30), "pass": ul.get("pass_mark", 75)},
            "challenge_title": (content.get("challenge") or {}).get("title", "")}


class RoundIn(BaseModel):
    kind: str = "gate"  # gate | review
    concept: str | None = None


@router.post("/chapters/{chapter_id}/kuis/rounds")
def kuis_round(chapter_id: int, body: RoundIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = get_chapter(db, chapter_id)
    kind = "review" if body.kind == "review" else "gate"
    if kind == "gate":
        prog, content = require_phase(db, user, ch, "kuis")
    else:
        prog, content = require_phase(db, user, ch, "perkuat")
    cfg = _kuis_cfg(content)
    bank = content.get("kuis", {}).get("bank", [])
    if kind == "review":
        pool = [q for q in bank if body.concept in q.get("concepts", [])] or bank
        picked = random.sample(pool, min(3, len(pool)))
    else:
        picked = random.sample(bank, min(cfg["round_size"], len(bank)))
    rnd = QuizRound(user_id=user.id, chapter_id=ch.id, kind=kind, version=prog.version,
                    question_refs=[[ch.id, q["id"]] for q in picked], answers=[], per_question_sec=cfg["seconds"])
    db.add(rnd)
    db.commit()
    return {"round_id": rnd.id, "kind": kind, "seconds": cfg["seconds"], "combo_max": cfg["combo_max"],
            "pass_pct": cfg["pass_pct"], "questions": [content_svc.kuis_question_public(q) for q in picked]}


@router.post("/kuis-harian/rounds")
def daily_round(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    pm = learning.progress_map(db, user.id)
    pool: list[tuple[Chapter, dict[str, Any]]] = []
    for cid, p in pm.items():
        if p.phases["pahami"]["state"] != "done":
            continue
        ch = db.get(Chapter, cid)
        content = content_svc.published(db, ch, p.version) or {}
        pool += [(ch, q) for q in content.get("kuis", {}).get("bank", [])]
    if not pool:
        raise HTTPException(409, {"code": "empty", "message": "Selesaikan Pahami di satu bab dulu untuk membuka kuis harian."})
    picked = random.sample(pool, min(5, len(pool)))
    rnd = QuizRound(user_id=user.id, chapter_id=None, kind="daily", question_refs=[[c.id, q["id"]] for c, q in picked],
                    answers=[], per_question_sec=20)
    db.add(rnd)
    db.commit()
    return {"round_id": rnd.id, "kind": "daily", "seconds": 20, "combo_max": 3, "pass_pct": 0,
            "questions": [content_svc.kuis_question_public(q) for _, q in picked], "xp": activity.week_xp(db, user.id),
            "streak": activity.streak(db, user)}


def _round_questions(db: Session, rnd: QuizRound) -> list[dict[str, Any]]:
    out = []
    cache: dict[int, dict[str, Any]] = {}
    for cid, qid in rnd.question_refs:
        if cid not in cache:
            ch = db.get(Chapter, cid)
            ver = rnd.version if rnd.chapter_id == cid else None
            cache[cid] = content_svc.published(db, ch, ver) or {}
        q = content_svc.find(cache[cid].get("kuis", {}).get("bank", []), qid)
        out.append(q or {"id": qid, "t": "(soal dihapus)", "o": ["-"] * 4, "a": 0, "e": ""})
    return out


class AnswerIn(BaseModel):
    index: int
    choice: int  # -1 = timeout
    left: int = 0


def _get_round(db: Session, user: User, round_id: int) -> QuizRound:
    rnd = db.get(QuizRound, round_id)
    if rnd is None or rnd.user_id != user.id:
        raise HTTPException(404, "Ronde tidak ditemukan.")
    return rnd


@router.post("/kuis/rounds/{round_id}/answer")
def kuis_answer(round_id: int, body: AnswerIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    rnd = _get_round(db, user, round_id)
    if rnd.finished:
        raise HTTPException(409, "Ronde sudah selesai.")
    answers = list(rnd.answers or [])
    if body.index != len(answers):
        raise HTTPException(409, "Urutan soal tidak sesuai.")
    qs = _round_questions(db, rnd)
    q = qs[body.index]
    # server-side clock: seconds since the previous answer (or the round start), minus reveal/countdown grace
    last_ts = datetime.fromisoformat(answers[-1]["at"]) if answers else rnd.created_at
    if last_ts.tzinfo is None:
        last_ts = last_ts.replace(tzinfo=timezone.utc)
    elapsed = (now() - last_ts).total_seconds() - (1.4 if answers else 3.0)
    left = max(0, min(int(body.left), rnd.per_question_sec, int(rnd.per_question_sec - elapsed + 1)))
    correct = body.choice == q.get("a") and body.choice >= 0
    combo_max = 3
    points = scoring.kuis_points(rnd.combo, left) if correct else 0
    rnd.score += points
    rnd.combo = scoring.next_combo(rnd.combo, correct, combo_max)
    rnd.best_combo = max(rnd.best_combo, rnd.combo)
    answers.append({"qid": q["id"], "chapter_id": rnd.question_refs[body.index][0], "choice": body.choice, "correct": correct,
                    "left": left, "points": points, "at": now().isoformat()})
    rnd.answers = answers
    if rnd.chapter_id or rnd.kind == "daily":
        db.add(Attempt(user_id=user.id, chapter_id=rnd.question_refs[body.index][0], phase="kuis", item_id=q["id"], correct=correct,
                       answer=body.choice, ms=(rnd.per_question_sec - left) * 1000, version=rnd.version,
                       attempt_no=1 + (db.scalar(select(func.count()).select_from(Attempt).where(
                           Attempt.user_id == user.id, Attempt.phase == "kuis", Attempt.item_id == q["id"])) or 0)))
    activity.record_activity(db, user, 0)
    db.commit()
    return {"correct": correct, "answer": q.get("a"), "points": points, "score": rnd.score, "combo": rnd.combo, "best_combo": rnd.best_combo}


@router.post("/kuis/rounds/{round_id}/finish")
def kuis_finish(round_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    rnd = _get_round(db, user, round_id)
    qs = _round_questions(db, rnd)
    answers = list(rnd.answers or [])
    while len(answers) < len(qs):  # unanswered = timeout
        answers.append({"qid": qs[len(answers)]["id"], "choice": -1, "correct": False, "left": 0, "points": 0, "at": now().isoformat()})
    correct = sum(1 for a in answers if a["correct"])
    pct = scoring.accuracy_pct(correct, len(qs))
    xp = 0
    result: dict[str, Any] = {}
    if not rnd.finished:
        rnd.finished = True
        rnd.answers = answers
        rnd.pct = pct
        if rnd.kind == "daily":
            today_start = datetime.combine(activity.local_today(), datetime.min.time(), activity.LOCAL_TZ)
            already = db.scalar(select(func.count()).select_from(QuizRound).where(
                QuizRound.user_id == user.id, QuizRound.kind == "daily", QuizRound.finished.is_(True),
                QuizRound.created_at >= today_start, QuizRound.id != rnd.id)) or 0
            if not already:
                xp += activity.add_xp(db, user, min(scoring.XP_DAILY_QUIZ_CAP, scoring.kuis_xp(rnd.score)), "Kuis harian")
            rnd.passed = True
        else:
            ch = db.get(Chapter, rnd.chapter_id)
            xp += activity.add_xp(db, user, scoring.kuis_xp(rnd.score), f"Kuis · {ch.title}")
            content = content_svc.published(db, ch, rnd.version) or {}
            pass_pct = _kuis_cfg(content)["pass_pct"]
            for q, a in zip(qs, answers):
                if a["correct"]:
                    learning.touch_mastery(db, user, ch.path_id, q.get("concepts", []), 4 if pct >= 90 else 3, "Kuis benar",
                                           clear_weak=rnd.kind == "review")
                else:
                    picked = q["o"][a["choice"]] if 0 <= a["choice"] < len(q["o"]) else None
                    note = (f"Kamu menjawab {_plain(picked)}, seharusnya {_plain(q['o'][q['a']])}." if picked is not None
                            else "Waktu habis di soal ini.")
                    learning.mark_weak(db, user, ch.path_id, q.get("concepts", []), "kuis", note)
            if rnd.kind == "gate":
                prog = learning.ensure_progress(db, user, ch)
                was_done = prog.phases["kuis"]["state"] == "done"
                if pct >= pass_pct:
                    res = learning.complete_phase(db, user, ch, "kuis", pct)
                    xp += res["xp"]
                else:
                    prog.phases, _ = unlock.record_kuis(prog.phases, pct, pass_pct)
                    prog.updated_at = now()
                rnd.passed = pct >= pass_pct
                result["was_done"] = was_done
                result["pass_pct"] = pass_pct
                result["uji"] = _uji_options(content)
            else:
                rnd.passed = pct >= 70
        db.commit()
    pass_pct = result.get("pass_pct", 70)
    review = []
    for q, a in zip(qs, answers):
        review.append({"t": q["t"], "answer": q["o"][q["a"]] if q.get("o") else "", "e": q.get("e", ""), "ok": a["correct"],
                       "picked": q["o"][a["choice"]] if 0 <= a["choice"] < len(q.get("o", [])) else None, "trivia": bool(q.get("trivia"))})
    return {
        "kind": rnd.kind, "pct": pct, "correct": correct, "total": len(qs), "best_combo": rnd.best_combo, "score": rnd.score,
        "xp": xp, "passed": bool(rnd.passed), "pass_pct": pass_pct, "missing": max(0, pass_pct - pct),
        "review": review, "chapter_id": rnd.chapter_id, "xp_week": activity.week_xp(db, user.id), **result,
    }


# ================================================================= ULANGAN
def _exam(content: dict[str, Any]) -> dict[str, Any]:
    ex = content.get("ulangan") or {}
    if not ex.get("questions"):
        raise HTTPException(404, "Bab ini tidak punya ulangan.")
    return ex


def _session_view(db: Session, s: ExamSession, content: dict[str, Any]) -> dict[str, Any]:
    ex = _exam(content)
    return {
        "id": s.id, "deadline": s.deadline.isoformat(), "server_now": now().isoformat(),
        "answers": s.answers or {}, "flags": s.flags or [], "submitted": bool(s.submitted_at),
        "questions": [content_svc.exam_question_public(q) for q in ex["questions"]],
        "minutes": ex.get("minutes", 30), "pass_mark": ex.get("pass_mark", 75),
        "result": _exam_result(s) if s.submitted_at else None,
    }


def _exam_result(s: ExamSession) -> dict[str, Any]:
    used = (s.submitted_at - s.started_at).total_seconds() if s.submitted_at else 0
    return {"score": s.score, "passed": s.passed, "rows": s.results or [], "used": f"{int(used // 60):02d}:{int(used % 60):02d}"}


@router.post("/chapters/{chapter_id}/ulangan/start")
def ulangan_start(chapter_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = get_chapter(db, chapter_id)
    prog, content = require_phase(db, user, ch, "uji")
    if content.get("uji_mode") == "challenge":
        raise HTTPException(409, {"code": "mode", "message": "Bab ini memakai Challenge.", "redirect": f"/bab/{ch.id}/uji/challenge"})
    ex = _exam(content)
    s = db.scalar(select(ExamSession).where(ExamSession.user_id == user.id, ExamSession.chapter_id == ch.id,
                                            ExamSession.submitted_at.is_(None)).order_by(ExamSession.id.desc()))
    if s and _deadline(s) < now() - timedelta(seconds=60):
        _grade(db, user, ch, s, content)  # time ran out while away: auto-submit
        db.commit()
        s = None
    if s is None:
        s = ExamSession(user_id=user.id, chapter_id=ch.id, version=prog.version,
                        deadline=now() + timedelta(minutes=ex.get("minutes", 30)), answers={}, flags=[])
        db.add(s)
        db.commit()
    return {**header(db, user, ch, prog, content), "session": _session_view(db, s, content)}


def _deadline(s: ExamSession) -> datetime:
    d = s.deadline
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _get_session(db: Session, user: User, sid: int) -> ExamSession:
    s = db.get(ExamSession, sid)
    if s is None or s.user_id != user.id:
        raise HTTPException(404, "Sesi ulangan tidak ditemukan.")
    return s


class ExamAnswerIn(BaseModel):
    qid: str
    answer: Any = None


@router.put("/ulangan/{sid}/answers")
def ulangan_answer(sid: int, body: ExamAnswerIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    s = _get_session(db, user, sid)
    if s.submitted_at:
        raise HTTPException(409, "Ulangan sudah dikumpulkan.")
    if now() > _deadline(s) + timedelta(seconds=60):
        raise HTTPException(409, "Waktu ulangan sudah habis.")
    answers = dict(s.answers or {})
    if body.answer in (None, ""):
        answers.pop(body.qid, None)
    else:
        answers[body.qid] = body.answer
    s.answers = answers
    activity.record_activity(db, user, 0)
    db.commit()
    return {"saved": True, "answered": len(answers)}


class FlagsIn(BaseModel):
    flags: list[str]


@router.put("/ulangan/{sid}/flags")
def ulangan_flags(sid: int, body: FlagsIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    s = _get_session(db, user, sid)
    if s.submitted_at:
        raise HTTPException(409, "Ulangan sudah dikumpulkan.")
    s.flags = sorted(set(body.flags))
    db.commit()
    return {"flags": s.flags}


class SubmitIn(BaseModel):
    answers: dict[str, Any] | None = None  # final sync of locally kept answers (offline)


@router.post("/ulangan/{sid}/submit")
def ulangan_submit(sid: int, body: SubmitIn | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    s = _get_session(db, user, sid)
    ch = db.get(Chapter, s.chapter_id)
    content = content_svc.published(db, ch, s.version) or {}
    extra: dict[str, Any] = {}
    if not s.submitted_at:
        if body and body.answers and now() <= _deadline(s) + timedelta(seconds=120):
            s.answers = {**(s.answers or {}), **{k: v for k, v in body.answers.items() if v not in (None, "")}}
        extra = _grade(db, user, ch, s, content)
        db.commit()
    return {**_session_view(db, s, content), **extra, "xp_week": activity.week_xp(db, user.id)}


def _grade(db: Session, user: User, ch: Chapter, s: ExamSession, content: dict[str, Any]) -> dict[str, Any]:
    ex = _exam(content)
    rows, total, got = [], 0, 0
    for i, q in enumerate(ex["questions"], 1):
        ans = (s.answers or {}).get(q["id"])
        pts = int(q.get("pts", 10))
        total += pts
        note = ""
        if q["type"] == "code":
            if not ans:
                earned, ok = 0, False
            else:
                res = runner.run(str(ans), q.get("tests", []))
                passed = sum(1 for r in res["results"] if r["pass"])
                n = max(1, len(res["results"]))
                earned = round(pts * passed / n)
                ok = passed == n
                if not ok:
                    note = runner.error_text(res.get("error")) or next((r["detail"] for r in res["results"] if not r["pass"]), "")
        else:
            ok = bool(content_svc.check_exam_static(q, ans))
            earned = pts if ok else 0
            if not ok and ans not in (None, ""):
                right = q["o"][q["answer"]] if q["type"] == "choice" else (q.get("accept") or [""])[0]
                given = q["o"][int(ans)] if q["type"] == "choice" and str(ans).lstrip("-").isdigit() and 0 <= int(ans) < len(q["o"]) else ans
                note = f"Kamu menjawab {_plain(str(given))}, seharusnya {_plain(str(right))}."
            elif not ok:
                note = "Belum dijawab."
        got += earned
        db.add(Attempt(user_id=user.id, chapter_id=ch.id, phase="ulangan", item_id=q["id"], correct=ok, answer=ans, version=s.version,
                       attempt_no=1 + (db.scalar(select(func.count()).select_from(Attempt).where(
                           Attempt.user_id == user.id, Attempt.phase == "ulangan", Attempt.item_id == q["id"])) or 0)))
        if ok:
            learning.touch_mastery(db, user, ch.path_id, q.get("concepts", []), 4, "Ulangan benar")
        else:
            learning.mark_weak(db, user, ch.path_id, q.get("concepts", []), "ulangan",
                               f"{note} (Ulangan · soal {i})" if note else f"Salah di Ulangan · soal {i}.")
            if note:
                note += " Konsep ini ditambahkan ke <b>Perlu diulang</b>."
        rows.append({"n": i, "label": q.get("label") or _plain(q["t"])[:60], "ok": ok, "pts": earned, "max": pts, "note": note})
    score = round(100 * got / total) if total else 0
    s.score, s.results, s.submitted_at = score, rows, now()
    s.passed = score >= int(ex.get("pass_mark", 75))
    out: dict[str, Any] = {"chapter_done": False, "xp": 0}
    if s.passed:
        prog = learning.ensure_progress(db, user, ch)
        if prog.phases["uji"]["state"] != "done":
            if score >= 90:
                learning.touch_mastery(db, user, ch.path_id, content.get("concepts", []), 5, "Ulangan ≥ 90")
            res = learning.complete_phase(db, user, ch, "uji", score)
            out = {"chapter_done": res["chapter_done"], "xp": res["xp"], "next_chapter": res["next_chapter"],
                   "mastery": learning.chapter_mastery_pct(db, user, ch, content.get("concepts", []))}
    return out


# =============================================================== CHALLENGE
@router.get("/chapters/{chapter_id}/challenge")
def challenge(chapter_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = get_chapter(db, chapter_id)
    prog, content = require_phase(db, user, ch, "uji")
    chal = content.get("challenge")
    if not chal:
        raise HTTPException(404, "Bab ini tidak punya challenge.")
    if content.get("uji_mode") == "ulangan":
        raise HTTPException(409, {"code": "mode", "message": "Bab ini memakai Ulangan.", "redirect": f"/bab/{ch.id}/uji/ulangan"})
    st = learning.player_state(db, user, ch, "challenge")
    db.commit()
    attempts = db.scalar(select(func.count()).select_from(Attempt).where(Attempt.user_id == user.id, Attempt.chapter_id == ch.id,
                                                                      Attempt.phase == "challenge")) or 0
    return {**header(db, user, ch, prog, content), "challenge": content_svc.challenge_public(chal),
            "code": st.data.get("code", chal.get("starter", "")), "attempts": attempts,
            "solved": prog.phases["uji"]["state"] == "done", "mentor": _mentor_name(db, user),
            "kuis_score": prog.phases["kuis"].get("score")}


def _mentor_name(db: Session, user: User) -> str | None:
    klass = db.get(Klass, user.class_id) if user.class_id else None
    m = db.get(User, klass.mentor_id) if klass and klass.mentor_id else None
    return m.name.split()[0] if m else None


class DraftIn(BaseModel):
    code: str


@router.put("/chapters/{chapter_id}/challenge/draft")
def challenge_draft(chapter_id: int, body: DraftIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = get_chapter(db, chapter_id)
    require_phase(db, user, ch, "uji")
    st = learning.player_state(db, user, ch, "challenge")
    learning.save_state(st, {**st.data, "code": body.code[:runner.MAX_CODE_CHARS]})
    activity.record_activity(db, user, 0)
    db.commit()
    return {"saved": True}


def run_challenge(db: Session, user: User, ch: Chapter, code: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """Runs the tests and records the attempt. Returns (run result, outcome)."""
    prog, content = require_phase(db, user, ch, "uji")
    chal = content.get("challenge") or {}
    tests = chal.get("tests", [])
    res = runner.run(code, tests)
    passed = sum(1 for r in res["results"] if r["pass"])
    all_pass = passed == len(tests) and len(tests) > 0
    n = 1 + (db.scalar(select(func.count()).select_from(Attempt).where(Attempt.user_id == user.id, Attempt.chapter_id == ch.id,
                                                                    Attempt.phase == "challenge")) or 0)
    db.add(Attempt(user_id=user.id, chapter_id=ch.id, phase="challenge", item_id="challenge", attempt_no=n, correct=all_pass,
                   answer={"code": code, "passed": passed, "total": len(tests), "error": res.get("error")}, version=prog.version))
    st = learning.player_state(db, user, ch, "challenge")
    learning.save_state(st, {**st.data, "code": code})
    outcome: dict[str, Any] = {"passed": passed, "total": len(tests), "all_pass": all_pass, "attempt": n, "chapter_done": False, "xp": 0}
    by_id = {t["id"]: t for t in tests}
    for r in res["results"]:
        r["name"] = by_id.get(r["id"], {}).get("name", "")
    if all_pass and prog.phases["uji"]["state"] != "done":
        learning.touch_mastery(db, user, ch.path_id, content.get("concepts", []), 4, "Challenge lulus")
        learning.touch_mastery(db, user, ch.path_id, chal.get("concepts", []), 5, "Challenge lulus")
        res2 = learning.complete_phase(db, user, ch, "uji", 100)
        sub = Submission(user_id=user.id, kind="challenge", chapter_id=ch.id, title=f"Challenge · Bab {ch.number} · {chal.get('title', '')}",
                         filename=chal.get("filename", "main.js"), code=code, attempt_no=n, tests_passed=passed, tests_total=len(tests))
        db.add(sub)
        klass = db.get(Klass, user.class_id) if user.class_id else None
        if klass and klass.mentor_id:
            learning.notify(db, klass.mentor_id, "review", f"{user.name} minta review", sub.title, "/mentor/review")
        outcome.update({"chapter_done": res2["chapter_done"], "xp": res2["xp"], "next_chapter": res2["next_chapter"],
                        "mastery": learning.chapter_mastery_pct(db, user, ch, content.get("concepts", []))})
    elif not all_pass:
        failed_concepts = chal.get("concepts", [])
        if n >= 3 and failed_concepts:
            learning.mark_weak(db, user, ch.path_id, failed_concepts, "uji", f"Challenge belum lulus setelah {n} percobaan.")
    activity.record_activity(db, user, 0)
    db.commit()
    return res, outcome


@router.post("/chapters/{chapter_id}/challenge/run")
def challenge_run(chapter_id: int, body: DraftIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    ch = get_chapter(db, chapter_id)
    res, outcome = run_challenge(db, user, ch, body.code)
    return {"logs": res["logs"], "error": res["error"], "results": res["results"], **outcome, "xp_week": activity.week_xp(db, user.id)}


class ReportIn(BaseModel):
    test_id: str
    body: str = ""


@router.post("/chapters/{chapter_id}/challenge/report")
def challenge_report(chapter_id: int, body: ReportIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    from ..models import ContentReport
    ch = get_chapter(db, chapter_id)
    db.add(ContentReport(user_id=user.id, chapter_id=ch.id, item_id=body.test_id[:40], body=body.body[:1000]))
    db.commit()
    return {"ok": True}


@ws_router.websocket("/ws/challenge/{chapter_id}")
async def challenge_ws(ws: WebSocket, chapter_id: int) -> None:
    """Streams robot results one by one: queued → running → pass/fail (MOTION §3.6)."""
    await ws.accept()
    db = SessionLocal()
    try:
        user = user_from_token(db, ws.cookies.get(settings.session_cookie))
        if user is None:
            await ws.send_json({"type": "error", "message": "Silakan masuk dulu."})
            return
        while True:
            msg = await ws.receive_json()
            code = str(msg.get("code", ""))
            ch = db.get(Chapter, chapter_id)
            if ch is None:
                await ws.send_json({"type": "error", "message": "Bab tidak ditemukan."})
                continue
            try:
                res, outcome = run_challenge(db, user, ch, code)
            except HTTPException as e:
                await ws.send_json({"type": "error", "message": e.detail if isinstance(e.detail, str) else e.detail.get("message")})
                continue
            except runner.RunnerUnavailable as e:
                await ws.send_json({"type": "error", "message": str(e)})
                continue
            await ws.send_json({"type": "queued", "tests": [r["id"] for r in res["results"]], "logs": res["logs"], "error": res["error"]})
            for r in res["results"]:
                await ws.send_json({"type": "running", "id": r["id"]})
                await ws.send_json({"type": "result", **r})
            await ws.send_json({"type": "done", **outcome, "xp_week": activity.week_xp(db, user.id)})
    except WebSocketDisconnect:
        pass
    finally:
        db.close()
