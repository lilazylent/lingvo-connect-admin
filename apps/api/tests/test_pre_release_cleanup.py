from pathlib import Path

import pytest
from sqlalchemy import select

from app.client_models import ClientActivity, ClientDepositTransaction, Company, Representative
from app.cli.pre_release_cleanup import build_cleanup_plan, clear_application_storage, execute_cleanup
from app.crm_models import LanguageCatalog, ServiceType, Tariff
from app.db import SessionLocal
from app.import_models import ImportBatch
from app.models import Application, RecoveryCode, Role, SecurityAuditEvent, User, UserInvitation, UserSession, new_uuid
from app.operations_models import Executor, Order, OrderCounter, OrderWork
from app.security import hash_password


def _user(email: str, role: Role) -> User:
    return User(
        email=email,
        display_name=email.split("@")[0],
        password_hash=hash_password("Cleanup-Test-123!"),
        role=role.value,
        must_change_password=False,
    )


def test_cleanup_preserves_only_admin_and_reference_catalogs(tmp_path: Path):
    with SessionLocal() as db:
        admin = _user("owner@example.com", Role.ADMIN)
        manager = _user("manager@example.com", Role.MANAGER)
        db.add_all([admin, manager])
        db.flush()

        db.add(RecoveryCode(user_id=admin.id, code_hash="a" * 64))
        db.add(UserSession(user_id=manager.id, token_hash="b" * 64, csrf_hash="c" * 64, auth_stage="AUTHENTICATED", expires_at=admin.created_at, idle_expires_at=admin.created_at, last_seen_at=admin.created_at))
        db.add(UserInvitation(email="future@example.com", role=Role.MANAGER.value, token_hash="d" * 64, created_by_user_id=admin.id, expires_at=admin.created_at))
        db.add(SecurityAuditEvent(actor_user_id=admin.id, action="test", details={}))

        service = ServiceType(code="test-service", name="Test service", billing_mode="CUSTOM")
        language = LanguageCatalog(name="Test language")
        tariff = Tariff(service_code="test-service", source_language="", target_language="", direction="ANY", unit="CUSTOM", amount=1)
        db.add_all([service, language, tariff])

        company = Company(name="Test client", manager_id=manager.id)
        executor = Executor(name="Test executor")
        db.add_all([company, executor])
        db.flush()
        db.add(Representative(company_id=company.id, name="Contact"))
        db.add(ClientActivity(company_id=company.id, actor_user_id=manager.id, action="created"))
        application = Application(sequence_number=1, number="A-1", name="Lead", contact_method="email", contact="lead@example.com", requested_service="translation", message="test", responsible_user_id=manager.id)
        db.add(application)
        db.flush()
        order = Order(number="26-0001", title="Test order", client_id=company.id, manager_id=manager.id, application_id=application.id)
        db.add(order)
        db.flush()
        db.add(OrderWork(order_id=order.id, work_type="translation"))
        db.add(ClientDepositTransaction(company_id=company.id, order_id=order.id, actor_user_id=manager.id, kind="TOP_UP", amount=100, balance_after=100))
        db.add(OrderCounter(id=2026, value=1))
        db.add(ImportBatch(owner_id=manager.id, entity="clients", filename="test.xlsx", rows=[], errors=[], expires_at=admin.created_at))
        db.commit()

        kept, plan = build_cleanup_plan(db)
        assert kept.email == "owner@example.com"
        assert plan["users_to_delete"] == 1

        kept, _ = execute_cleanup(db)
        assert kept.email == "owner@example.com"
        assert list(db.scalars(select(User))) == [kept]
        assert db.scalar(select(RecoveryCode).where(RecoveryCode.user_id == kept.id)) is not None
        assert db.scalar(select(ServiceType).where(ServiceType.code == "test-service")) is not None
        assert db.scalar(select(LanguageCatalog).where(LanguageCatalog.name == "Test language")) is not None
        assert db.scalar(select(Tariff).where(Tariff.service_code == "test-service")) is not None
        assert db.scalar(select(Company)) is None
        assert db.scalar(select(Executor)) is None
        assert db.scalar(select(Application)) is None
        assert db.scalar(select(Order)) is None
        assert db.scalar(select(UserInvitation)) is None
        assert db.scalar(select(UserSession)) is None
        assert db.scalar(select(SecurityAuditEvent)) is None

    (tmp_path / "orphan.txt").write_text("test")
    nested = tmp_path / "app-1"
    nested.mkdir()
    (nested / "file.pdf").write_bytes(b"test")
    assert clear_application_storage(str(tmp_path)) == 2
    assert list(tmp_path.iterdir()) == []


def test_cleanup_requires_explicit_admin_when_multiple_admins():
    with SessionLocal() as db:
        db.add_all([_user("one@example.com", Role.ADMIN), _user("two@example.com", Role.ADMIN)])
        db.commit()
        with pytest.raises(RuntimeError, match="--keep-admin-email"):
            build_cleanup_plan(db)
        kept, _ = build_cleanup_plan(db, "two@example.com")
        assert kept.email == "two@example.com"
