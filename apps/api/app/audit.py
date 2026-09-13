import hashlib

from fastapi import Request
from sqlalchemy.orm import Session

from app.models import SecurityAuditEvent


def request_ip_hash(request: Request) -> str | None:
    if not request.client:
        return None
    return hashlib.sha256(request.client.host.encode()).hexdigest()


def record_event(
    db: Session,
    request: Request,
    action: str,
    *,
    actor_user_id: str | None = None,
    target_user_id: str | None = None,
    outcome: str = "SUCCESS",
    details: dict | None = None,
) -> None:
    db.add(
        SecurityAuditEvent(
            actor_user_id=actor_user_id,
            target_user_id=target_user_id,
            action=action,
            outcome=outcome,
            request_id=getattr(request.state, "request_id", None),
            ip_hash=request_ip_hash(request),
            details=details or {},
        )
    )
