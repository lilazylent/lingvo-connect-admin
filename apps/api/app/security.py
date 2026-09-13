import base64
import hashlib
import hmac
import io
import secrets
import string
from datetime import UTC, datetime, timedelta

import pyotp
import qrcode
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from cryptography.fernet import Fernet

from app.config import Settings
from app.models import AuthStage, User, UserSession

password_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def validate_password(password: str) -> None:
    if len(password) < 10:
        raise ValueError("Пароль должен содержать не менее 10 символов")


def token_hash(value: str, secret: str = "") -> str:
    return hmac.new(secret.encode(), value.encode(), hashlib.sha256).hexdigest()


def generate_temporary_password() -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    while True:
        value = "".join(secrets.choice(alphabet) for _ in range(20))
        try:
            validate_password(value)
            return value
        except ValueError:
            continue


def next_auth_stage(user: User) -> AuthStage:
    if user.must_change_password:
        return AuthStage.CHANGE_PASSWORD
    if not user.two_factor_enabled:
        return AuthStage.TWO_FACTOR_SETUP
    return AuthStage.TWO_FACTOR_VERIFY


def create_session_values(user: User, settings: Settings) -> tuple[UserSession, str, str]:
    raw_token = secrets.token_urlsafe(48)
    csrf_token = secrets.token_urlsafe(32)
    now = datetime.now(UTC)
    session = UserSession(
        user_id=user.id,
        token_hash=token_hash(raw_token, settings.session_secret),
        csrf_hash=token_hash(csrf_token, settings.session_secret),
        auth_stage=next_auth_stage(user).value,
        expires_at=now + timedelta(hours=settings.session_hours),
        idle_expires_at=now + timedelta(minutes=settings.session_idle_minutes),
        last_seen_at=now,
    )
    return session, raw_token, csrf_token


def fernet(settings: Settings) -> Fernet:
    return Fernet(settings.totp_encryption_key.encode())


def encrypt_totp_secret(secret: str, settings: Settings) -> str:
    return fernet(settings).encrypt(secret.encode()).decode()


def decrypt_totp_secret(encrypted: str, settings: Settings) -> str:
    return fernet(settings).decrypt(encrypted.encode()).decode()


def totp_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="Lingvo Connect Admin")


def qr_data_uri(uri: str) -> str:
    image = qrcode.make(uri)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()


def verify_totp(secret: str, code: str) -> bool:
    # Allow a small amount of device/server clock drift without weakening the
    # one-time nature of the code. Two 30-second intervals cover normal sync
    # jitter while keeping the acceptance window bounded to five timecodes.
    return bool(pyotp.TOTP(secret).verify(code.strip(), valid_window=2))


def generate_recovery_codes(count: int = 10) -> list[str]:
    return [f"{secrets.token_hex(4).upper()}-{secrets.token_hex(4).upper()}" for _ in range(count)]
