import argparse
import getpass

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Role, User
from app.security import generate_temporary_password, hash_password, validate_password


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the first local ADMIN account safely.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="Владелец проекта")
    parser.add_argument("--generate-password", action="store_true")
    args = parser.parse_args()

    email = args.email.strip().lower()
    password = generate_temporary_password() if args.generate_password else getpass.getpass(
        "Temporary password (not echoed): "
    )
    validate_password(password)

    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == email)):
            raise SystemExit("A user with this email already exists.")
        user = User(
            email=email,
            display_name=args.name.strip(),
            password_hash=hash_password(password),
            role=Role.ADMIN.value,
            must_change_password=True,
        )
        db.add(user)
        db.commit()

    print("ADMIN account created. Password change and 2FA enrollment are mandatory.")
    if args.generate_password:
        print(f"Temporary password (shown once): {password}")


if __name__ == "__main__":
    main()
