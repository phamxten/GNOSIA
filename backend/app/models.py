"""Database models (SQLAlchemy 2.0).

Chapter content (scenes, exercises, quiz bank, exam, challenge) is stored as a
versioned JSON document: `Chapter.draft` is what the Builder edits, and each
publish snapshots it into `ChapterVersion`. Learners always read a published
version, and every Attempt records which version it was made against.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import JSON, Boolean, Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy import DateTime as _DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from .db import Base


def now() -> datetime:
    return datetime.now(timezone.utc)


class DateTime(TypeDecorator):
    """Timezone-aware UTC datetimes on every backend (SQLite drops tzinfo otherwise)."""
    impl = _DateTime
    cache_ok = True

    def __init__(self, timezone: bool = True):  # noqa: ARG002 - keeps the DateTime(timezone=True) call sites readable
        super().__init__()

    def process_bind_param(self, value, dialect):
        if value is not None:
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


# ---------------------------------------------------------------- people ---
class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))


class Klass(Base):
    """A school class (e.g. "XII RPL") with its mentor."""
    __tablename__ = "classes"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"))
    name: Mapped[str] = mapped_column(String(80))
    path_id: Mapped[int | None] = mapped_column(ForeignKey("paths.id"))
    mentor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", use_alter=True))
    started_on: Mapped[date | None] = mapped_column(Date)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(16), default="learner")  # learner | mentor | admin
    org_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id"))
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id"))
    avatar: Mapped[str] = mapped_column(String(4), default="")  # "", a2..a5 (colour class)
    title: Mapped[str] = mapped_column(String(120), default="")  # staff subtitle, e.g. "Kurikulum · SMK SIG"

    onboarded: Mapped[bool] = mapped_column(Boolean, default=False)
    goal: Mapped[str] = mapped_column(String(40), default="")
    daily_goal_min: Mapped[int] = mapped_column(Integer, default=20)
    assist_cap: Mapped[int] = mapped_column(Integer, default=6)  # mentor-set hint cap for Perkuat / Playground
    prefs: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)  # nosi, reminders, mentor_sees_wrong, language

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    klass: Mapped[Klass | None] = relationship(foreign_keys=[class_id])


# --------------------------------------------------------------- content ---
class Path(Base):
    __tablename__ = "paths"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")


class Chapter(Base):
    __tablename__ = "chapters"
    id: Mapped[int] = mapped_column(primary_key=True)
    path_id: Mapped[int] = mapped_column(ForeignKey("paths.id"))
    position: Mapped[int] = mapped_column(Integer)  # order on the map (1-based)
    number: Mapped[int] = mapped_column(Integer, default=0)  # "Bab N" (learning chapters only; 0 for project/final)
    kind: Mapped[str] = mapped_column(String(16), default="chapter")  # chapter | project | final
    slug: Mapped[str] = mapped_column(String(60))
    title: Mapped[str] = mapped_column(String(120))
    subtitle: Mapped[str] = mapped_column(String(160), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    icon: Mapped[str] = mapped_column(String(40), default="box")
    module_label: Mapped[str] = mapped_column(String(80), default="")
    map_x: Mapped[int] = mapped_column(Integer, default=50)  # % across the map canvas
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))

    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft | review | published
    version: Mapped[int] = mapped_column(Integer, default=0)  # latest published version (0 = never)
    draft: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    draft_saved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    __table_args__ = (UniqueConstraint("path_id", "slug"),)


class ChapterVersion(Base):
    __tablename__ = "chapter_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    chapter_id: Mapped[int] = mapped_column(ForeignKey("chapters.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    content: Mapped[dict[str, Any]] = mapped_column(JSON)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    published_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    __table_args__ = (UniqueConstraint("chapter_id", "version"),)


class Concept(Base):
    """A learnable idea. Positions (x, y) place it on the Progres constellation."""
    __tablename__ = "concepts"
    id: Mapped[int] = mapped_column(primary_key=True)
    path_id: Mapped[int] = mapped_column(ForeignKey("paths.id"))
    key: Mapped[str] = mapped_column(String(60))
    name: Mapped[str] = mapped_column(String(80))  # short label on the constellation, e.g. "salinan nilai"
    skill: Mapped[str] = mapped_column(String(120), default="")  # sentence on the chapter page, e.g. "Membuat variabel"
    chapter_id: Mapped[int | None] = mapped_column(ForeignKey("chapters.id"))
    x: Mapped[int] = mapped_column(Integer, default=0)
    y: Mapped[int] = mapped_column(Integer, default=0)
    requires: Mapped[list[str]] = mapped_column(JSON, default=list)  # prerequisite concept keys

    __table_args__ = (UniqueConstraint("path_id", "key"),)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    path_id: Mapped[int] = mapped_column(ForeignKey("paths.id"))
    slug: Mapped[str] = mapped_column(String(60), unique=True)
    title: Mapped[str] = mapped_column(String(120))
    number: Mapped[int] = mapped_column(Integer, default=1)
    unlock_after: Mapped[int] = mapped_column(Integer, default=2)  # "Bab N" that must be done first
    description: Mapped[str] = mapped_column(Text, default="")
    milestones: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)


# -------------------------------------------------------------- progress ---
class ChapterProgress(Base):
    __tablename__ = "chapter_progress"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    chapter_id: Mapped[int] = mapped_column(ForeignKey("chapters.id", ondelete="CASCADE"))
    version: Mapped[int] = mapped_column(Integer, default=1)  # content version this learner is on
    phases: Mapped[dict[str, Any]] = mapped_column(JSON)  # {pahami:{state,progress,score?}, ...}
    current: Mapped[str] = mapped_column(String(12), default="pahami")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    phase_since: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)  # when `current` started
    active_seconds: Mapped[int] = mapped_column(Integer, default=0)  # time spent in the player for this chapter

    __table_args__ = (UniqueConstraint("user_id", "chapter_id"),)


class PlayerState(Base):
    """Resumable player state per learner, chapter and phase (scene index, answers, hints...)."""
    __tablename__ = "player_states"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    chapter_id: Mapped[int] = mapped_column(ForeignKey("chapters.id", ondelete="CASCADE"))
    phase: Mapped[str] = mapped_column(String(16))  # pahami | perkuat | challenge
    data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    __table_args__ = (UniqueConstraint("user_id", "chapter_id", "phase"),)


class Attempt(Base):
    __tablename__ = "attempts"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    chapter_id: Mapped[int] = mapped_column(ForeignKey("chapters.id", ondelete="CASCADE"), index=True)
    phase: Mapped[str] = mapped_column(String(12))  # perkuat | kuis | ulangan | challenge
    item_id: Mapped[str] = mapped_column(String(40))
    attempt_no: Mapped[int] = mapped_column(Integer, default=1)
    correct: Mapped[bool] = mapped_column(Boolean)
    answer: Mapped[Any] = mapped_column(JSON, nullable=True)
    hint_level: Mapped[int] = mapped_column(Integer, default=0)
    ms: Mapped[int] = mapped_column(Integer, default=0)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class HintOpen(Base):
    __tablename__ = "hint_opens"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    chapter_id: Mapped[int] = mapped_column(ForeignKey("chapters.id", ondelete="CASCADE"))
    item_id: Mapped[str] = mapped_column(String(40))
    level: Mapped[int] = mapped_column(Integer)
    ms_since_shown: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ConceptMastery(Base):
    __tablename__ = "concept_mastery"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id", ondelete="CASCADE"))
    tier: Mapped[int] = mapped_column(Integer, default=0)  # 0..5
    weak: Mapped[bool] = mapped_column(Boolean, default=False)
    weak_phase: Mapped[str] = mapped_column(String(12), default="")  # where it went wrong
    weak_note: Mapped[str] = mapped_column(Text, default="")  # "Kamu menjawab 5, seharusnya 2."
    last_evidence: Mapped[str] = mapped_column(String(200), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    __table_args__ = (UniqueConstraint("user_id", "concept_id"),)


class MasterySnapshot(Base):
    """Average mastery (%) per learner per week, for the Progres trend chart."""
    __tablename__ = "mastery_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    week_start: Mapped[date] = mapped_column(Date)
    pct: Mapped[int] = mapped_column(Integer)

    __table_args__ = (UniqueConstraint("user_id", "week_start"),)


class XpEvent(Base):
    __tablename__ = "xp_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class DailyActivity(Base):
    __tablename__ = "daily_activity"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date)
    seconds: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (UniqueConstraint("user_id", "day"),)


class QuizRound(Base):
    __tablename__ = "quiz_rounds"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    chapter_id: Mapped[int | None] = mapped_column(ForeignKey("chapters.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(12), default="gate")  # gate | daily | review
    version: Mapped[int] = mapped_column(Integer, default=1)
    question_refs: Mapped[list[Any]] = mapped_column(JSON)  # [[chapter_id, question_id], ...]
    answers: Mapped[list[Any]] = mapped_column(JSON, default=list)  # [{choice, correct, left, points}]
    per_question_sec: Mapped[int] = mapped_column(Integer, default=20)
    score: Mapped[int] = mapped_column(Integer, default=0)
    combo: Mapped[int] = mapped_column(Integer, default=1)
    best_combo: Mapped[int] = mapped_column(Integer, default=1)
    finished: Mapped[bool] = mapped_column(Boolean, default=False)
    pct: Mapped[int | None] = mapped_column(Integer)
    passed: Mapped[bool | None] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ExamSession(Base):
    __tablename__ = "exam_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    chapter_id: Mapped[int] = mapped_column(ForeignKey("chapters.id", ondelete="CASCADE"))
    version: Mapped[int] = mapped_column(Integer, default=1)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    answers: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)  # {question_id: answer}
    flags: Mapped[list[str]] = mapped_column(JSON, default=list)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    score: Mapped[int | None] = mapped_column(Integer)
    passed: Mapped[bool | None] = mapped_column(Boolean)
    results: Mapped[list[Any] | None] = mapped_column(JSON)


class Submission(Base):
    """Code sent for mentor review: a passed Challenge or a project milestone."""
    __tablename__ = "submissions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(12))  # challenge | milestone
    chapter_id: Mapped[int | None] = mapped_column(ForeignKey("chapters.id", ondelete="CASCADE"))
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    milestone: Mapped[int | None] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(160), default="")
    filename: Mapped[str] = mapped_column(String(80), default="main.js")
    code: Mapped[str] = mapped_column(Text)
    attempt_no: Mapped[int] = mapped_column(Integer, default=1)
    tests_passed: Mapped[int] = mapped_column(Integer, default=0)
    tests_total: Mapped[int] = mapped_column(Integer, default=0)
    error_line: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(12), default="pending")  # pending | changes | approved
    summary: Mapped[str] = mapped_column(Text, default="")
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    seen_by_learner: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ReviewComment(Base):
    __tablename__ = "review_comments"
    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    line: Mapped[int] = mapped_column(Integer)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ProjectProgress(Base):
    __tablename__ = "project_progress"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    milestone: Mapped[int] = mapped_column(Integer, default=0)  # index of the current milestone
    code: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(12), default="work")  # work | waiting | feedback | portfolio
    last_run: Mapped[dict[str, Any] | None] = mapped_column(JSON)  # {results: [...], logs, error} of the latest run
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    __table_args__ = (UniqueConstraint("user_id", "project_id"),)


class Message(Base):
    """Learner ↔ mentor thread (per learner; optionally tied to a project)."""
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    learner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))
    context: Mapped[str] = mapped_column(String(160), default="")  # "Challenge Papan Skor"
    body: Mapped[str] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Notebook(Base):
    __tablename__ = "notebooks"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(160), default="Notebook tanpa judul")
    attached_chapter_id: Mapped[int | None] = mapped_column(ForeignKey("chapters.id", ondelete="SET NULL"))
    cells: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)  # [{id, type: code|note, src}]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Assignment(Base):
    """Mentor-assigned work: a Pahami scene and/or a few Perkuat items."""
    __tablename__ = "assignments"
    id: Mapped[int] = mapped_column(primary_key=True)
    mentor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    learner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    chapter_id: Mapped[int | None] = mapped_column(ForeignKey("chapters.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    link: Mapped[str] = mapped_column(String(200), default="")
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(24))
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    link: Mapped[str] = mapped_column(String(200), default="")
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ContentReport(Base):
    """A learner report such as "output benar tapi gagal" on a challenge test."""
    __tablename__ = "content_reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    chapter_id: Mapped[int] = mapped_column(ForeignKey("chapters.id", ondelete="CASCADE"))
    item_id: Mapped[str] = mapped_column(String(40))
    body: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
