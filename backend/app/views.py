"""Small serializers shared by several routers."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Klass, Notification, Organization, User
from .services import activity


def initials(name: str) -> str:
    parts = [p for p in name.split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[1][0]).upper()


def person(u: User | None) -> dict[str, Any] | None:
    if u is None:
        return None
    return {"id": u.id, "name": u.name, "initials": initials(u.name), "avatar": u.avatar, "role": u.role}


def me_view(db: Session, user: User) -> dict[str, Any]:
    klass = db.get(Klass, user.class_id) if user.class_id else None
    org = db.get(Organization, user.org_id) if user.org_id else None
    unread = db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.read.is_(False))) or 0
    return {
        **person(user),
        "email": user.email,
        "title": user.title,
        "onboarded": user.onboarded or user.role != "learner",
        "goal": user.goal,
        "daily_goal_min": user.daily_goal_min,
        "assist_cap": user.assist_cap,
        "prefs": user.prefs or {},
        "class": {"id": klass.id, "name": klass.name} if klass else None,
        "org": org.name if org else None,
        "streak": activity.streak(db, user),
        "xp_week": activity.week_xp(db, user.id),
        "xp_total": activity.total_xp(db, user.id),
        "today_minutes": activity.minutes_on(db, user.id, activity.local_today()),
        "unread": unread,
        "joined": user.created_at.isoformat() if user.created_at else None,
    }


def ago(dt: datetime | None) -> str:
    """Indonesian relative time: "12 menit lalu", "kemarin", "5 hari lalu"."""
    if dt is None:
        return "belum pernah"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    secs = (datetime.now(timezone.utc) - dt).total_seconds()
    if secs < 60:
        return "baru saja"
    if secs < 3600:
        return f"{int(secs // 60)} menit lalu"
    days = (activity.local_today() - activity.local_day(dt)).days
    if days == 0:
        return f"{int(secs // 3600)} jam lalu"
    if days == 1:
        return "kemarin"
    return f"{days} hari lalu"


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None
