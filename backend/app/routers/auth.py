from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Chapter, Klass, Path, User
from ..security import clear_session, current_user, hash_password, issue_session, verify_password
from ..services import activity, learning
from ..views import me_view

router = APIRouter(prefix="/api", tags=["auth"])

DEFAULT_PREFS = {"nosi": True, "reminders": True, "mentor_sees_wrong": True, "language": "id"}


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=200)
    password: str = ""


class LoginIn(BaseModel):
    email: str
    password: str = ""


@router.post("/auth/register")
def register(body: RegisterIn, response: Response, db: Session = Depends(get_db)) -> dict[str, Any]:
    email = body.email.strip().lower()
    errors: dict[str, str] = {}
    if "@" not in email:
        errors["email"] = "Email belum valid."
    if not body.password:
        errors["password"] = "Kata sandi tidak boleh kosong."
    if not body.name.strip():
        errors["name"] = "Nama panggilan tidak boleh kosong."
    if not errors and db.scalar(select(User).where(func.lower(User.email) == email)):
        errors["email"] = "Email ini sudah terdaftar. Coba masuk."
    if errors:
        raise HTTPException(422, {"fields": errors})
    klass = db.scalar(select(Klass).order_by(Klass.id))  # demo: new learners join the first class
    user = User(email=email, name=body.name.strip(), password_hash=hash_password(body.password), role="learner",
                org_id=klass.org_id if klass else None, class_id=klass.id if klass else None, prefs=dict(DEFAULT_PREFS))
    db.add(user)
    db.commit()
    issue_session(response, user)
    return me_view(db, user)


@router.post("/auth/login")
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)) -> dict[str, Any]:
    if not body.password:
        raise HTTPException(422, {"fields": {"password": "Kata sandi tidak boleh kosong."}})
    user = db.scalar(select(User).where(func.lower(User.email) == body.email.strip().lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, {"fields": {"password": "Email atau kata sandi belum cocok."}})
    issue_session(response, user)
    return me_view(db, user)


@router.post("/auth/logout")
def logout(response: Response) -> dict[str, bool]:
    clear_session(response)
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    return me_view(db, user)


class MeUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    daily_goal_min: Literal[5, 10, 20, 30] | None = None
    prefs: dict[str, Any] | None = None


@router.patch("/me")
def update_me(body: MeUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    if body.name is not None and body.name.strip():
        user.name = body.name.strip()
    if body.daily_goal_min is not None:
        user.daily_goal_min = body.daily_goal_min
    if body.prefs is not None:
        allowed = {k: v for k, v in body.prefs.items() if k in DEFAULT_PREFS}
        user.prefs = {**DEFAULT_PREFS, **(user.prefs or {}), **allowed}
    db.commit()
    return me_view(db, user)


class DeleteIn(BaseModel):
    confirm: str


@router.delete("/me")
def delete_me(body: DeleteIn, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, bool]:
    if body.confirm.strip().lower() != user.email.lower():
        raise HTTPException(422, {"fields": {"confirm": "Ketik email akunmu untuk konfirmasi."}})
    if user.role != "learner":
        raise HTTPException(403, "Akun staf dihapus lewat admin.")
    db.delete(user)
    db.commit()
    clear_session(response)
    return {"ok": True}


class OnboardingIn(BaseModel):
    goal: Literal["sekolah", "karier", "bikin", "penasaran"]
    placement: Literal["a", "b", "c"]  # a = "x bernilai 8" (knows basics) · b = wrong · c = never seen code
    daily_goal_min: Literal[5, 10, 20, 30]


@router.post("/onboarding")
def onboarding(body: OnboardingIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    path = db.scalar(select(Path).order_by(Path.id))
    chapters = [c for c in learning.path_chapters(db, path.id) if c.kind == "chapter"] if path else []
    user.goal = body.goal
    user.daily_goal_min = body.daily_goal_min
    start = chapters[0] if chapters else None
    skipped = None
    if body.placement == "a" and len(chapters) > 1 and chapters[1].version:
        skipped = chapters[0]
        learning.mark_chapter_skipped(db, user, skipped)
        start = chapters[1]
    if start and start.version:
        learning.ensure_progress(db, user, start)
    user.onboarded = True
    activity.record_activity(db, user, 0)
    db.commit()
    return {
        "start": learning.chapter_ref(start) if start else None,
        "skipped": learning.chapter_ref(skipped) if skipped else None,
        "me": me_view(db, user),
    }


@router.get("/onboarding/preview")
def onboarding_preview(placement: Literal["a", "b", "c"], db: Session = Depends(get_db),
                       user: User = Depends(current_user)) -> dict[str, Any]:
    """Tells the last onboarding step where the learner will start."""
    path = db.scalar(select(Path).order_by(Path.id))
    chapters = [c for c in learning.path_chapters(db, path.id) if c.kind == "chapter"] if path else []
    if placement == "a" and len(chapters) > 1 and chapters[1].version:
        return {"start": learning.chapter_ref(chapters[1]), "skipped": learning.chapter_ref(chapters[0])}
    return {"start": learning.chapter_ref(chapters[0]) if chapters else None, "skipped": None}


def first_chapter(db: Session) -> Chapter | None:
    return db.scalar(select(Chapter).where(Chapter.kind == "chapter").order_by(Chapter.position))
