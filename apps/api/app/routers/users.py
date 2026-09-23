import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.audit import record_event
from app.config import Settings, get_settings
from app.db import Base, get_db
from app.dependencies import SessionContext, require_admin, require_admin_write
from app.dependencies import require_authenticated, require_authenticated_write
from app.models import RecoveryCode, Role, RoleDefinition, User, UserInvitation, UserSession
from app.schemas import (
    MessageView,
    TemporaryPasswordView,
    UserCreateRequest,
    UserCreateView,
    UserInvitationCreateRequest,
    UserInvitationCreateView,
    UserInvitationView,
    UserUpdateRequest,
    UserPreferencesUpdate,
    UserPreferencesView,
    UserView,
    RoleDefinitionCreate,
    RoleDefinitionUpdate,
    RoleDefinitionView,
    PermissionCatalogItem,
)
from app.rbac import PERMISSION_LABELS, PERMISSIONS, normalize_permissions, permissions_for_user, role_name_for_user
from app.security import generate_temporary_password, hash_password, token_hash

router = APIRouter(prefix="/api/admin/users", tags=["users"])


def _active_admin_count(db: Session, *, exclude_user_id: str | None = None) -> int:
    statement = select(func.count()).select_from(User).where(
        User.role == Role.ADMIN.value,
        User.is_active.is_(True),
    )
    if exclude_user_id is not None:
        statement = statement.where(User.id != exclude_user_id)
    return int(db.scalar(statement) or 0)


def _would_remove_last_active_admin(
    db: Session,
    user: User,
    *,
    next_role: str | None = None,
    next_is_active: bool | None = None,
) -> bool:
    if user.role != Role.ADMIN.value or not user.is_active:
        return False
    resulting_role = next_role if next_role is not None else user.role
    resulting_active = next_is_active if next_is_active is not None else user.is_active
    if resulting_role == Role.ADMIN.value and resulting_active:
        return False
    return _active_admin_count(db, exclude_user_id=user.id) == 0


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _invitation_view(db: Session, invitation: UserInvitation) -> UserInvitationView:
    status = "EXPIRED" if _as_utc(invitation.expires_at) <= datetime.now(UTC) else "PENDING"
    role = db.get(RoleDefinition, invitation.role)
    return UserInvitationView(
        id=invitation.id,
        email=invitation.email,
        role=invitation.role,
        role_name=role.name if role else invitation.role,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
        status=status,
    )


def _user_view(db: Session, user: User) -> UserView:
    return UserView.model_validate(user).model_copy(update={
        "role_name": role_name_for_user(db, user),
        "permissions": permissions_for_user(db, user),
    })


def _role_or_422(db: Session, code: str) -> RoleDefinition | None:
    role = db.get(RoleDefinition, code)
    if role and role.is_active:
        return role
    # create_all based tests and legacy pre-migration databases still know the two
    # built-in roles even before role_definitions is seeded by Alembic.
    if role is None and code in {Role.ADMIN.value, Role.MANAGER.value}:
        return None
    raise HTTPException(status_code=422, detail="Выбранная роль недоступна")


def _registration_url(settings: Settings, token: str) -> str:
    return f"{settings.admin_web_origin.rstrip('/')}/register/{token}"


def _new_invitation_token(settings: Settings) -> tuple[str, str]:
    raw_token = secrets.token_urlsafe(48)
    return raw_token, token_hash(raw_token, settings.session_secret)


def _restricted_user_reference(db: Session, user_id: str) -> str | None:
    """Return a table name that prevents hard deletion, if any.

    The check is metadata-driven so new RESTRICT user references cannot silently
    turn the Users UI into a database integrity error later.
    """
    for table in Base.metadata.tables.values():
        for column in table.columns:
            for foreign_key in column.foreign_keys:
                if foreign_key.target_fullname != "users.id":
                    continue
                if (foreign_key.ondelete or "").upper() != "RESTRICT":
                    continue
                if db.execute(select(column).where(column == user_id).limit(1)).first():
                    return table.name
    return None


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
) -> list[UserView]:
    users = list(db.scalars(select(User).order_by(User.created_at.desc())).all())
    return [_user_view(db, user) for user in users]


@router.get("/roles/permissions", response_model=list[PermissionCatalogItem])
def list_permission_catalog(
    _: Annotated[SessionContext, Depends(require_admin)],
) -> list[PermissionCatalogItem]:
    return [PermissionCatalogItem(code=code, label=PERMISSION_LABELS[code]) for code in PERMISSIONS]


@router.get("/roles", response_model=list[RoleDefinitionView])
def list_roles(
    _: Annotated[SessionContext, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[RoleDefinition]:
    return list(db.scalars(select(RoleDefinition).order_by(RoleDefinition.is_system.desc(), RoleDefinition.name)).all())


@router.post("/roles", response_model=RoleDefinitionView, status_code=201)
def create_role(
    payload: RoleDefinitionCreate,
    request: Request,
    context: Annotated[SessionContext, Depends(require_admin_write)],
    db: Annotated[Session, Depends(get_db)],
) -> RoleDefinition:
    code = payload.code.upper()
    if db.get(RoleDefinition, code):
        raise HTTPException(status_code=409, detail="Роль с таким кодом уже существует")
    if db.scalar(select(RoleDefinition).where(func.lower(RoleDefinition.name) == payload.name.lower())):
        raise HTTPException(status_code=409, detail="Роль с таким названием уже существует")
    role = RoleDefinition(code=code, name=payload.name, permissions=normalize_permissions(payload.permissions), is_system=False, is_active=True)
    db.add(role)
    record_event(db, request, "role_created", actor_user_id=context.user.id, details={"role": code})
    db.commit(); db.refresh(role)
    return role


@router.patch("/roles/{role_code}", response_model=RoleDefinitionView)
def update_role_definition(
    role_code: str,
    payload: RoleDefinitionUpdate,
    request: Request,
    context: Annotated[SessionContext, Depends(require_admin_write)],
    db: Annotated[Session, Depends(get_db)],
) -> RoleDefinition:
    role = db.get(RoleDefinition, role_code)
    if not role:
        raise HTTPException(status_code=404, detail="Роль не найдена")
    if role.code == Role.ADMIN.value:
        if payload.name is not None or payload.permissions is not None or payload.is_active is False:
            raise HTTPException(status_code=400, detail="Системная роль администратора защищена")
        return role
    if payload.name is not None:
        duplicate = db.scalar(select(RoleDefinition).where(func.lower(RoleDefinition.name) == payload.name.lower(), RoleDefinition.code != role.code))
        if duplicate:
            raise HTTPException(status_code=409, detail="Роль с таким названием уже существует")
        role.name = payload.name
    if payload.permissions is not None:
        role.permissions = normalize_permissions(payload.permissions)
    if payload.is_active is not None:
        if role.is_system and payload.is_active is False:
            raise HTTPException(status_code=400, detail="Системную роль нельзя отключить")
        role.is_active = payload.is_active
    record_event(db, request, "role_updated", actor_user_id=context.user.id, details={"role": role.code})
    db.commit(); db.refresh(role)
    return role


@router.delete("/roles/{role_code}", response_model=MessageView)
def delete_role_definition(
    role_code: str,
    request: Request,
    context: Annotated[SessionContext, Depends(require_admin_write)],
    db: Annotated[Session, Depends(get_db)],
) -> MessageView:
    role = db.get(RoleDefinition, role_code)
    if not role:
        raise HTTPException(status_code=404, detail="Роль не найдена")
    if role.is_system:
        raise HTTPException(status_code=400, detail="Системную роль нельзя удалить")
    if db.scalar(select(func.count()).select_from(User).where(User.role == role.code)):
        raise HTTPException(status_code=409, detail="Роль назначена пользователям. Сначала смените им роль.")
    if db.scalar(select(func.count()).select_from(UserInvitation).where(UserInvitation.role == role.code, UserInvitation.accepted_at.is_(None), UserInvitation.cancelled_at.is_(None))):
        raise HTTPException(status_code=409, detail="Роль используется в активных приглашениях")
    db.delete(role)
    record_event(db, request, "role_deleted", actor_user_id=context.user.id, details={"role": role.code})
    db.commit()
    return MessageView(message="Роль удалена")


@router.get("/invitations", response_model=list[UserInvitationView])
def list_user_invitations(
    _: Annotated[SessionContext, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[UserInvitationView]:
    invitations = db.scalars(
        select(UserInvitation)
        .where(
            UserInvitation.accepted_at.is_(None),
            UserInvitation.cancelled_at.is_(None),
        )
        .order_by(UserInvitation.created_at.desc())
    ).all()
    return [_invitation_view(db, invitation) for invitation in invitations]


@router.post("/invitations", response_model=UserInvitationCreateView, status_code=201)
def create_user_invitation(
    payload: UserInvitationCreateRequest,
    request: Request,
    context: Annotated[SessionContext, Depends(require_admin_write)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> UserInvitationCreateView:
    email = str(payload.email).lower()
    _role_or_422(db, payload.role)
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Пользователь с таким email уже существует")

    now = datetime.now(UTC)
    existing = db.scalar(
        select(UserInvitation)
        .where(
            UserInvitation.email == email,
            UserInvitation.accepted_at.is_(None),
            UserInvitation.cancelled_at.is_(None),
        )
        .order_by(UserInvitation.created_at.desc())
    )
    if existing and _as_utc(existing.expires_at) > now:
        raise HTTPException(
            status_code=409,
            detail="Для этого email уже создано действующее приглашение",
        )
    if existing:
        existing.cancelled_at = now

    raw_token, digest = _new_invitation_token(settings)
    invitation = UserInvitation(
        email=email,
        role=payload.role,
        token_hash=digest,
        created_by_user_id=context.user.id,
        expires_at=now + timedelta(days=settings.user_invitation_days),
    )
    db.add(invitation)
    db.flush()
    record_event(
        db,
        request,
        "user_invited",
        actor_user_id=context.user.id,
        details={
            "invitation_id": invitation.id,
            "email": email,
            "role": invitation.role,
            "expires_at": invitation.expires_at.isoformat(),
        },
    )
    db.commit()
    db.refresh(invitation)
    return UserInvitationCreateView(
        invitation=_invitation_view(db, invitation),
        registration_url=_registration_url(settings, raw_token),
    )


@router.post("/invitations/{invitation_id}/new-link", response_model=UserInvitationCreateView)
def renew_user_invitation(
    invitation_id: str,
    request: Request,
    context: Annotated[SessionContext, Depends(require_admin_write)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> UserInvitationCreateView:
    invitation = db.get(UserInvitation, invitation_id)
    if not invitation or invitation.accepted_at is not None or invitation.cancelled_at is not None:
        raise HTTPException(status_code=404, detail="Приглашение не найдено")
    if db.scalar(select(User).where(User.email == invitation.email)):
        raise HTTPException(status_code=409, detail="Пользователь с таким email уже зарегистрирован")

    raw_token, digest = _new_invitation_token(settings)
    invitation.token_hash = digest
    invitation.expires_at = datetime.now(UTC) + timedelta(days=settings.user_invitation_days)
    record_event(
        db,
        request,
        "user_invitation_renewed",
        actor_user_id=context.user.id,
        details={
            "invitation_id": invitation.id,
            "email": invitation.email,
            "role": invitation.role,
            "expires_at": invitation.expires_at.isoformat(),
        },
    )
    db.commit()
    db.refresh(invitation)
    return UserInvitationCreateView(
        invitation=_invitation_view(db, invitation),
        registration_url=_registration_url(settings, raw_token),
    )


@router.delete("/invitations/{invitation_id}", response_model=MessageView)
def cancel_user_invitation(
    invitation_id: str,
    request: Request,
    context: Annotated[SessionContext, Depends(require_admin_write)],
    db: Annotated[Session, Depends(get_db)],
) -> MessageView:
    invitation = db.get(UserInvitation, invitation_id)
    if not invitation or invitation.accepted_at is not None or invitation.cancelled_at is not None:
        raise HTTPException(status_code=404, detail="Приглашение не найдено")
    invitation.cancelled_at = datetime.now(UTC)
    record_event(
        db,
        request,
        "user_invitation_cancelled",
        actor_user_id=context.user.id,
        details={"invitation_id": invitation.id, "email": invitation.email},
    )
    db.commit()
    return MessageView(message="Приглашение отменено")


@router.post("", response_model=UserCreateView, status_code=201)
def create_user(
    payload: UserCreateRequest,
    request: Request,
    context: Annotated[SessionContext, Depends(require_admin_write)],
    db: Annotated[Session, Depends(get_db)],
) -> UserCreateView:
    email = payload.email.lower()
    _role_or_422(db, payload.role)
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Пользователь с таким email уже существует")
    password = generate_temporary_password()
    user = User(
        email=email,
        display_name=payload.display_name or email.split("@", 1)[0],
        role=payload.role,
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
        user=_user_view(db, user),
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
) -> UserView:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.id == context.user.id and payload.is_active is False:
        raise HTTPException(status_code=400, detail="Нельзя деактивировать текущую учетную запись")
    if _would_remove_last_active_admin(
        db,
        user,
        next_role=payload.role,
        next_is_active=payload.is_active,
    ):
        raise HTTPException(
            status_code=400,
            detail="В CRM должен оставаться хотя бы один активный администратор",
        )
    changes: dict[str, object] = {}
    if payload.display_name is not None:
        changes["display_name"] = payload.display_name or user.email.split("@", 1)[0]
    if payload.role is not None:
        _role_or_422(db, payload.role)
        if user.id == context.user.id and payload.role != Role.ADMIN.value:
            raise HTTPException(status_code=400, detail="Нельзя снять собственные права администратора")
        changes["role"] = payload.role
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
    return _user_view(db, user)


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


@router.delete("/{user_id}", response_model=MessageView)
def delete_user(
    user_id: str,
    request: Request,
    context: Annotated[SessionContext, Depends(require_admin_write)],
    db: Annotated[Session, Depends(get_db)],
) -> MessageView:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.id == context.user.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить текущую учетную запись")
    if _would_remove_last_active_admin(db, user, next_is_active=False):
        raise HTTPException(
            status_code=400,
            detail="В CRM должен оставаться хотя бы один активный администратор",
        )

    restricted_table = _restricted_user_reference(db, user.id)
    if restricted_table:
        raise HTTPException(
            status_code=409,
            detail=(
                "Пользователь уже связан с рабочей историей CRM. "
                "Чтобы сохранить историю, отключите ему доступ вместо удаления."
            ),
        )

    # Authentication-only records are safe to remove together with an unused account.
    db.execute(delete(RecoveryCode).where(RecoveryCode.user_id == user.id))
    db.execute(delete(UserSession).where(UserSession.user_id == user.id))
    record_event(
        db,
        request,
        "user_deleted",
        actor_user_id=context.user.id,
        target_user_id=user.id,
        details={"email": user.email, "role": user.role},
    )
    db.delete(user)
    db.commit()
    return MessageView(message="Пользователь удалён")

