from __future__ import annotations

import hashlib
import io
import json
import math
import re
import uuid
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Annotated, Literal

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.dependencies import (
    SessionContext,
    require_authenticated,
    require_authenticated_write,
)
from app.models import (
    Application,
    ApplicationActivity,
    ApplicationComment,
    ApplicationFile,
    ApplicationSource,
    ApplicationStatus,
    Role,
    User,
    application_number_sequence,
)
from app.rate_limit import InMemoryRateLimiter
from app.schemas import (
    ApplicationActivityView,
    ApplicationCommentCreate,
    ApplicationCommentUpdate,
    ApplicationCommentView,
    ApplicationCreatedView,
    ApplicationDetailView,
    ApplicationFileView,
    ApplicationListView,
    ApplicationStatusRequest,
    ApplicationUpdateRequest,
    ApplicationView,
    DashboardSummaryView,
    ManualApplicationCreate,
    PublicApplicationCreate,
    UserSummaryView,
)
from app.storage import UnsafeFileError, storage_from_settings

settings = get_settings()
public_rate_limiter = InMemoryRateLimiter(
    settings.public_rate_limit_requests,
    settings.public_rate_limit_window_seconds,
)
public_router = APIRouter(prefix="/api/public", tags=["public applications"])
admin_router = APIRouter(prefix="/api/admin/applications", tags=["applications"])
dashboard_router = APIRouter(prefix="/api/admin/dashboard", tags=["dashboard"])


def _client_key(request: Request) -> str:
    host = request.client.host if request.client else "unknown"
    return hashlib.sha256(host.encode()).hexdigest()


def _fingerprint(
    payload: PublicApplicationCreate,
    attachment_sha256: str | None = None,
) -> str:
    canonical = json.dumps(
        payload.model_dump(
            mode="json",
            exclude={"website", "form_started_at"},
        ),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(f"{canonical}:{attachment_sha256 or ''}".encode()).hexdigest()


def _next_application_number(db: Session) -> tuple[int, str]:
    if db.get_bind().dialect.name == "postgresql":
        sequence_number = int(db.scalar(select(application_number_sequence.next_value())))
    else:
        sequence_number = int(db.scalar(select(func.max(Application.sequence_number))) or 0) + 1
    return sequence_number, f"LC-A-{sequence_number:06d}"


def _contact_parts(method: str, contact: str) -> tuple[str | None, str | None]:
    if not contact:
        return None, None
    if method == "email":
        return contact.lower(), None
    if method == "phone":
        digits = re.sub(r"\D", "", contact)
        return None, f"+{digits}" if digits else contact
    return None, None


def _record_activity(
    db: Session,
    application_id: str,
    event_type: str,
    actor_user_id: str | None,
    event_data: dict | None = None,
) -> None:
    db.add(
        ApplicationActivity(
            application_id=application_id,
            event_type=event_type,
            actor_user_id=actor_user_id,
            event_data=event_data or {},
        )
    )


def _user_summary(user: User | None) -> UserSummaryView | None:
    if not user:
        return None
    return UserSummaryView(id=user.id, display_name=user.display_name, email=user.email)


def _application_view(db: Session, application: Application) -> ApplicationView:
    manager = (
        db.get(User, application.responsible_user_id) if application.responsible_user_id else None
    )
    return ApplicationView(
        id=application.id,
        number=application.number,
        name=application.name,
        contact_method=application.contact_method,
        contact=application.contact,
        email=application.email,
        phone=application.phone,
        company=application.company,
        requested_service=application.requested_service,
        source_language=application.source_language,
        target_language=application.target_language,
        message=application.message,
        desired_date=application.desired_date,
        status_code=application.status_code,
        responsible_manager=_user_summary(manager),
        internal_summary=application.internal_summary,
        source=application.source,
        source_identifier=application.source_identifier,
        submitted_at=application.submitted_at,
        created_at=application.created_at,
        updated_at=application.updated_at,
        version=application.version,
    )


def _comment_view(db: Session, comment: ApplicationComment) -> ApplicationCommentView:
    author = db.get(User, comment.author_user_id)
    if not author:
        raise HTTPException(status_code=500, detail="Автор комментария недоступен")
    return ApplicationCommentView(
        id=comment.id,
        body=comment.body,
        author=_user_summary(author),
        created_at=comment.created_at,
        edited_at=comment.edited_at,
    )


def _file_view(db: Session, item: ApplicationFile) -> ApplicationFileView:
    uploader = db.get(User, item.uploaded_by) if item.uploaded_by else None
    return ApplicationFileView(
        id=item.id,
        original_name=item.original_name,
        mime_type=item.mime_type,
        size_bytes=item.size_bytes,
        uploader=_user_summary(uploader),
        uploaded_at=item.uploaded_at,
    )


def _activity_view(db: Session, item: ApplicationActivity) -> ApplicationActivityView:
    actor = db.get(User, item.actor_user_id) if item.actor_user_id else None
    return ApplicationActivityView(
        id=item.id,
        event_type=item.event_type,
        event_data=item.event_data,
        actor=_user_summary(actor),
        created_at=item.created_at,
    )


def _detail_view(db: Session, application: Application) -> ApplicationDetailView:
    comments = list(
        db.scalars(
            select(ApplicationComment)
            .where(ApplicationComment.application_id == application.id)
            .order_by(ApplicationComment.created_at.desc())
        ).all()
    )
    files = list(
        db.scalars(
            select(ApplicationFile)
            .where(ApplicationFile.application_id == application.id)
            .order_by(ApplicationFile.uploaded_at.desc())
        ).all()
    )
    activity = list(
        db.scalars(
            select(ApplicationActivity)
            .where(ApplicationActivity.application_id == application.id)
            .order_by(ApplicationActivity.created_at.desc())
        ).all()
    )
    base = _application_view(db, application).model_dump()
    return ApplicationDetailView(
        **base,
        comments=[_comment_view(db, item) for item in comments],
        files=[_file_view(db, item) for item in files],
        activity=[_activity_view(db, item) for item in activity],
    )


def _active_manager(db: Session, user_id: str | None) -> User | None:
    if not user_id:
        return None
    user = db.get(User, user_id)
    if not user or not user.is_active or user.role not in {Role.ADMIN.value, Role.MANAGER.value}:
        raise HTTPException(status_code=422, detail="Ответственный менеджер недоступен")
    return user


def _looks_like_spam(payload: PublicApplicationCreate, now: datetime) -> bool:
    if payload.website:
        return True
    if not payload.form_started_at:
        return False
    started = payload.form_started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=UTC)
    return (now - started.astimezone(UTC)).total_seconds() < settings.public_min_submit_seconds


def _persist_public_application(
    payload: PublicApplicationCreate,
    response: Response,
    db: Session,
    idempotency_key: str,
    attachment: tuple[str, bytes] | None = None,
) -> ApplicationCreatedView:
    now = datetime.now(UTC)
    if _looks_like_spam(payload, now):
        return ApplicationCreatedView(
            id=str(uuid.uuid4()),
            number="LC-A-RECEIVED",
            created_at=now,
        )

    attachment_sha256 = hashlib.sha256(attachment[1]).hexdigest() if attachment else None
    fingerprint = _fingerprint(payload, attachment_sha256)
    existing = db.scalar(select(Application).where(Application.idempotency_key == idempotency_key))
    if existing:
        if existing.fingerprint != fingerprint:
            raise HTTPException(status_code=409, detail="Повторный запрос не может быть обработан")
        response.status_code = 200
        return ApplicationCreatedView(
            id=existing.id,
            number=existing.number,
            created_at=existing.created_at,
        )

    sequence_number, number = _next_application_number(db)
    email, phone = _contact_parts(payload.contact_method, payload.contact)
    application = Application(
        sequence_number=sequence_number,
        number=number,
        name=payload.name,
        contact_method=payload.contact_method,
        contact=payload.contact,
        email=email,
        phone=phone,
        requested_service=payload.requested_service,
        message=payload.message,
        source=ApplicationSource.WEBSITE.value,
        source_identifier=payload.source_identifier or "request_form",
        consent_accepted=payload.consent_accepted,
        consent_version=payload.consent_version,
        consent_at=now,
        utm_source=payload.utm_source,
        utm_medium=payload.utm_medium,
        utm_campaign=payload.utm_campaign,
        utm_content=payload.utm_content,
        utm_term=payload.utm_term,
        idempotency_key=idempotency_key,
        fingerprint=fingerprint,
        submitted_at=now,
    )
    db.add(application)
    db.flush()
    _record_activity(
        db,
        application.id,
        "application_created",
        None,
        {"source": "website", "service": application.requested_service},
    )

    storage = None
    stored = None
    if attachment:
        storage = storage_from_settings(
            settings.application_storage_path,
            settings.application_file_max_bytes,
        )
        try:
            stored = storage.save(application.id, attachment[0], io.BytesIO(attachment[1]))
        except UnsafeFileError as error:
            db.rollback()
            raise HTTPException(status_code=422, detail=str(error)) from error
        file_item = ApplicationFile(
            application_id=application.id,
            storage_key=stored.storage_key,
            original_name=stored.original_name,
            mime_type=stored.mime_type,
            size_bytes=stored.size_bytes,
            sha256=stored.sha256,
            uploaded_by=None,
        )
        try:
            db.add(file_item)
            db.flush()
            _record_activity(
                db,
                application.id,
                "public_file_attached",
                None,
                {
                    "file_id": file_item.id,
                    "size_bytes": file_item.size_bytes,
                    "type": file_item.mime_type,
                },
            )
        except Exception:
            db.rollback()
            storage.delete(stored.storage_key)
            raise

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if storage and stored:
            storage.delete(stored.storage_key)
        existing = db.scalar(
            select(Application).where(Application.idempotency_key == idempotency_key)
        )
        if existing and existing.fingerprint == fingerprint:
            response.status_code = 200
            return ApplicationCreatedView(
                id=existing.id,
                number=existing.number,
                created_at=existing.created_at,
            )
        raise HTTPException(
            status_code=409, detail="Повторный запрос не может быть обработан"
        ) from None
    except Exception:
        db.rollback()
        if storage and stored:
            storage.delete(stored.storage_key)
        raise
    db.refresh(application)
    return ApplicationCreatedView(
        id=application.id,
        number=application.number,
        created_at=application.created_at,
    )


@public_router.post("/leads", response_model=ApplicationCreatedView, status_code=201)
def create_public_application(
    payload: PublicApplicationCreate,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=16, max_length=128)],
) -> ApplicationCreatedView:
    if not public_rate_limiter.allow(_client_key(request)):
        raise HTTPException(status_code=429, detail="Слишком много запросов. Повторите позже.")
    return _persist_public_application(payload, response, db, idempotency_key)


@public_router.post(
    "/leads/with-attachment",
    response_model=ApplicationCreatedView,
    status_code=201,
)
async def create_public_application_with_attachment(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=16, max_length=128)],
    payload: Annotated[str, Form(max_length=65536)],
    upload: Annotated[UploadFile, File()],
) -> ApplicationCreatedView:
    if not public_rate_limiter.allow(_client_key(request)):
        raise HTTPException(status_code=429, detail="Слишком много запросов. Повторите позже.")
    try:
        parsed = PublicApplicationCreate.model_validate_json(payload)
    except ValidationError as error:
        raise HTTPException(status_code=422, detail="Проверьте данные формы") from error
    content = await upload.read(settings.application_file_max_bytes + 1)
    if len(content) > settings.application_file_max_bytes:
        raise HTTPException(status_code=413, detail="Файл превышает допустимый размер 15 МБ")
    return _persist_public_application(
        parsed,
        response,
        db,
        idempotency_key,
        (upload.filename or "file", content),
    )


@admin_router.get("/managers", response_model=list[UserSummaryView])
def list_managers(
    _: Annotated[SessionContext, Depends(require_authenticated)],
    db: Annotated[Session, Depends(get_db)],
) -> list[UserSummaryView]:
    users = list(
        db.scalars(
            select(User)
            .where(User.is_active.is_(True), User.role.in_([Role.ADMIN.value, Role.MANAGER.value]))
            .order_by(User.display_name)
        ).all()
    )
    return [_user_summary(user) for user in users]


@admin_router.get("", response_model=ApplicationListView)
def list_applications(
    _: Annotated[SessionContext, Depends(require_authenticated)],
    db: Annotated[Session, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=10, le=100)] = 25,
    search: Annotated[str | None, Query(max_length=200)] = None,
    status_code: ApplicationStatus | None = None,
    manager_id: str | None = None,
    source: ApplicationSource | None = None,
    service: str | None = None,
    language: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    deadline_from: date | None = None,
    deadline_to: date | None = None,
    sort: Literal[
        "submitted_at",
        "updated_at",
        "number",
        "name",
        "status",
        "desired_date",
    ] = "submitted_at",
    order: Literal["asc", "desc"] = "desc",
) -> ApplicationListView:
    conditions = []
    if search:
        raw_term = f"%{search.strip()}%"
        term = raw_term.lower()
        conditions.append(
            or_(
                Application.number.like(raw_term),
                Application.name.like(raw_term),
                Application.contact.like(raw_term),
                Application.company.like(raw_term),
                func.lower(Application.number).like(term),
                func.lower(Application.name).like(term),
                func.lower(Application.contact).like(term),
                func.lower(func.coalesce(Application.email, "")).like(term),
                func.lower(func.coalesce(Application.phone, "")).like(term),
                func.lower(func.coalesce(Application.company, "")).like(term),
            )
        )
    if status_code:
        conditions.append(Application.status_code == status_code.value)
    if manager_id == "unassigned":
        conditions.append(Application.responsible_user_id.is_(None))
    elif manager_id:
        conditions.append(Application.responsible_user_id == manager_id)
    if source:
        conditions.append(Application.source == source.value)
    if service:
        conditions.append(Application.requested_service == service)
    if language:
        normalized = language.strip()
        terms = {f"%{normalized}%", f"%{normalized.lower()}%", f"%{normalized.capitalize()}%"}
        conditions.append(
            or_(
                *(
                    column.like(term)
                    for term in terms
                    for column in (
                        func.coalesce(Application.source_language, ""),
                        func.coalesce(Application.target_language, ""),
                    )
                ),
            )
        )
    if date_from:
        conditions.append(func.date(Application.submitted_at) >= date_from)
    if date_to:
        conditions.append(func.date(Application.submitted_at) <= date_to)
    if deadline_from:
        conditions.append(Application.desired_date >= deadline_from)
    if deadline_to:
        conditions.append(Application.desired_date <= deadline_to)

    query = select(Application).where(*conditions)
    count_query = select(func.count(Application.id)).where(*conditions)
    sort_map = {
        "submitted_at": Application.submitted_at,
        "updated_at": Application.updated_at,
        "number": Application.sequence_number,
        "name": Application.name,
        "status": Application.status_code,
        "desired_date": Application.desired_date,
    }
    sort_column = sort_map[sort]
    query = query.order_by(sort_column.asc() if order == "asc" else sort_column.desc())
    total = int(db.scalar(count_query) or 0)
    items = list(db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all())
    return ApplicationListView(
        items=[_application_view(db, item) for item in items],
        page=page,
        page_size=page_size,
        total=total,
        pages=max(1, math.ceil(total / page_size)),
    )


@admin_router.post("", response_model=ApplicationDetailView, status_code=201)
def create_manual_application(
    payload: ManualApplicationCreate,
    context: Annotated[SessionContext, Depends(require_authenticated_write)],
    db: Annotated[Session, Depends(get_db)],
) -> ApplicationDetailView:
    manager = _active_manager(db, payload.responsible_user_id)
    sequence_number, number = _next_application_number(db)
    email, phone = _contact_parts(payload.contact_method, payload.contact)
    now = datetime.now(UTC)
    application = Application(
        sequence_number=sequence_number,
        number=number,
        name=payload.name,
        contact_method=payload.contact_method,
        contact=payload.contact,
        email=email,
        phone=phone,
        company=payload.company,
        requested_service=payload.requested_service,
        source_language=payload.source_language,
        target_language=payload.target_language,
        message=payload.message,
        desired_date=payload.desired_date,
        responsible_user_id=manager.id if manager else None,
        source=ApplicationSource.MANUAL.value,
        source_identifier="admin_manual",
        submitted_at=now,
    )
    db.add(application)
    db.flush()
    _record_activity(
        db,
        application.id,
        "application_created",
        context.user.id,
        {"source": "manual", "service": application.requested_service},
    )
    if manager:
        _record_activity(
            db,
            application.id,
            "manager_assigned",
            context.user.id,
            {"manager_id": manager.id},
        )
    db.commit()
    db.refresh(application)
    return _detail_view(db, application)


@admin_router.get("/{application_id}", response_model=ApplicationDetailView)
def get_application(
    application_id: str,
    _: Annotated[SessionContext, Depends(require_authenticated)],
    db: Annotated[Session, Depends(get_db)],
) -> ApplicationDetailView:
    application = db.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    return _detail_view(db, application)


@admin_router.patch("/{application_id}", response_model=ApplicationDetailView)
def update_application(
    application_id: str,
    payload: ApplicationUpdateRequest,
    context: Annotated[SessionContext, Depends(require_authenticated_write)],
    db: Annotated[Session, Depends(get_db)],
) -> ApplicationDetailView:
    application = db.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if application.version != payload.version:
        raise HTTPException(status_code=409, detail="Заявка уже изменена. Обновите страницу.")

    changes: dict[str, dict] = {}
    fields = {
        "name",
        "contact_method",
        "contact",
        "requested_service",
        "message",
        "company",
        "source_language",
        "target_language",
        "desired_date",
        "internal_summary",
        "responsible_user_id",
    }
    for field in fields & payload.model_fields_set:
        value = getattr(payload, field)
        if field == "responsible_user_id":
            _active_manager(db, value)
        old = getattr(application, field)
        if old != value:
            setattr(application, field, value)
            changes[field] = {
                "before": str(old) if old is not None else None,
                "after": str(value) if value is not None else None,
            }
    if {"contact_method", "contact"} & set(changes):
        email, phone = _contact_parts(application.contact_method, application.contact)
        application.email = email
        application.phone = phone
    if changes:
        application.version += 1
        if "responsible_user_id" in changes:
            _record_activity(
                db,
                application.id,
                "manager_changed"
                if changes["responsible_user_id"]["before"]
                else "manager_assigned",
                context.user.id,
                changes["responsible_user_id"],
            )
        other_fields = sorted(set(changes) - {"responsible_user_id"})
        if other_fields:
            _record_activity(
                db,
                application.id,
                "application_updated",
                context.user.id,
                {"fields": other_fields},
            )
        db.commit()
        db.refresh(application)
    return _detail_view(db, application)


@admin_router.post("/{application_id}/status", response_model=ApplicationDetailView)
def change_application_status(
    application_id: str,
    payload: ApplicationStatusRequest,
    context: Annotated[SessionContext, Depends(require_authenticated_write)],
    db: Annotated[Session, Depends(get_db)],
) -> ApplicationDetailView:
    application = db.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    old = application.status_code
    if old != payload.status_code.value:
        application.status_code = payload.status_code.value
        application.version += 1
        _record_activity(
            db,
            application.id,
            "status_changed",
            context.user.id,
            {"before": old, "after": payload.status_code.value},
        )
        db.commit()
        db.refresh(application)
    return _detail_view(db, application)


@admin_router.post(
    "/{application_id}/comments", response_model=ApplicationCommentView, status_code=201
)
def create_comment(
    application_id: str,
    payload: ApplicationCommentCreate,
    context: Annotated[SessionContext, Depends(require_authenticated_write)],
    db: Annotated[Session, Depends(get_db)],
) -> ApplicationCommentView:
    if not db.get(Application, application_id):
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    comment = ApplicationComment(
        application_id=application_id,
        author_user_id=context.user.id,
        body=payload.body.strip(),
    )
    db.add(comment)
    db.flush()
    _record_activity(db, application_id, "comment_created", context.user.id)
    db.commit()
    db.refresh(comment)
    return _comment_view(db, comment)


@admin_router.patch(
    "/{application_id}/comments/{comment_id}", response_model=ApplicationCommentView
)
def update_comment(
    application_id: str,
    comment_id: str,
    payload: ApplicationCommentUpdate,
    context: Annotated[SessionContext, Depends(require_authenticated_write)],
    db: Annotated[Session, Depends(get_db)],
) -> ApplicationCommentView:
    comment = db.get(ApplicationComment, comment_id)
    if not comment or comment.application_id != application_id:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    if comment.author_user_id != context.user.id and context.user.role != Role.ADMIN.value:
        raise HTTPException(
            status_code=403, detail="Можно редактировать только собственный комментарий"
        )
    comment.body = payload.body.strip()
    comment.edited_at = datetime.now(UTC)
    _record_activity(db, application_id, "comment_edited", context.user.id)
    db.commit()
    db.refresh(comment)
    return _comment_view(db, comment)


@admin_router.post("/{application_id}/files", response_model=ApplicationFileView, status_code=201)
def upload_application_file(
    application_id: str,
    context: Annotated[SessionContext, Depends(require_authenticated_write)],
    db: Annotated[Session, Depends(get_db)],
    settings_value: Annotated[Settings, Depends(get_settings)],
    upload: Annotated[UploadFile, File()],
) -> ApplicationFileView:
    if not db.get(Application, application_id):
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    storage = storage_from_settings(
        settings_value.application_storage_path,
        settings_value.application_file_max_bytes,
    )
    try:
        stored = storage.save(application_id, upload.filename or "file", upload.file)
    except UnsafeFileError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    item = ApplicationFile(
        application_id=application_id,
        storage_key=stored.storage_key,
        original_name=stored.original_name,
        mime_type=stored.mime_type,
        size_bytes=stored.size_bytes,
        sha256=stored.sha256,
        uploaded_by=context.user.id,
    )
    db.add(item)
    db.flush()
    _record_activity(
        db,
        application_id,
        "file_uploaded",
        context.user.id,
        {"file_id": item.id, "size_bytes": item.size_bytes, "type": item.mime_type},
    )
    db.commit()
    db.refresh(item)
    return _file_view(db, item)


@admin_router.get("/{application_id}/files/{file_id}/download")
def download_application_file(
    application_id: str,
    file_id: str,
    _: Annotated[SessionContext, Depends(require_authenticated)],
    db: Annotated[Session, Depends(get_db)],
    settings_value: Annotated[Settings, Depends(get_settings)],
) -> FileResponse:
    item = db.get(ApplicationFile, file_id)
    if not item or item.application_id != application_id:
        raise HTTPException(status_code=404, detail="Файл не найден")
    storage = storage_from_settings(
        settings_value.application_storage_path,
        settings_value.application_file_max_bytes,
    )
    try:
        path = storage.resolve(item.storage_key)
    except UnsafeFileError as error:
        raise HTTPException(status_code=404, detail="Файл не найден") from error
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Файл не найден")
    return FileResponse(
        path,
        media_type=item.mime_type,
        filename=Path(item.original_name).name,
    )


@admin_router.get("/{application_id}/files/{file_id}/preview")
def preview_application_file(
    application_id: str,
    file_id: str,
    _: Annotated[SessionContext, Depends(require_authenticated)],
    db: Annotated[Session, Depends(get_db)],
    settings_value: Annotated[Settings, Depends(get_settings)],
) -> FileResponse:
    item = db.get(ApplicationFile, file_id)
    if not item or item.application_id != application_id:
        raise HTTPException(status_code=404, detail="Файл не найден")
    mime_type = (item.mime_type or "").lower()
    if not (mime_type == "application/pdf" or mime_type.startswith("image/") or mime_type.startswith("text/")):
        raise HTTPException(status_code=415, detail="Предпросмотр этого формата не поддерживается")
    storage = storage_from_settings(
        settings_value.application_storage_path,
        settings_value.application_file_max_bytes,
    )
    try:
        path = storage.resolve(item.storage_key)
    except UnsafeFileError as error:
        raise HTTPException(status_code=404, detail="Файл не найден") from error
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Файл не найден")
    return FileResponse(
        path,
        media_type=item.mime_type,
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@admin_router.get("/{application_id}/activity", response_model=list[ApplicationActivityView])
def get_activity(
    application_id: str,
    _: Annotated[SessionContext, Depends(require_authenticated)],
    db: Annotated[Session, Depends(get_db)],
) -> list[ApplicationActivityView]:
    if not db.get(Application, application_id):
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    items = list(
        db.scalars(
            select(ApplicationActivity)
            .where(ApplicationActivity.application_id == application_id)
            .order_by(ApplicationActivity.created_at.desc())
        ).all()
    )
    return [_activity_view(db, item) for item in items]


@dashboard_router.get("/summary", response_model=DashboardSummaryView)
def dashboard_summary(
    _: Annotated[SessionContext, Depends(require_authenticated)],
    db: Annotated[Session, Depends(get_db)],
) -> DashboardSummaryView:
    def count(*conditions) -> int:
        return int(db.scalar(select(func.count(Application.id)).where(*conditions)) or 0)

    recent = list(
        db.scalars(select(Application).order_by(Application.submitted_at.desc()).limit(5)).all()
    )
    return DashboardSummaryView(
        new=count(Application.status_code == ApplicationStatus.NEW.value),
        in_progress=count(Application.status_code == ApplicationStatus.IN_PROGRESS.value),
        unassigned=count(Application.responsible_user_id.is_(None)),
        total=count(),
        recent=[_application_view(db, item) for item in recent],
    )
