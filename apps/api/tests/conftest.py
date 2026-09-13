import os
import tempfile
from pathlib import Path

from cryptography.fernet import Fernet

TEST_DB = Path(__file__).parent / "test.db"
if TEST_DB.exists():
    TEST_DB.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["SESSION_SECRET"] = "test-session-secret-that-is-long-enough-123"
os.environ["TOTP_ENCRYPTION_KEY"] = Fernet.generate_key().decode()
os.environ["ADMIN_WEB_ORIGIN"] = "http://testserver"
os.environ["APPLICATION_STORAGE_PATH"] = tempfile.mkdtemp(prefix="lingvo-admin-tests-")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Role, User  # noqa: E402
from app.security import hash_password  # noqa: E402


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def create_user():
    def factory(
        email: str,
        password: str = "TemporaryPass123!",
        role: Role = Role.ADMIN,
        must_change_password: bool = True,
        two_factor_enabled: bool = False,
    ) -> User:
        with SessionLocal() as db:
            user = User(
                email=email,
                display_name=email.split("@")[0].title(),
                password_hash=hash_password(password),
                role=role.value,
                must_change_password=must_change_password,
                two_factor_enabled=two_factor_enabled,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            db.expunge(user)
            return user

    return factory


def csrf_headers(client: TestClient) -> dict[str, str]:
    return {"x-csrf-token": client.cookies.get("lc_csrf")}
