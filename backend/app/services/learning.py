"""Learner progress across chapters: unlocking, phase completion, XP and mastery."""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Chapter, ChapterProgress, Concept, ConceptMastery, Notification, PlayerState, Project, User, now
from . import activity, content as content_svc, scoring, unlock

TIER_NAMES = ["Belum", "Dilihat", "Dilatih", "Diterapkan", "Mahir", "Dikuasai"]


# ------------------------------------------------------------- chapters
def path_chapters(db: Session, path_id: int) -> list[Chapter]:
    return list(db.scalars(select(Chapter).where(Chapter.path_id == path_id).order_by(Chapter.position)))


def progress_map(db: Session, user_id: int) -> dict[int, ChapterProgress]:
    rows = db.scalars(select(ChapterProgress).where(ChapterProgress.user_id == user_id))
    return {r.chapter_id: r for r in rows}


def get_progress(db: Session, user: User, chapter: Chapter) -> ChapterProgress | None:
    return db.scalar(select(ChapterProgress).where(ChapterProgress.user_id == user.id, ChapterProgress.chapter_id == chapter.id))


def _is_done(pm: dict[int, ChapterProgress], chapter_id: int) -> bool:
    p = pm.get(chapter_id)
    return bool(p and p.completed_at)


def is_unlocked(db: Session, user: User, chapter: Chapter, chapters: list[Chapter] | None = None,
                pm: dict[int, ChapterProgress] | None = None) -> bool:
    chapters = chapters or path_chapters(db, chapter.path_id)
    pm = pm if pm is not None else progress_map(db, user.id)
    if chapter.id in pm:
        return True
    learn = [c for c in chapters if c.kind == "chapter"]
    if chapter.kind == "chapter":
        idx = learn.index(chapter)
        return idx == 0 or _is_done(pm, learn[idx - 1].id)
    if chapter.kind == "project" and chapter.project_id:
        proj = db.get(Project, chapter.project_id)
        need = next((c for c in learn if c.number == proj.unlock_after), None) if proj else None
        return bool(need and _is_done(pm, need.id))
    if chapter.kind == "final":
        return all(_is_done(pm, c.id) for c in learn)
    return False


def node_state(db: Session, user: User, chapter: Chapter, chapters: list[Chapter], pm: dict[int, ChapterProgress],
               current_id: int | None) -> str:
    """done | now | open | soon | locked (for the map and chapter lists)."""
    if chapter.kind == "project" and chapter.project_id:
        from ..models import ProjectProgress
        pp = db.scalar(select(ProjectProgress).where(ProjectProgress.user_id == user.id, ProjectProgress.project_id == chapter.project_id))
        if pp and pp.status == "portfolio":
            return "done"
        return "open" if is_unlocked(db, user, chapter, chapters, pm) else "locked"
    if _is_done(pm, chapter.id):
        return "done"
    if chapter.id == current_id:
        return "now"
    if is_unlocked(db, user, chapter, chapters, pm):
        return "open" if chapter.version else "soon"
    return "locked"


def current_chapter(db: Session, user: User, chapters: list[Chapter], pm: dict[int, ChapterProgress]) -> Chapter | None:
    """The chapter "Lanjutkan" points to: the earliest started-but-unfinished one, else the next unlocked one."""
    learn = [c for c in chapters if c.kind == "chapter"]
    for c in learn:
        p = pm.get(c.id)
        if p and not p.completed_at:
            return c
    for c in learn:
        if not _is_done(pm, c.id) and c.version and is_unlocked(db, user, c, chapters, pm):
            return c
    return None


def ensure_progress(db: Session, user: User, chapter: Chapter) -> ChapterProgress:
    p = get_progress(db, user, chapter)
    if p is None:
        p = ChapterProgress(user_id=user.id, chapter_id=chapter.id, version=chapter.version or 1,
                            phases=unlock.initial_phases(), current="pahami")
        db.add(p)
        db.flush()
    return p


def mark_chapter_skipped(db: Session, user: User, chapter: Chapter) -> None:
    """Placement: mark a chapter done without XP (the learner already knows it)."""
    p = get_progress(db, user, chapter)
    if p is None:
        p = ChapterProgress(user_id=user.id, chapter_id=chapter.id, version=chapter.version or 1,
                            phases=unlock.all_done_phases(), current="uji", completed_at=now())
        db.add(p)
    content = content_svc.published(db, chapter) or {}
    touch_mastery(db, user, chapter.path_id, content.get("concepts", []), 1, "penempatan awal")


# ------------------------------------------------------------- phases
def set_phase_progress(db: Session, p: ChapterProgress, phase: str, value: float) -> None:
    p.phases = unlock.set_progress(p.phases, phase, value)
    p.updated_at = now()


def complete_phase(db: Session, user: User, chapter: Chapter, phase: str, score: float | None = None) -> dict[str, Any]:
    """Marks a phase done, awards XP, updates mastery and unlocks what comes next.
    Idempotent: completing an already-done phase awards nothing."""
    p = ensure_progress(db, user, chapter)
    already = p.phases[phase]["state"] == "done"
    if phase == "kuis":
        p.phases, _ = unlock.record_kuis(p.phases, int(score or 0))
    else:
        p.phases = unlock.complete(p.phases, phase, score)
    xp = 0
    content = content_svc.published(db, chapter, p.version) or {}
    if not already:
        xp += activity.add_xp(db, user, scoring.XP_PHASE_DONE.get(phase, 0), f"{phase} selesai · {chapter.title}")
        if phase == "pahami":
            touch_mastery(db, user, chapter.path_id, content.get("concepts", []), 1, "Pahami selesai")
    p.current = unlock.current_phase(p.phases)
    p.phase_since = now()
    p.updated_at = now()
    # Content published mid-phase reaches the learner once the phase ends.
    if chapter.version and p.version != chapter.version:
        p.version = chapter.version
    chapter_done = False
    next_chapter = None
    if unlock.is_chapter_done(p.phases) and not p.completed_at:
        p.completed_at = now()
        chapter_done = True
        xp += activity.add_xp(db, user, scoring.XP_CHAPTER_DONE, f"Bab selesai · {chapter.title}")
        next_chapter = _next_learning_chapter(db, chapter)
        if next_chapter and next_chapter.version:
            ensure_progress(db, user, next_chapter)
    db.flush()
    return {"phases": p.phases, "current": p.current, "xp": xp, "chapter_done": chapter_done,
            "next_chapter": chapter_ref(next_chapter) if next_chapter else None}


def _next_learning_chapter(db: Session, chapter: Chapter) -> Chapter | None:
    return db.scalar(
        select(Chapter).where(Chapter.path_id == chapter.path_id, Chapter.kind == "chapter", Chapter.position > chapter.position)
        .order_by(Chapter.position)
    )


def chapter_ref(c: Chapter) -> dict[str, Any]:
    return {"id": c.id, "slug": c.slug, "title": c.title, "number": chapter_number(c), "published": bool(c.version)}


def chapter_number(c: Chapter) -> int:
    return c.number


# ------------------------------------------------------------- player state
def player_state(db: Session, user: User, chapter: Chapter, phase: str) -> PlayerState:
    st = db.scalar(select(PlayerState).where(PlayerState.user_id == user.id, PlayerState.chapter_id == chapter.id, PlayerState.phase == phase))
    if st is None:
        st = PlayerState(user_id=user.id, chapter_id=chapter.id, phase=phase, data={})
        db.add(st)
        db.flush()
    return st


def save_state(st: PlayerState, data: dict[str, Any]) -> None:
    st.data = dict(data)  # new object so SQLAlchemy sees the JSON change
    st.updated_at = now()


# ------------------------------------------------------------- mastery
def concepts_by_key(db: Session, path_id: int, keys: list[str]) -> list[Concept]:
    if not keys:
        return []
    return list(db.scalars(select(Concept).where(Concept.path_id == path_id, Concept.key.in_(keys))))


def mastery_row(db: Session, user: User, concept: Concept) -> ConceptMastery:
    row = db.scalar(select(ConceptMastery).where(ConceptMastery.user_id == user.id, ConceptMastery.concept_id == concept.id))
    if row is None:
        row = ConceptMastery(user_id=user.id, concept_id=concept.id, tier=0)
        db.add(row)
        db.flush()
    return row


def touch_mastery(db: Session, user: User, path_id: int, keys: list[str], min_tier: int, evidence: str,
                  clear_weak: bool = False) -> None:
    for c in concepts_by_key(db, path_id, keys):
        row = mastery_row(db, user, c)
        if row.tier < min_tier:
            row.tier = min_tier
        if clear_weak and row.weak:
            row.weak = False
        row.last_evidence = evidence
        row.updated_at = now()
    snapshot_mastery(db, user, path_id)


def mark_weak(db: Session, user: User, path_id: int, keys: list[str], phase: str, note: str) -> None:
    for c in concepts_by_key(db, path_id, keys):
        row = mastery_row(db, user, c)
        row.weak = True
        row.weak_phase = phase
        row.weak_note = note
        row.tier = max(row.tier, 1)
        row.updated_at = now()
    snapshot_mastery(db, user, path_id)


def chapter_mastery_pct(db: Session, user: User, chapter: Chapter, keys: list[str]) -> int:
    cs = concepts_by_key(db, chapter.path_id, keys)
    if not cs:
        return 0
    rows = {r.concept_id: r for r in db.scalars(select(ConceptMastery).where(ConceptMastery.user_id == user.id,
                                                                               ConceptMastery.concept_id.in_([c.id for c in cs])))}
    return round(100 * sum((rows[c.id].tier if c.id in rows else 0) for c in cs) / (5 * len(cs)))


def overall_mastery_pct(db: Session, user: User, path_id: int) -> int:
    """Average mastery over the concepts of every chapter the learner has started."""
    started = [p.chapter_id for p in progress_map(db, user.id).values()]
    if not started:
        return 0
    cs = list(db.scalars(select(Concept).where(Concept.path_id == path_id, Concept.chapter_id.in_(started))))
    if not cs:
        return 0
    rows = {r.concept_id: r.tier for r in db.scalars(select(ConceptMastery).where(ConceptMastery.user_id == user.id))}
    return round(100 * sum(rows.get(c.id, 0) for c in cs) / (5 * len(cs)))


def snapshot_mastery(db: Session, user: User, path_id: int) -> None:
    from datetime import timedelta
    from ..models import MasterySnapshot
    db.flush()
    today = activity.local_today()
    week = today - timedelta(days=today.weekday())
    pct = overall_mastery_pct(db, user, path_id)
    row = db.scalar(select(MasterySnapshot).where(MasterySnapshot.user_id == user.id, MasterySnapshot.week_start == week))
    if row is None:
        db.add(MasterySnapshot(user_id=user.id, week_start=week, pct=pct))
    else:
        row.pct = pct


def notify(db: Session, user_id: int, kind: str, title: str, body: str = "", link: str = "") -> None:
    db.add(Notification(user_id=user_id, kind=kind, title=title, body=body, link=link))
