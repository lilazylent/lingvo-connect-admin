"""Destructive pre-release data cleanup for a production-ready empty CRM.

The command preserves exactly one ADMIN account (chosen automatically when there is
only one active ADMIN, or explicitly with --keep-admin-email), keeps reference/catalog
configuration and tariffs, and removes operational/test data plus uploaded files.

It is intentionally opt-in: without --execute it only prints what would be removed.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.client_models import ClientActivity, ClientDepositTransaction, Company, Representative
from app.config import get_settings
from app.crm_models import ClientPayment, ExecutorPayment
from app.db import SessionLocal
from app.import_models import ImportBatch
from app.models import (
    Application,
    ApplicationActivity,
    ApplicationComment,
    ApplicationFile,
    RecoveryCode,
    Role,
    SecurityAuditEvent,
    User,
    UserInvitation,
    UserSession,
)
from app.operations_models import (
    ApplicationClient,
    Executor,
    ExecutorAssignment,
    ExecutorAvailability,
    ExecutorDirection,
    OperationalActivity,
    Order,
    OrderCounter,
    OrderWork,
)
from app.order_files import OrderFile

# Reference/configuration tables deliberately NOT included here:
# service_types, language_catalog, order_status_options, tariffs, pricing_rules,
# alembic_version. Those rows are required by a clean deployed CRM.
CLEANUP_MODELS = [
    ClientDepositTransaction,
    ExecutorPayment,
    ClientPayment,
    OrderFile,
    OperationalActivity,
    ExecutorAssignment,
    OrderWork,
    Order,
    ApplicationClient,
    ClientActivity,
    Representative,
    Company,
    ExecutorAvailability,
    ExecutorDirection,
    Executor,
    ApplicationComment,
    ApplicationFile,
    ApplicationActivity,
    Application,
    ImportBatch,
    OrderCounter,
    UserInvitation,
    SecurityAuditEvent,
    UserSession,
]


def _count(db: Session, model: type) -> int:
    return int(db.scalar(select(func.count()).select_from(model)) or 0)


def _choose_admin(db: Session, keep_admin_email: str | None) -> User:
    query = select(User).where(User.role == Role.ADMIN.value)
    admins = list(db.scalars(query.order_by(User.created_at, User.email)))
    if keep_admin_email:
        email = keep_admin_email.strip().lower()
        chosen = next((item for item in admins if item.email.lower() == email), None)
        if chosen is None:
            raise RuntimeError(f"ADMIN with email {email!r} was not found.")
        return chosen
    active_admins = [item for item in admins if item.is_active]
    if len(active_admins) == 1:
        return active_admins[0]
    if len(admins) == 1:
        return admins[0]
    raise RuntimeError(
        "Expected exactly one ADMIN account. Re-run with --keep-admin-email EMAIL "
        "to choose which administrator must remain."
    )


def build_cleanup_plan(db: Session, keep_admin_email: str | None = None) -> tuple[User, dict[str, int]]:
    admin = _choose_admin(db, keep_admin_email)
    plan = {model.__tablename__: _count(db, model) for model in CLEANUP_MODELS}
    plan["users_to_delete"] = int(
        db.scalar(select(func.count()).select_from(User).where(User.id != admin.id)) or 0
    )
    plan["kept_admin_recovery_codes"] = int(
        db.scalar(select(func.count()).select_from(RecoveryCode).where(RecoveryCode.user_id == admin.id)) or 0
    )
    return admin, plan


def execute_cleanup(db: Session, keep_admin_email: str | None = None) -> tuple[User, dict[str, int]]:
    admin, plan = build_cleanup_plan(db, keep_admin_email)

    # Delete in dependency-safe order. Business data goes first so RESTRICT foreign
    # keys cannot block removal of old manager/test accounts afterwards.
    for model in CLEANUP_MODELS:
        db.execute(delete(model))

    db.execute(delete(User).where(User.id != admin.id))

    # A clean CRM should start numbering from the beginning again.
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("ALTER SEQUENCE application_number_seq RESTART WITH 1"))

    db.commit()
    db.refresh(admin)
    return admin, plan


def clear_application_storage(root: str) -> int:
    storage = Path(root).resolve()
    storage.mkdir(parents=True, exist_ok=True)
    removed = 0
    for child in storage.iterdir():
        if child.is_symlink() or child.is_file():
            child.unlink(missing_ok=True)
            removed += 1
        elif child.is_dir():
            shutil.rmtree(child)
            removed += 1
    return removed


def _print_plan(admin: User, plan: dict[str, int]) -> None:
    print(f"ADMIN to keep: {admin.email} ({admin.id})")
    print("Rows scheduled for cleanup:")
    for table, count in plan.items():
        print(f"  {table}: {count}")
    print("Reference catalogs, tariffs, statuses, schema migrations and the kept ADMIN are preserved.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Remove pre-release/test CRM data while preserving one ADMIN and reference catalogs."
    )
    parser.add_argument(
        "--keep-admin-email",
        help="ADMIN email to preserve. Optional only when the database contains exactly one ADMIN.",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually delete data. Without this flag the command is a dry run.",
    )
    args = parser.parse_args()

    settings = get_settings()
    with SessionLocal() as db:
        admin, plan = build_cleanup_plan(db, args.keep_admin_email)
        _print_plan(admin, plan)
        if not args.execute:
            print("Dry run only. Add --execute after checking the ADMIN shown above.")
            return
        admin, _ = execute_cleanup(db, args.keep_admin_email)

    removed_storage_entries = clear_application_storage(settings.application_storage_path)
    print(f"Cleanup complete. Preserved ADMIN: {admin.email}")
    print(f"Storage entries removed: {removed_storage_entries}")
    print("All sessions were cleared; sign in again with the preserved ADMIN account.")


if __name__ == "__main__":
    main()
