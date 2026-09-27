from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import User

ALGO = "HS256"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8")[:72], bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8")[:72], hashed.encode())
    except ValueError:
        return False


def issue_session(response: Response, user: User) -> None:
    exp = datetime.now(timezone.utc) + timedelta(days=settings.session_days)
    token = jwt.encode({"sub": str(user.id), "role": user.role, "exp": exp}, settings.secret_key, algorithm=ALGO)
    response.set_cookie(
        settings.session_cookie, token, max_age=settings.session_days * 86400,
        httponly=True, samesite="lax", secure=settings.cookie_secure, path="/",
    )


def clear_session(response: Response) -> None:
    response.delete_cookie(settings.session_cookie, path="/")


def user_from_token(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    try:
        data = jwt.decode(token, settings.secret_key, algorithms=[ALGO])
    except jwt.PyJWTError:
        return None
    return db.get(User, int(data["sub"]))


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user = user_from_token(db, request.cookies.get(settings.session_cookie))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Silakan masuk dulu.")
    return user


def require_role(*roles: str):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Kamu tidak punya akses ke halaman ini.")
        return user
    return dep
