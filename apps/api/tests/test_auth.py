import time
from datetime import UTC, datetime, timedelta

import pyotp

from app.config import get_settings
from app.client_models import Company
from app.db import SessionLocal
from app.models import RecoveryCode, Role, RoleDefinition, SecurityAuditEvent, User, UserInvitation, UserSession
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




def test_custom_role_permissions_are_enforced_by_backend(client, create_user):
    complete_first_login(client, create_user, email="operator@example.com", role=Role.MANAGER)
    with SessionLocal() as db:
        db.add(RoleDefinition(
            code="ORDER_READER",
            name="Просмотр заказов",
            permissions=["ORDERS_VIEW"],
            is_system=False,
            is_active=True,
        ))
        user = db.query(User).filter(User.email == "operator@example.com").one()
        user.role = "ORDER_READER"
        db.commit()

    session = client.get("/api/admin/auth/session")
    assert session.status_code == 200
    assert session.json()["user"]["role"] == "ORDER_READER"
    assert session.json()["user"]["permissions"] == ["ORDERS_VIEW"]
    assert client.get("/api/admin/crm/orders?q=&status=&archived=false&page=1&page_size=5").status_code == 200
    assert client.get("/api/admin/companies?q=&archived=false&page=1&language=&work_type=").status_code == 403
    assert client.get("/api/admin/users").status_code == 403


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


def test_admin_can_delete_unused_user_but_not_self_or_last_admin(client, create_user):
    complete_first_login(client, create_user)
    manager = create_user("remove-me@example.com", role=Role.MANAGER, must_change_password=False)

    removed = client.delete(
        f"/api/admin/users/{manager.id}",
        headers=csrf_headers(client),
    )
    assert removed.status_code == 200
    with SessionLocal() as db:
        assert db.get(User, manager.id) is None

    with SessionLocal() as db:
        owner = db.query(User).filter(User.email == "owner@example.com").one()
        owner_id = owner.id

    self_delete = client.delete(
        f"/api/admin/users/{owner_id}",
        headers=csrf_headers(client),
    )
    assert self_delete.status_code == 400

    demote_last_admin = client.patch(
        f"/api/admin/users/{owner_id}",
        json={"role": "MANAGER"},
        headers=csrf_headers(client),
    )
    assert demote_last_admin.status_code == 400

    deactivate_last_admin = client.patch(
        f"/api/admin/users/{owner_id}",
        json={"is_active": False},
        headers=csrf_headers(client),
    )
    assert deactivate_last_admin.status_code == 400


def test_manager_cannot_mutate_user_administration(client, create_user):
    complete_first_login(client, create_user, email="manager@example.com", role=Role.MANAGER)
    target = create_user("target@example.com", role=Role.MANAGER, must_change_password=False)

    assert client.post(
        "/api/admin/users",
        json={"email": "other@example.com", "display_name": "Другой", "role": "MANAGER"},
        headers=csrf_headers(client),
    ).status_code == 403
    assert client.get("/api/admin/users/invitations").status_code == 403
    assert client.post(
        "/api/admin/users/invitations",
        json={"email": "invited@example.com", "role": "MANAGER"},
        headers=csrf_headers(client),
    ).status_code == 403
    assert client.patch(
        f"/api/admin/users/{target.id}",
        json={"role": "ADMIN"},
        headers=csrf_headers(client),
    ).status_code == 403
    assert client.post(
        f"/api/admin/users/{target.id}/reset-password",
        headers=csrf_headers(client),
    ).status_code == 403
    assert client.post(
        f"/api/admin/users/{target.id}/reset-2fa",
        headers=csrf_headers(client),
    ).status_code == 403
    assert client.delete(
        f"/api/admin/users/{target.id}",
        headers=csrf_headers(client),
    ).status_code == 403


def test_admin_user_security_actions_are_persisted(client, create_user):
    complete_first_login(client, create_user)
    target = create_user(
        "security-target@example.com",
        role=Role.MANAGER,
        must_change_password=False,
        two_factor_enabled=True,
    )
    with SessionLocal() as db:
        stored = db.get(User, target.id)
        stored.two_factor_secret_encrypted = "encrypted-placeholder"
        db.add(RecoveryCode(user_id=target.id, code_hash="c" * 64))
        db.add(
            UserSession(
                user_id=target.id,
                token_hash="d" * 64,
                csrf_hash="e" * 64,
                auth_stage="AUTHENTICATED",
                expires_at=datetime.now(UTC) + timedelta(hours=1),
                idle_expires_at=datetime.now(UTC) + timedelta(hours=1),
            )
        )
        db.commit()

    reset_2fa = client.post(
        f"/api/admin/users/{target.id}/reset-2fa",
        headers=csrf_headers(client),
    )
    assert reset_2fa.status_code == 200
    with SessionLocal() as db:
        stored = db.get(User, target.id)
        assert stored.two_factor_enabled is False
        assert stored.two_factor_secret_encrypted is None
        assert db.query(RecoveryCode).filter(RecoveryCode.user_id == target.id).count() == 0
        assert all(session.revoked_at is not None for session in db.query(UserSession).filter(UserSession.user_id == target.id).all())

    with SessionLocal() as db:
        db.add(
            UserSession(
                user_id=target.id,
                token_hash="f" * 64,
                csrf_hash="1" * 64,
                auth_stage="AUTHENTICATED",
                expires_at=datetime.now(UTC) + timedelta(hours=1),
                idle_expires_at=datetime.now(UTC) + timedelta(hours=1),
            )
        )
        db.commit()

    reset_password = client.post(
        f"/api/admin/users/{target.id}/reset-password",
        headers=csrf_headers(client),
    )
    assert reset_password.status_code == 200
    assert reset_password.json()["temporary_password"]
    with SessionLocal() as db:
        stored = db.get(User, target.id)
        assert stored.must_change_password is True
        assert all(session.revoked_at is not None for session in db.query(UserSession).filter(UserSession.user_id == target.id).all())


def test_used_user_cannot_be_hard_deleted(client, create_user):
    complete_first_login(client, create_user)
    manager = create_user("linked-manager@example.com", role=Role.MANAGER, must_change_password=False)
    with SessionLocal() as db:
        db.add(Company(name="Клиент менеджера", manager_id=manager.id))
        db.commit()

    response = client.delete(
        f"/api/admin/users/{manager.id}",
        headers=csrf_headers(client),
    )
    assert response.status_code == 409
    with SessionLocal() as db:
        assert db.get(User, manager.id) is not None


def test_admin_invites_user_and_invited_user_registers_with_own_password(client, create_user):
    complete_first_login(client, create_user)
    created = client.post(
        "/api/admin/users/invitations",
        json={"email": "new-manager@example.com", "role": "MANAGER"},
        headers=csrf_headers(client),
    )
    assert created.status_code == 201
    payload = created.json()
    invitation_id = payload["invitation"]["id"]
    token = payload["registration_url"].rsplit("/", 1)[1]
    assert payload["registration_url"].startswith("http://testserver/register/")
    assert payload["invitation"]["status"] == "PENDING"

    with SessionLocal() as db:
        assert db.query(User).filter(User.email == "new-manager@example.com").count() == 0
        invitation = db.get(UserInvitation, invitation_id)
        assert invitation is not None
        assert invitation.token_hash != token

    public = client.get(f"/api/admin/auth/invitations/{token}")
    assert public.status_code == 200
    assert public.json()["email"] == "new-manager@example.com"
    assert public.json()["role"] == "MANAGER"

    accepted = client.post(
        f"/api/admin/auth/invitations/{token}/accept",
        json={"password": "OwnPermanentPass789!"},
    )
    assert accepted.status_code == 200
    assert accepted.json()["stage"] == "TWO_FACTOR_SETUP"
    assert accepted.json()["user"]["role"] == "MANAGER"
    assert accepted.json()["user"]["must_change_password"] is False
    assert client.get("/api/admin/auth/2fa/setup").status_code == 200

    with SessionLocal() as db:
        user = db.query(User).filter(User.email == "new-manager@example.com").one()
        invitation = db.get(UserInvitation, invitation_id)
        assert user.display_name == "new-manager"
        assert invitation.accepted_user_id == user.id
        assert invitation.accepted_at is not None

    assert client.get(f"/api/admin/auth/invitations/{token}").status_code == 410


def test_invitation_can_be_renewed_and_cancelled(client, create_user):
    complete_first_login(client, create_user)
    created = client.post(
        "/api/admin/users/invitations",
        json={"email": "pending@example.com", "role": "MANAGER"},
        headers=csrf_headers(client),
    )
    invitation_id = created.json()["invitation"]["id"]
    old_token = created.json()["registration_url"].rsplit("/", 1)[1]

    renewed = client.post(
        f"/api/admin/users/invitations/{invitation_id}/new-link",
        headers=csrf_headers(client),
    )
    assert renewed.status_code == 200
    new_token = renewed.json()["registration_url"].rsplit("/", 1)[1]
    assert new_token != old_token
    assert client.get(f"/api/admin/auth/invitations/{old_token}").status_code == 404
    assert client.get(f"/api/admin/auth/invitations/{new_token}").status_code == 200

    cancelled = client.delete(
        f"/api/admin/users/invitations/{invitation_id}",
        headers=csrf_headers(client),
    )
    assert cancelled.status_code == 200
    assert client.get(f"/api/admin/auth/invitations/{new_token}").status_code == 410
    assert client.get("/api/admin/users/invitations").json() == []


def test_expired_invitation_is_rejected_but_admin_can_issue_new_link(client, create_user):
    complete_first_login(client, create_user)
    created = client.post(
        "/api/admin/users/invitations",
        json={"email": "expired@example.com", "role": "ADMIN"},
        headers=csrf_headers(client),
    )
    invitation_id = created.json()["invitation"]["id"]
    old_token = created.json()["registration_url"].rsplit("/", 1)[1]
    with SessionLocal() as db:
        invitation = db.get(UserInvitation, invitation_id)
        invitation.expires_at = datetime.now(UTC) - timedelta(minutes=1)
        db.commit()

    expired = client.get(f"/api/admin/auth/invitations/{old_token}")
    assert expired.status_code == 410
    assert "истёк" in expired.json()["detail"]
    listing = client.get("/api/admin/users/invitations")
    assert listing.status_code == 200
    assert listing.json()[0]["status"] == "EXPIRED"

    renewed = client.post(
        f"/api/admin/users/invitations/{invitation_id}/new-link",
        headers=csrf_headers(client),
    )
    assert renewed.status_code == 200
    new_token = renewed.json()["registration_url"].rsplit("/", 1)[1]
    assert client.get(f"/api/admin/auth/invitations/{new_token}").status_code == 200


def test_invitation_creation_guards_existing_accounts_and_duplicate_pending_invites(client, create_user):
    complete_first_login(client, create_user)
    create_user("existing@example.com", role=Role.MANAGER, must_change_password=False)
    existing = client.post(
        "/api/admin/users/invitations",
        json={"email": "existing@example.com", "role": "MANAGER"},
        headers=csrf_headers(client),
    )
    assert existing.status_code == 409

    first = client.post(
        "/api/admin/users/invitations",
        json={"email": "duplicate@example.com", "role": "MANAGER"},
        headers=csrf_headers(client),
    )
    assert first.status_code == 201
    duplicate = client.post(
        "/api/admin/users/invitations",
        json={"email": "duplicate@example.com", "role": "ADMIN"},
        headers=csrf_headers(client),
    )
    assert duplicate.status_code == 409
