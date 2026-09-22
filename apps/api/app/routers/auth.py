import time
from collections import defaultdict, deque
from datetime import UTC, datetime
from typing import Annotated

import pyotp
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.audit import record_event
from app.config import Settings, get_settings
from app.db import get_db
from app.dependencies import SessionContext, get_session_context, require_csrf
from app.models import AuthStage, RecoveryCode, Role, User, UserInvitation, UserSession
from app.schemas import (
    AuthState,
    LoginRequest,
    MessageView,
    PasswordChangeRequest,
    RecoveryCodesView,
    RecoveryRequest,
    TotpCodeRequest,
    TotpSetupView,
    UserInvitationAcceptRequest,
    UserInvitationPublicView,
)
from app.security import (
    create_session_values,
    decrypt_totp_secret,
    encrypt_totp_secret,
    generate_recovery_codes,
    hash_password,
    qr_data_uri,
    token_hash,
    totp_uri,
    validate_password,
    verify_password,
    verify_totp,
)

router = APIRouter(prefix="/api/admin/auth", tags=["auth"])
attempts: dict[str, deque[float]] = defaultdict(deque)


def set_auth_cookies(response: Response, token: str, csrf: str, settings: Settings) -> None:
    response.set_cookie(
        "lc_session",
        token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.session_hours * 3600,
        path="/",
    )
    response.set_cookie(
        "lc_csrf",
        csrf,
        httponly=False,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.session_hours * 3600,
        path="/",
    )


def clear_auth_cookies(response: Response, settings: Settings) -> None:
    response.delete_cookie("lc_session", path="/", secure=settings.cookie_secure, samesite="lax")
    response.delete_cookie("lc_csrf", path="/", secure=settings.cookie_secure, samesite="lax")


def check_login_limit(key: str, settings: Settings) -> None:
    now = time.monotonic()
    values = attempts[key]
    while values and now - values[0] > settings.login_window_seconds:
        values.popleft()
    if len(values) >= settings.login_max_attempts:
        raise HTTPException(status_code=429, detail="Слишком много попыток. Попробуйте позже")
    values.append(now)


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _get_valid_invitation(token: str, db: Session, settings: Settings) -> UserInvitation:
    invitation = db.scalar(
        select(UserInvitation).where(
            UserInvitation.token_hash == token_hash(token, settings.session_secret)
        )
    )
    if not invitation:
        raise HTTPException(status_code=404, detail="Приглашение не найдено")
    if invitation.cancelled_at is not None:
        raise HTTPException(status_code=410, detail="Приглашение отменено")
    if invitation.accepted_at is not None:
        raise HTTPException(status_code=410, detail="Приглашение уже использовано")
    if _as_utc(invitation.expires_at) <= datetime.now(UTC):
        raise HTTPException(status_code=410, detail="Срок действия приглашения истёк")
    return invitation


@router.get("/invitations/{token}", response_model=UserInvitationPublicView)
def get_user_invitation(
    token: str,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> UserInvitationPublicView:
    invitation = _get_valid_invitation(token, db, settings)
    return UserInvitationPublicView(
        email=invitation.email,
        role=Role(invitation.role),
        expires_at=invitation.expires_at,
    )


@router.post("/invitations/{token}/accept", response_model=AuthState)
def accept_user_invitation(
    token: str,
    payload: UserInvitationAcceptRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthState:
    invitation = _get_valid_invitation(token, db, settings)
    if db.scalar(select(User).where(User.email == invitation.email)):
        raise HTTPException(status_code=409, detail="Учётная запись для этого email уже существует")
    try:
        validate_password(payload.password)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    display_name = payload.display_name.strip() or invitation.email.split("@", 1)[0]
    user = User(
        email=invitation.email,
        display_name=display_name,
        role=invitation.role,
        password_hash=hash_password(payload.password),
        is_active=True,
        must_change_password=False,
        two_factor_enabled=False,
    )
    db.add(user)
    db.flush()
    invitation.accepted_at = datetime.now(UTC)
    invitation.accepted_user_id = user.id

    session, raw_token, csrf_token = create_session_values(user, settings)
    session.user_agent = request.headers.get("user-agent", "")[:500]
    db.add(session)
    record_event(
        db,
        request,
        "user_invitation_accepted",
        target_user_id=user.id,
        details={
            "invitation_id": invitation.id,
            "email": invitation.email,
            "role": invitation.role,
        },
    )
    db.commit()
    db.refresh(user)
    set_auth_cookies(response, raw_token, csrf_token, settings)
    return AuthState(stage=AuthStage(session.auth_stage), user=user)


@router.post("/login", response_model=AuthState)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthState:
    key = f"{request.client.host if request.client else 'unknown'}:{payload.email.lower()}"
    check_login_limit(key, settings)
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not user.is_active or not verify_password(user.password_hash, payload.password):
        record_event(db, request, "login", outcome="FAILURE", details={"reason": "invalid"})
        db.commit()
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    session, raw_token, csrf_token = create_session_values(user, settings)
    session.user_agent = request.headers.get("user-agent", "")[:500]
    db.add(session)
    record_event(db, request, "login", actor_user_id=user.id, target_user_id=user.id)
    db.commit()
    attempts.pop(key, None)
    set_auth_cookies(response, raw_token, csrf_token, settings)
    return AuthState(stage=AuthStage(session.auth_stage), user=user)


@router.get("/session", response_model=AuthState)
def session_state(
    context: Annotated[SessionContext, Depends(get_session_context)],
    db: Annotated[Session, Depends(get_db)],
) -> AuthState:
    db.commit()
    return AuthState(stage=AuthStage(context.session.auth_stage), user=context.user)


@router.post("/change-password", response_model=AuthState)
def change_password(
    payload: PasswordChangeRequest,
    request: Request,
    context: Annotated[SessionContext, Depends(require_csrf)],
    db: Annotated[Session, Depends(get_db)],
) -> AuthState:
    if context.session.auth_stage not in {
        AuthStage.CHANGE_PASSWORD.value,
        AuthStage.AUTHENTICATED.value,
    }:
        raise HTTPException(status_code=403, detail="Смена пароля сейчас недоступна")
    if context.session.auth_stage == AuthStage.AUTHENTICATED.value:
        if not payload.current_password or not verify_password(
            context.user.password_hash, payload.current_password
        ):
            raise HTTPException(status_code=400, detail="Текущий пароль неверен")
    try:
        validate_password(payload.new_password)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    if verify_password(context.user.password_hash, payload.new_password):
        raise HTTPException(status_code=422, detail="Новый пароль должен отличаться от текущего")

    context.user.password_hash = hash_password(payload.new_password)
    context.user.must_change_password = False
    context.session.auth_stage = (
        AuthStage.TWO_FACTOR_VERIFY.value
        if context.user.two_factor_enabled
        else AuthStage.TWO_FACTOR_SETUP.value
    )
    db.execute(
        update(UserSession)
        .where(UserSession.user_id == context.user.id, UserSession.id != context.session.id)
        .values(revoked_at=datetime.now(UTC))
    )
    record_event(
        db,
        request,
        "password_changed",
        actor_user_id=context.user.id,
        target_user_id=context.user.id,
    )
    db.commit()
    return AuthState(stage=AuthStage(context.session.auth_stage), user=context.user)


@router.get("/2fa/setup", response_model=TotpSetupView)
def setup_totp(
    context: Annotated[SessionContext, Depends(get_session_context)],
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
) -> TotpSetupView:
    if context.session.auth_stage != AuthStage.TWO_FACTOR_SETUP.value:
        raise HTTPException(status_code=403, detail="Настройка 2FA сейчас недоступна")
    # Concurrent setup requests must return the same key, never overwrite one another.
    db.execute(
        update(User)
        .where(User.id == context.user.id, User.two_factor_secret_encrypted.is_(None))
        .values(two_factor_secret_encrypted=encrypt_totp_secret(pyotp.random_base32(), settings))
    )
    db.commit()
    db.refresh(context.user)
    secret = decrypt_totp_secret(context.user.two_factor_secret_encrypted, settings)
    uri = totp_uri(secret, context.user.email)
    return TotpSetupView(manual_key=secret, qr_data_uri=qr_data_uri(uri))


@router.post("/2fa/setup", response_model=RecoveryCodesView)
def confirm_totp(
    payload: TotpCodeRequest,
    request: Request,
    context: Annotated[SessionContext, Depends(require_csrf)],
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
) -> RecoveryCodesView:
    if context.session.auth_stage != AuthStage.TWO_FACTOR_SETUP.value:
        raise HTTPException(status_code=403, detail="Настройка 2FA сейчас недоступна")
    encrypted = context.user.two_factor_secret_encrypted
    if not encrypted or not verify_totp(decrypt_totp_secret(encrypted, settings), payload.code):
        record_event(
            db,
            request,
            "2fa_setup",
            actor_user_id=context.user.id,
            target_user_id=context.user.id,
            outcome="FAILURE",
        )
        db.commit()
        raise HTTPException(status_code=400, detail="Неверный код authenticator")
    codes = generate_recovery_codes()
    db.execute(delete(RecoveryCode).where(RecoveryCode.user_id == context.user.id))
    db.add_all(
        [
            RecoveryCode(
                user_id=context.user.id,
                code_hash=token_hash(code.upper(), settings.session_secret),
            )
            for code in codes
        ]
    )
    context.user.two_factor_enabled = True
    context.session.auth_stage = AuthStage.AUTHENTICATED.value
    context.user.last_login_at = datetime.now(UTC)
    record_event(
        db, request, "2fa_enabled", actor_user_id=context.user.id, target_user_id=context.user.id
    )
    db.commit()
    return RecoveryCodesView(
        recovery_codes=codes,
        warning="Сохраните коды сейчас. Повторно они показаны не будут.",
    )


@router.post("/2fa/verify", response_model=AuthState)
def verify_second_factor(
    payload: TotpCodeRequest,
    request: Request,
    context: Annotated[SessionContext, Depends(require_csrf)],
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
) -> AuthState:
    if context.session.auth_stage != AuthStage.TWO_FACTOR_VERIFY.value:
        raise HTTPException(status_code=403, detail="Проверка 2FA сейчас недоступна")
    encrypted = context.user.two_factor_secret_encrypted
    if not encrypted or not verify_totp(decrypt_totp_secret(encrypted, settings), payload.code):
        record_event(
            db,
            request,
            "2fa_verify",
            actor_user_id=context.user.id,
            target_user_id=context.user.id,
            outcome="FAILURE",
        )
        db.commit()
        raise HTTPException(status_code=400, detail="Неверный одноразовый код")
    context.session.auth_stage = AuthStage.AUTHENTICATED.value
    context.user.last_login_at = datetime.now(UTC)
    record_event(
        db, request, "2fa_verify", actor_user_id=context.user.id, target_user_id=context.user.id
    )
    db.commit()
    return AuthState(stage=AuthStage.AUTHENTICATED, user=context.user)


@router.post("/recovery", response_model=AuthState)
def recover_with_code(
    payload: RecoveryRequest,
    request: Request,
    context: Annotated[SessionContext, Depends(require_csrf)],
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
) -> AuthState:
    if context.session.auth_stage != AuthStage.TWO_FACTOR_VERIFY.value:
        raise HTTPException(status_code=403, detail="Recovery сейчас недоступен")
    digest = token_hash(payload.code.strip().upper(), settings.session_secret)
    code = db.scalar(
        select(RecoveryCode).where(
            RecoveryCode.user_id == context.user.id,
            RecoveryCode.code_hash == digest,
            RecoveryCode.used_at.is_(None),
        )
    )
    if not code:
        raise HTTPException(status_code=400, detail="Recovery code недействителен")
    code.used_at = datetime.now(UTC)
    context.session.auth_stage = AuthStage.AUTHENTICATED.value
    context.user.last_login_at = datetime.now(UTC)
    record_event(
        db,
        request,
        "recovery_code_used",
        actor_user_id=context.user.id,
        target_user_id=context.user.id,
    )
    db.commit()
    return AuthState(stage=AuthStage.AUTHENTICATED, user=context.user)


@router.post("/logout", response_model=MessageView)
def logout(
    request: Request,
    response: Response,
    context: Annotated[SessionContext, Depends(require_csrf)],
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
) -> MessageView:
    context.session.revoked_at = datetime.now(UTC)
    record_event(
        db, request, "logout", actor_user_id=context.user.id, target_user_id=context.user.id
    )
    db.commit()
    clear_auth_cookies(response, settings)
    return MessageView(message="Сессия завершена")
