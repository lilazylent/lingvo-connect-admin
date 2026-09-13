"""Seed synthetic browser fixtures only into the explicitly named disposable QA database."""

from sqlalchemy import select

from app.config import get_settings
from app.db import SessionLocal
from app.models import User, UserSession, utcnow
from app.security import hash_password

settings = get_settings()
if not settings.database_url.endswith("/lingvo_admin_stage2_qa"):
    raise RuntimeError("Refusing to seed a non-QA database")
with SessionLocal() as db:
    user = db.scalar(select(User).where(User.email == "stage2@example.com"))
    if not user:
        db.add(
            User(
                email="stage2@example.com",
                display_name="Проверка этапа 2",
                password_hash=hash_password("QaOnly-StageTwo-123!"),
                role="ADMIN",
                must_change_password=True,
            )
        )
    else:
        user.password_hash = hash_password("QaOnly-StageTwo-123!")
        user.must_change_password = True
        user.two_factor_enabled = False
        user.two_factor_secret_encrypted = None
        for session in db.scalars(select(UserSession).where(UserSession.user_id == user.id)):
            session.revoked_at = utcnow()
    db.commit()
print("Synthetic QA administrator ready")
