from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.audit import record_event
from app.db import get_db
from app.dependencies import SessionContext, require_admin, require_admin_write
from app.dependencies import require_authenticated, require_authenticated_write
from app.models import RecoveryCode, Role, User, UserSession
from app.schemas import (
    MessageView,
    TemporaryPasswordView,
    UserCreateRequest,
    UserCreateView,
    UserUpdateRequest,
    UserPreferencesUpdate,
    UserPreferencesView,
    UserView,
)
from app.security import generate_temporary_password, hash_password

router = APIRouter(prefix="/api/admin/users", tags=["users"])


@router.get("/me/preferences", response_model=UserPreferencesView)
def get_preferences(
    context: Annotated[SessionContext, Depends(require_authenticated)],
) -> UserPreferencesView:
    return UserPreferencesView(interface_theme=context.user.interface_theme)


@router.patch("/me/preferences", response_model=UserPreferencesView)
def update_preferences(
    payload: UserPreferencesUpdate,
    request: Request,
    context: Annotated[SessionContext, Depends(require_authenticated_write)],
    db: Annotated[Session, Depends(get_db)],
) -> UserPreferencesView:
    context.user.interface_theme = payload.interface_theme
    record_event(
        db,
        request,
        "user_preferences_updated",
        actor_user_id=context.user.id,
        target_user_id=context.user.id,
        details={"interface_theme": payload.interface_theme},
    )
    db.commit()
    return UserPreferencesView(interface_theme=context.user.interface_theme)


@router.get("", response_model=list[UserView])
def list_users(
    _: Annotated[SessionContext, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at.desc())).all())


@router.post("", response_model=UserCreateView, status_code=201)
def create_user(
    payload: UserCreateRequest,
    request: Request,
    context: Annotated[SessionContext, Depends(require_admin_write)],
    db: Annotated[Session, Depends(get_db)],
) -> UserCreateView:
    email = payload.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Пользователь с таким email уже существует")
    password = generate_temporary_password()
    user = User(
        email=email,
        display_name=payload.display_name or email.split("@", 1)[0],
        role=payload.role.value,
        password_hash=hash_password(password),
        must_change_password=True,
    )
    db.add(user)
    db.flush()
    record_event(
        db,
        request,
        "user_created",
        actor_user_id=context.user.id,
        target_user_id=user.id,
        details={"role": user.role},
    )
    db.commit()
    db.refresh(user)
    return UserCreateView(
        user=user,
        temporary_password=password,
        warning="Временный пароль показывается один раз.",
    )


@router.patch("/{user_id}", response_model=UserView)
def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    request: Request,
    context: Annotated[SessionContext, Depends(require_admin_write)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.id == context.user.id and payload.is_active is False:
        raise HTTPException(status_code=400, detail="Нельзя деактивировать текущую учетную запись")
    changes: dict[str, object] = {}
    if payload.display_name is not None:
        changes["display_name"] = payload.display_name or user.email.split("@", 1)[0]
    if payload.role is not None:
        if user.id == context.user.id and payload.role != Role.ADMIN:
            raise HTTPException(
                status_code=400, detail="Нельзя снять собственные права администратора"
            )
        changes["role"] = payload.role.value
    if payload.is_active is not None:
        changes["is_active"] = payload.is_active
    if payload.must_change_password is not None:
        changes["must_change_password"] = payload.must_change_password
    for field, value in changes.items():
        setattr(user, field, value)
    if payload.is_active is False:
        db.execute(
            update(UserSession)
            .where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None))
            .values(revoked_at=datetime.now(UTC))
        )
    if "role" in changes:
        record_event(
            db,
            request,
            "role_changed",
            actor_user_id=context.user.id,
            target_user_id=user.id,
            details={"role": changes["role"]},
        )
    if "is_active" in changes:
        action = "user_activated" if changes["is_active"] else "user_deactivated"
        record_event(db, request, action, actor_user_id=context.user.id, target_user_id=user.id)
    if set(changes) - {"role", "is_active"}:
        record_event(
            db,
            request,
            "user_updated",
            actor_user_id=context.user.id,
            target_user_id=user.id,
            details={"fields": sorted(set(changes) - {"role", "is_active"})},
        )
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/reset-password", response_model=TemporaryPasswordView)
def reset_password(
    user_id: str,
    request: Request,
    context: Annotated[SessionContext, Depends(require_admin_write)],
    db: Annotated[Session, Depends(get_db)],
) -> TemporaryPasswordView:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    password = generate_temporary_password()
    user.password_hash = hash_password(password)
    user.must_change_password = True
    db.execute(
        update(UserSession)
        .where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    record_event(
        db,
        request,
        "password_reset",
        actor_user_id=context.user.id,
        target_user_id=user.id,
    )
    db.commit()
    return TemporaryPasswordView(
        temporary_password=password,
        warning="Временный пароль показывается один раз.",
    )


@router.post("/{user_id}/reset-2fa", response_model=MessageView)
def reset_two_factor(
    user_id: str,
    request: Request,
    context: Annotated[SessionContext, Depends(require_admin_write)],
    db: Annotated[Session, Depends(get_db)],
) -> MessageView:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.two_factor_enabled = False
    user.two_factor_secret_encrypted = None
    db.execute(delete(RecoveryCode).where(RecoveryCode.user_id == user.id))
    db.execute(
        update(UserSession)
        .where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    record_event(
        db,
        request,
        "2fa_reset",
        actor_user_id=context.user.id,
        target_user_id=user.id,
    )
    db.commit()
    return MessageView(message="2FA сброшена. При следующем входе потребуется новая настройка.")
