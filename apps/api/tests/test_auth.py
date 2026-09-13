import time
from datetime import UTC, datetime, timedelta

import pyotp

from app.config import get_settings
from app.db import SessionLocal
from app.models import Role, SecurityAuditEvent, User, UserSession
from app.security import decrypt_totp_secret
from tests.conftest import csrf_headers


def login(client, email="owner@example.com", password="TemporaryPass123!"):
    return client.post("/api/admin/auth/login", json={"email": email, "password": password})


def complete_first_login(client, create_user, email="owner@example.com", role=Role.ADMIN):
    create_user(email, role=role)
    assert login(client, email).json()["stage"] == "CHANGE_PASSWORD"
    changed = client.post(
        "/api/admin/auth/change-password",
        json={"new_password": "PermanentPass456!"},
        headers=csrf_headers(client),
    )
    assert changed.json()["stage"] == "TWO_FACTOR_SETUP"
    setup = client.get("/api/admin/auth/2fa/setup")
    assert setup.status_code == 200
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).one()
        secret = decrypt_totp_secret(user.two_factor_secret_encrypted, get_settings())
    enrolled = client.post(
        "/api/admin/auth/2fa/setup",
        json={"code": pyotp.TOTP(secret).now()},
        headers=csrf_headers(client),
    )
    assert enrolled.status_code == 200
    return enrolled.json()["recovery_codes"]


def test_invalid_login_is_neutral(client, create_user):
    create_user("owner@example.com")
    response = login(client, password="wrong")
    assert response.status_code == 401
    assert response.json()["detail"] == "Неверный email или пароль"


def test_protected_route_requires_authentication(client):
    assert client.get("/api/admin/users").status_code == 401


def test_forced_password_change_cannot_be_skipped(client, create_user):
    create_user("owner@example.com")
    assert login(client).status_code == 200
    assert client.get("/api/admin/users").status_code == 403


def test_password_policy(client, create_user):
    create_user("owner@example.com")
    login(client)
    response = client.post(
        "/api/admin/auth/change-password",
        json={"new_password": "ninechars"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 422
    accepted = client.post(
        "/api/admin/auth/change-password",
        json={"new_password": "TenChars1!"},
        headers=csrf_headers(client),
    )
    assert accepted.status_code == 200


def test_totp_enrollment_and_admin_access(client, create_user):
    codes = complete_first_login(client, create_user)
    assert len(codes) == 10
    assert client.get("/api/admin/users").status_code == 200


def test_invalid_totp(client, create_user):
    create_user("owner@example.com")
    login(client)
    client.post(
        "/api/admin/auth/change-password",
        json={"new_password": "PermanentPass456!"},
        headers=csrf_headers(client),
    )
    client.get("/api/admin/auth/2fa/setup")
    response = client.post(
        "/api/admin/auth/2fa/setup",
        json={"code": "000000"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 400


def test_totp_accepts_small_clock_drift(client, create_user):
    create_user("owner@example.com")
    login(client)
    client.post(
        "/api/admin/auth/change-password",
        json={"new_password": "PermanentPass456!"},
        headers=csrf_headers(client),
    )
    setup = client.get("/api/admin/auth/2fa/setup").json()
    current = pyotp.TOTP(setup["manual_key"])
    # Generate a code two 30-second intervals ahead to model a small device
    # clock drift while exercising the real endpoint verification path.
    code = current.at(int(time.time()) + 60)
    response = client.post(
        "/api/admin/auth/2fa/setup",
        json={"code": code},
        headers=csrf_headers(client),
    )
    assert response.status_code == 200


def test_recovery_code_is_single_use(client, create_user):
    codes = complete_first_login(client, create_user)
    client.post("/api/admin/auth/logout", headers=csrf_headers(client))
    assert login(client, password="PermanentPass456!").json()["stage"] == "TWO_FACTOR_VERIFY"
    recovered = client.post(
        "/api/admin/auth/recovery",
        json={"code": codes[0]},
        headers=csrf_headers(client),
    )
    assert recovered.status_code == 200
    client.post("/api/admin/auth/logout", headers=csrf_headers(client))
    login(client, password="PermanentPass456!")
    reused = client.post(
        "/api/admin/auth/recovery",
        json={"code": codes[0]},
        headers=csrf_headers(client),
    )
    assert reused.status_code == 400


def test_logout_invalidates_session(client, create_user):
    complete_first_login(client, create_user)
    assert client.post("/api/admin/auth/logout", headers=csrf_headers(client)).status_code == 200
    assert client.get("/api/admin/auth/session").status_code == 401


def test_manager_is_blocked_from_admin_apis(client, create_user):
    complete_first_login(client, create_user, email="manager@example.com", role=Role.MANAGER)
    assert client.get("/api/admin/users").status_code == 403
    assert client.get("/api/admin/settings").status_code == 403
    assert client.get("/api/admin/tariffs").status_code == 403


def test_admin_can_create_manager_with_temporary_password(client, create_user):
    complete_first_login(client, create_user)
    response = client.post(
        "/api/admin/users",
        json={"email": "manager@example.com", "display_name": "Менеджер", "role": "MANAGER"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 201
    assert response.json()["user"]["must_change_password"] is True
    assert response.json()["temporary_password"]


def test_admin_can_edit_and_deactivate_user_with_session_revocation(client, create_user):
    complete_first_login(client, create_user)
    manager = create_user(
        "manager@example.com",
        role=Role.MANAGER,
        must_change_password=False,
    )
    with SessionLocal() as db:
        db.add(
            UserSession(
                user_id=manager.id,
                token_hash="a" * 64,
                csrf_hash="b" * 64,
                auth_stage="AUTHENTICATED",
                expires_at=datetime.now(UTC) + timedelta(hours=1),
                idle_expires_at=datetime.now(UTC) + timedelta(hours=1),
            )
        )
        db.commit()

    edited = client.patch(
        f"/api/admin/users/{manager.id}",
        json={"display_name": "Мария Орлова", "role": "ADMIN"},
        headers=csrf_headers(client),
    )
    assert edited.status_code == 200
    assert edited.json()["display_name"] == "Мария Орлова"
    assert edited.json()["role"] == "ADMIN"

    deactivated = client.patch(
        f"/api/admin/users/{manager.id}",
        json={"is_active": False},
        headers=csrf_headers(client),
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False
    with SessionLocal() as db:
        session = db.query(UserSession).filter(UserSession.user_id == manager.id).one()
        assert session.revoked_at is not None


def test_security_events_are_audited(client, create_user):
    complete_first_login(client, create_user)
    with SessionLocal() as db:
        actions = set(db.query(SecurityAuditEvent.action).all())
    flattened = {item[0] for item in actions}
    assert {"login", "password_changed", "2fa_enabled"}.issubset(flattened)


def test_csrf_is_enforced(client, create_user):
    complete_first_login(client, create_user)
    response = client.post(
        "/api/admin/users",
        json={"email": "manager@example.com", "display_name": "Менеджер", "role": "MANAGER"},
    )
    assert response.status_code == 403
