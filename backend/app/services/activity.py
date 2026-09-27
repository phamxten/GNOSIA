"""XP, daily activity minutes and streaks (CONCEPT §5)."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import DailyActivity, User, XpEvent, now

LOCAL_TZ = timezone(timedelta(hours=settings.utc_offset_hours))
HEARTBEAT_MAX_SECONDS = 60


def local_today() -> date:
    return datetime.now(LOCAL_TZ).date()


def local_day(dt: datetime) -> date:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(LOCAL_TZ).date()


def add_xp(db: Session, user: User, amount: int, reason: str) -> int:
    if amount > 0:
        db.add(XpEvent(user_id=user.id, amount=amount, reason=reason))
    return amount


def total_xp(db: Session, user_id: int) -> int:
    return db.scalar(select(func.coalesce(func.sum(XpEvent.amount), 0)).where(XpEvent.user_id == user_id)) or 0


def week_xp(db: Session, user_id: int) -> int:
    today = local_today()
    start = datetime.combine(today - timedelta(days=today.weekday()), datetime.min.time(), LOCAL_TZ)
    return db.scalar(
        select(func.coalesce(func.sum(XpEvent.amount), 0)).where(XpEvent.user_id == user_id, XpEvent.created_at >= start)
    ) or 0


def record_activity(db: Session, user: User, seconds: int) -> None:
    seconds = max(0, min(HEARTBEAT_MAX_SECONDS, int(seconds)))
    user.last_active_at = now()
    if not seconds:
        return
    day = local_today()
    row = db.scalar(select(DailyActivity).where(DailyActivity.user_id == user.id, DailyActivity.day == day))
    if row is None:
        db.add(DailyActivity(user_id=user.id, day=day, seconds=seconds))
    else:
        row.seconds += seconds


def minutes_on(db: Session, user_id: int, day: date) -> int:
    secs = db.scalar(select(DailyActivity.seconds).where(DailyActivity.user_id == user_id, DailyActivity.day == day))
    return (secs or 0) // 60


def goal_days(db: Session, user: User, since: date) -> set[date]:
    """Days on which the learner reached their daily goal."""
    need = max(1, user.daily_goal_min) * 60
    rows = db.scalars(
        select(DailyActivity.day).where(
            DailyActivity.user_id == user.id, DailyActivity.day >= since, DailyActivity.seconds >= need
        )
    )
    return set(rows)


def streak(db: Session, user: User) -> int:
    """Consecutive goal days ending today (or yesterday, if today is not reached yet)."""
    today = local_today()
    days = goal_days(db, user, today - timedelta(days=400))
    d = today if today in days else today - timedelta(days=1)
    n = 0
    while d in days:
        n += 1
        d -= timedelta(days=1)
    return n


def week_dots(db: Session, user: User) -> list[dict]:
    """Mon..Sun of the current week: {label, on, today}."""
    today = local_today()
    monday = today - timedelta(days=today.weekday())
    days = goal_days(db, user, monday)
    labels = ["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"]
    return [
        {"label": labels[i], "on": (monday + timedelta(days=i)) in days, "today": monday + timedelta(days=i) == today}
        for i in range(7)
    ]
