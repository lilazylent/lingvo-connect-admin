import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.models import AuthStage, Role, User, UserSession
from app.security import token_hash


@dataclass
class SessionContext:
    session: UserSession
    user: User


def as_utc(value: datetime) -> datetime:
    """SQLite tests return naive values; PostgreSQL returns timezone-aware values."""
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def get_session_context(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    lc_session: Annotated[str | None, Cookie()] = None,
) -> SessionContext:
    error = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сессия недействительна")
    if not lc_session:
        raise error
    session = db.scalar(
        select(UserSession).where(
            UserSession.token_hash == token_hash(lc_session, settings.session_secret)
        )
    )
    now = datetime.now(UTC)
    if (
        not session
        or session.revoked_at is not None
        or as_utc(session.expires_at) < now
        or as_utc(session.idle_expires_at) < now
    ):
        raise error
    user = db.get(User, session.user_id)
    if not user or not user.is_active:
        raise error
    session.last_seen_at = now
    session.idle_expires_at = now + timedelta(minutes=settings.session_idle_minutes)
    db.commit()
    request.state.auth = SessionContext(session=session, user=user)
    return request.state.auth


def require_csrf(
    context: Annotated[SessionContext, Depends(get_session_context)],
    settings: Annotated[Settings, Depends(get_settings)],
    lc_csrf: Annotated[str | None, Cookie()] = None,
    x_csrf_token: Annotated[str | None, Header()] = None,
) -> SessionContext:
    if not lc_csrf or not x_csrf_token or not secrets.compare_digest(lc_csrf, x_csrf_token):
        raise HTTPException(status_code=403, detail="CSRF-проверка не пройдена")
    expected = token_hash(x_csrf_token, settings.session_secret)
    if not secrets.compare_digest(context.session.csrf_hash, expected):
        raise HTTPException(status_code=403, detail="CSRF-проверка не пройдена")
    return context


def require_authenticated(
    context: Annotated[SessionContext, Depends(get_session_context)],
) -> SessionContext:
    if context.session.auth_stage != AuthStage.AUTHENTICATED.value:
        raise HTTPException(status_code=403, detail="Завершите обязательные этапы входа")
    return context


def require_authenticated_write(
    context: Annotated[SessionContext, Depends(require_csrf)],
) -> SessionContext:
    if context.session.auth_stage != AuthStage.AUTHENTICATED.value:
        raise HTTPException(status_code=403, detail="Завершите обязательные этапы входа")
    return context


def require_admin(
    context: Annotated[SessionContext, Depends(require_authenticated)],
) -> SessionContext:
    if context.user.role != Role.ADMIN.value:
        raise HTTPException(status_code=403, detail="Требуются права администратора")
    return context


def require_admin_write(
    context: Annotated[SessionContext, Depends(require_authenticated_write)],
) -> SessionContext:
    if context.user.role != Role.ADMIN.value:
        raise HTTPException(status_code=403, detail="Требуются права администратора")
    return context
