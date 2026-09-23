"""Clients become orders; orders contain independently assigned work."""

from dataclasses import asdict
from datetime import date
from decimal import Decimal
from io import BytesIO, StringIO
from typing import Literal
from xml.sax.saxutils import escape as xml_escape
from zipfile import ZIP_DEFLATED, ZipFile
import csv

from fastapi import APIRouter, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Integer, cast, delete, func, literal, or_, select, union_all, update
from sqlalchemy.exc import IntegrityError

from app.client_models import ClientActivity, Company, Representative
from app.config import get_settings
from app.executor_matching import direct_executor_candidates, preview_executor_candidates
from app.crm_models import LanguageCatalog, ServiceType
from app.models import Application, ApplicationActivity, ApplicationFile, User, utcnow
from app.order_numbering import next_order_number
from app.operations_models import (
    ApplicationClient,
    Executor,
    ExecutorAvailability,
    ExecutorDirection,
    OperationalActivity,
    Order,
    OrderWork,
)
from app.order_files import OrderFile
from app.routers.clients import DB, ArchiveChange, PersonFields, Read, Write, change, view
from app.storage import UnsafeFileError, storage_from_settings

router = APIRouter(prefix="/api/admin", tags=["operations"])




class ExecutorMatchingPreview(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    service_code: str = Field(default="", max_length=64)
    work_type: str = Field(default="written_translation", max_length=64)
    source_language: str = Field(default="", max_length=80)
    target_language: str = Field(default="", max_length=80)
    deadline: date | None = None
    executor_deadline: date | None = None
    order_deadline: date | None = None

class ClientLink(BaseModel):
    client_id: str


@router.get("/applications/{application_id}/client")
def application_client(application_id: str, db: DB, context: Read):
    if not db.get(Application, application_id):
        raise HTTPException(404, "Заявка не найдена")
    link = db.get(ApplicationClient, application_id)
    return {"client_id": link.client_id if link else None}


@router.post("/applications/{application_id}/client")
def set_application_client(application_id: str, payload: ClientLink, db: DB, context: Write):
    application = db.scalar(
        select(Application).where(Application.id == application_id).with_for_update()
    )
    if not application:
        raise HTTPException(404, "Заявка не найдена")
    get_record(db, Company, payload.client_id, active=True)
    order = db.scalar(select(Order).where(Order.application_id == application_id))
    if order and order.client_id != payload.client_id:
        raise HTTPException(409, "Нельзя заменить клиента заявки, из которой уже создан заказ")
    link = db.get(ApplicationClient, application_id)
    if link and link.client_id == payload.client_id:
        return {"client_id": link.client_id}
    if link:
        link.client_id = payload.client_id
    else:
        db.add(ApplicationClient(application_id=application_id, client_id=payload.client_id))
    db.add(
        ApplicationActivity(
            application_id=application_id,
            actor_user_id=context.user.id,
            event_type="client_linked",
            event_data={"client_id": payload.client_id},
        )
    )
    db.add(
        ClientActivity(
            company_id=payload.client_id, actor_user_id=context.user.id, action="application.linked"
        )
    )
    db.commit()
    return {"client_id": payload.client_id}


Status = Literal["NEW", "IN_PROGRESS", "COMPLETED", "CANCELLED"]


class Direction(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    source_language: str = Field(default="", max_length=80)
    target_language: str = Field(default="", max_length=80)
    work_type: str = Field(default="written_translation", min_length=2, max_length=64)


class ExecutorDirectionPayload(Direction):
    # Kept under the legacy DB/API field name for compatibility, but from Phase 06
    # forward work_type is the canonical ServiceType.code used by Order works too.
    default_rate: Decimal = Field(default=Decimal("0"), ge=0)
    rate_unit: str = Field(default="CONDITIONAL_PAGE", max_length=32)


class ExecutorFields(PersonFields):
    telegram: str = Field(default="", max_length=160)
    directions: list[ExecutorDirectionPayload] = Field(default_factory=list, max_length=100)


class ExecutorEdit(ExecutorFields):
    version: int = Field(ge=1)


AvailabilityState = Literal["FREE", "BUSY", "UNAVAILABLE", "VACATION"]


class ExecutorAvailabilityPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    state: AvailabilityState
    start_date: date
    end_date: date
    notes: str = Field(default="", max_length=2000)


class ExecutorAvailabilityEdit(ExecutorAvailabilityPayload):
    version: int = Field(ge=1)


class OrderFields(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    title: str = Field(default="", max_length=200)
    client_id: str | None = None
    contact_id: str | None = None
    manager_id: str | None = None
    deadline: date | None = None
    status: Status = "NEW"
    notes: str = Field(default="", max_length=10000)


class OrderCreate(OrderFields):
    application_id: str | None = None


class OrderEdit(OrderFields):
    version: int = Field(ge=1)


class WorkFields(Direction):
    executor_id: str | None = None
    deadline: date | None = None
    status: Status = "NEW"
    price: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    executor_cost: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    notes: str = Field(default="", max_length=5000)


class WorkEdit(WorkFields):
    version: int = Field(ge=1)


def get_record(db, model, record_id, active=False):
    row = db.scalar(select(model).where(model.id == record_id).with_for_update())
    if row is None:
        raise HTTPException(404, "Запись не найдена")
    if active and row.archived:
        raise HTTPException(409, "Запись в архиве. Сначала восстановите её.")
    return row


def record(db, context, action, **links):
    db.add(OperationalActivity(actor_user_id=context.user.id, action=action, **links))


def commit(db):
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Запись уже существует или связанные данные изменены.") from exc


def paginate(db, model, filters, page, page_size, serializer=view):
    total = db.scalar(select(func.count()).select_from(model).where(*filters)) or 0
    rows = db.scalars(
        select(model)
        .where(*filters)
        .order_by(model.created_at.desc(), model.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [serializer(row) for row in rows],
        "total": total,
        "page": page,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


def executor_view(db, row):
    result = view(row)
    directions = db.scalars(
        select(ExecutorDirection)
        .where(ExecutorDirection.executor_id == row.id)
        .order_by(
            ExecutorDirection.work_type,
            ExecutorDirection.source_language,
            ExecutorDirection.target_language,
        )
    ).all()
    service_names = dict(db.execute(select(ServiceType.code, ServiceType.name)).all())
    result["directions"] = []
    for item in directions:
        payload = view(item)
        payload["service_name"] = service_names.get(item.work_type, "")
        payload["canonical_service"] = item.work_type in service_names
        result["directions"].append(payload)
    return result


def _validate_availability_range(
    db, executor_id: str, start_date: date, end_date: date, *, exclude_id: str | None = None
):
    if end_date < start_date:
        raise HTTPException(422, "Дата окончания не может быть раньше даты начала")
    query = select(ExecutorAvailability).where(
        ExecutorAvailability.executor_id == executor_id,
        ExecutorAvailability.archived.is_(False),
        ExecutorAvailability.start_date <= end_date,
        ExecutorAvailability.end_date >= start_date,
    )
    if exclude_id:
        query = query.where(ExecutorAvailability.id != exclude_id)
    overlap = db.scalar(query.limit(1))
    if overlap:
        raise HTTPException(409, "Период пересекается с существующей записью доступности")


def availability_view(row):
    return view(row)


def set_directions(db, executor_id, directions):
    current_codes = set(
        db.scalars(
            select(ExecutorDirection.work_type).where(
                ExecutorDirection.executor_id == executor_id
            )
        ).all()
    )
    service_codes = set(db.scalars(select(ServiceType.code)).all())
    catalog_languages = set(db.scalars(select(LanguageCatalog.name).where(LanguageCatalog.active.is_(True))).all())
    prepared: dict[tuple[str, str, str], ExecutorDirectionPayload] = {}
    for direction in directions:
        code = direction.work_type.strip()
        # Historical rows may contain broad legacy work types. They remain editable
        # without silently remapping them. New capabilities must use the canonical
        # service dictionary shared with Order works.
        if service_codes and code not in service_codes and code not in current_codes:
            raise HTTPException(422, "Выберите услугу исполнителя из справочника CRM")
        pair_languages = {value.strip() for value in (direction.source_language, direction.target_language) if value.strip()}
        missing_languages = sorted(pair_languages - catalog_languages, key=str.casefold)
        if catalog_languages and missing_languages:
            raise HTTPException(422, f"Добавьте язык в справочник CRM: {', '.join(missing_languages)}")
        key = (
            direction.source_language.strip(),
            direction.target_language.strip(),
            code,
        )
        prepared[key] = direction

    db.execute(delete(ExecutorDirection).where(ExecutorDirection.executor_id == executor_id))
    for (source, target, kind), direction in sorted(prepared.items()):
        db.add(
            ExecutorDirection(
                executor_id=executor_id,
                source_language=source,
                target_language=target,
                work_type=kind,
                default_rate=direction.default_rate,
                rate_unit=direction.rate_unit,
            )
        )


@router.get("/executors/{executor_id}/availability")
def executor_availability(executor_id: str, db: DB, context: Read):
    get_record(db, Executor, executor_id)
    rows = db.scalars(
        select(ExecutorAvailability)
        .where(
            ExecutorAvailability.executor_id == executor_id,
            ExecutorAvailability.archived.is_(False),
        )
        .order_by(ExecutorAvailability.start_date, ExecutorAvailability.end_date, ExecutorAvailability.created_at)
    ).all()
    return {"items": [availability_view(row) for row in rows]}


@router.post("/executors/{executor_id}/availability", status_code=201)
def create_executor_availability(
    executor_id: str, payload: ExecutorAvailabilityPayload, db: DB, context: Write
):
    executor = get_record(db, Executor, executor_id, active=True)
    _validate_availability_range(db, executor_id, payload.start_date, payload.end_date)
    row = ExecutorAvailability(
        executor_id=executor.id,
        state=payload.state,
        start_date=payload.start_date,
        end_date=payload.end_date,
        notes=payload.notes,
    )
    db.add(row)
    db.flush()
    record(db, context, "executor.availability.created", executor_id=executor.id)
    commit(db)
    db.refresh(row)
    return availability_view(row)


@router.patch("/executors/{executor_id}/availability/{availability_id}")
def edit_executor_availability(
    executor_id: str, availability_id: str, payload: ExecutorAvailabilityEdit, db: DB, context: Write
):
    executor = get_record(db, Executor, executor_id, active=True)
    row = db.scalar(
        select(ExecutorAvailability).where(
            ExecutorAvailability.id == availability_id,
            ExecutorAvailability.executor_id == executor.id,
            ExecutorAvailability.archived.is_(False),
        ).with_for_update()
    )
    if not row:
        raise HTTPException(404, "Период доступности не найден")
    if row.version != payload.version:
        raise HTTPException(409, "Запись изменилась. Обновите данные и повторите действие.")
    _validate_availability_range(
        db, executor.id, payload.start_date, payload.end_date, exclude_id=row.id
    )
    row.state = payload.state
    row.start_date = payload.start_date
    row.end_date = payload.end_date
    row.notes = payload.notes
    row.version += 1
    row.updated_at = utcnow()
    record(db, context, "executor.availability.updated", executor_id=executor.id)
    commit(db)
    db.refresh(row)
    return availability_view(row)


@router.delete("/executors/{executor_id}/availability/{availability_id}")
def delete_executor_availability(
    executor_id: str, availability_id: str, db: DB, context: Write, version: int = Query(..., ge=1)
):
    executor = get_record(db, Executor, executor_id, active=True)
    row = db.scalar(
        select(ExecutorAvailability).where(
            ExecutorAvailability.id == availability_id,
            ExecutorAvailability.executor_id == executor.id,
            ExecutorAvailability.archived.is_(False),
        ).with_for_update()
    )
    if not row:
        raise HTTPException(404, "Период доступности не найден")
    if row.version != version:
        raise HTTPException(409, "Запись изменилась. Обновите данные и повторите действие.")
    row.archived = True
    row.version += 1
    row.updated_at = utcnow()
    record(db, context, "executor.availability.archived", executor_id=executor.id)
    commit(db)
    return {"id": row.id, "archived": True}


@router.get("/executors")
def executors(
    db: DB,
    context: Read,
    q: str = Query("", max_length=200),
    language: str = Query("", max_length=80),
    work_type: str = "",
    archived: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    filters = [Executor.archived == archived]
    if q:
        filters.append(
            or_(
                Executor.name.icontains(q, autoescape=True),
                Executor.email.icontains(q, autoescape=True),
                Executor.phone.icontains(q, autoescape=True),
                Executor.telegram.icontains(q, autoescape=True),
            )
        )
    if language or work_type:
        directions = select(ExecutorDirection.executor_id)
        if language:
            directions = directions.where(
                or_(
                    ExecutorDirection.source_language.icontains(language, autoescape=True),
                    ExecutorDirection.target_language.icontains(language, autoescape=True),
                )
            )
        if work_type:
            directions = directions.where(ExecutorDirection.work_type == work_type)
        filters.append(Executor.id.in_(directions))
    return paginate(db, Executor, filters, page, page_size, lambda row: executor_view(db, row))


@router.post("/executors", status_code=201)
def create_executor(payload: ExecutorFields, db: DB, context: Write):
    row = Executor(**payload.model_dump(exclude={"directions", "position"}))
    db.add(row)
    db.flush()
    set_directions(db, row.id, payload.directions)
    record(db, context, "executor.created", executor_id=row.id)
    commit(db)
    return executor_view(db, row)


@router.get("/executors/{executor_id}")
def executor_detail(executor_id: str, db: DB, context: Read):
    return executor_view(db, get_record(db, Executor, executor_id))


@router.patch("/executors/{executor_id}")
def edit_executor(executor_id: str, payload: ExecutorEdit, db: DB, context: Write):
    row = get_record(db, Executor, executor_id, active=True)
    change(
        db, row, payload.version, payload.model_dump(exclude={"version", "directions", "position"})
    )
    set_directions(db, row.id, payload.directions)
    record(db, context, "executor.updated", executor_id=row.id)
    commit(db)
    db.refresh(row)
    return executor_view(db, row)


@router.post("/executors/{executor_id}/archive")
def archive_executor(executor_id: str, payload: ArchiveChange, db: DB, context: Write):
    row = get_record(db, Executor, executor_id)
    change(db, row, payload.version, {"archived": payload.archived})
    record(
        db,
        context,
        "executor.archived" if payload.archived else "executor.restored",
        executor_id=row.id,
    )
    commit(db)
    db.refresh(row)
    return executor_view(db, row)


def validate_order(db, payload):
    if payload.client_id:
        get_record(db, Company, payload.client_id, active=True)
    if payload.contact_id:
        contact = get_record(db, Representative, payload.contact_id, active=True)
        if payload.client_id and contact.company_id != payload.client_id:
            raise HTTPException(422, "Контактное лицо не принадлежит выбранному клиенту")
        if not payload.client_id:
            raise HTTPException(422, "Контактное лицо можно выбрать после выбора клиента")
    if payload.manager_id:
        manager = db.get(User, payload.manager_id)
        if not manager or not manager.is_active or manager.role not in {"ADMIN", "MANAGER"}:
            raise HTTPException(422, "Выберите действующего менеджера")


@router.get("/orders")
def orders(
    db: DB,
    context: Read,
    q: str = Query("", max_length=200),
    client_id: str = "",
    application_id: str = "",
    status: str = "",
    archived: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    filters = [Order.archived == archived]
    if q:
        filters.append(
            Order.number.icontains(q, autoescape=True)
        )
    if client_id:
        filters.append(Order.client_id == client_id)
    if application_id:
        filters.append(Order.application_id == application_id)
    if status:
        filters.append(Order.status == status)
    return paginate(db, Order, filters, page, page_size)


@router.post("/orders", status_code=201)
def create_order(payload: OrderCreate, db: DB, context: Write):
    validate_order(db, payload)
    if payload.application_id:
        application = db.scalar(
            select(Application).where(Application.id == payload.application_id).with_for_update()
        )
        if not application:
            raise HTTPException(404, "Исходная заявка не найдена")
        existing = db.scalar(select(Order).where(Order.application_id == application.id))
        if existing:
            raise HTTPException(409, f"Для заявки уже создан заказ {existing.number}")
    number = next_order_number(db, execution_year=payload.deadline.year if payload.deadline else None)
    data = payload.model_dump()
    data["title"] = number
    row = Order(number=number, **data)
    db.add(row)
    db.flush()
    record(db, context, "order.created", order_id=row.id)
    if payload.application_id:
        link = db.get(ApplicationClient, payload.application_id)
        if payload.client_id:
            if link and link.client_id != payload.client_id:
                raise HTTPException(409, "Заявка уже связана с другим клиентом")
            if not link:
                db.add(
                    ApplicationClient(
                        application_id=payload.application_id, client_id=payload.client_id
                    )
                )
        db.add(
            ApplicationActivity(
                application_id=payload.application_id,
                actor_user_id=context.user.id,
                event_type="order_created",
                event_data={"order_id": row.id, "number": row.number},
            )
        )
    commit(db)
    return view(row)


@router.get("/orders/{order_id}")
def order_detail(order_id: str, db: DB, context: Read):
    return view(get_record(db, Order, order_id))


@router.patch("/orders/{order_id}")
def edit_order(order_id: str, payload: OrderEdit, db: DB, context: Write):
    row = get_record(db, Order, order_id, active=True)
    validate_order(db, payload)
    if row.application_id and payload.client_id != row.client_id:
        link = db.get(ApplicationClient, row.application_id)
        if payload.client_id:
            if link:
                link.client_id = payload.client_id
            else:
                db.add(ApplicationClient(application_id=row.application_id, client_id=payload.client_id))
        elif link:
            db.delete(link)
    change(db, row, payload.version, payload.model_dump(exclude={"version"}))
    record(db, context, "order.updated", order_id=row.id)
    commit(db)
    db.refresh(row)
    return view(row)


@router.post("/orders/{order_id}/archive")
def archive_order(order_id: str, payload: ArchiveChange, db: DB, context: Write):
    row = get_record(db, Order, order_id)
    change(db, row, payload.version, {"archived": payload.archived})
    record(db, context, "order.archived" if payload.archived else "order.restored", order_id=row.id)
    commit(db)
    db.refresh(row)
    return view(row)


@router.get("/orders/{order_id}/works")
def works(order_id: str, db: DB, context: Read, page: int = Query(1, ge=1)):
    get_record(db, Order, order_id)
    return paginate(db, OrderWork, [OrderWork.order_id == order_id], page, 50)


@router.post("/orders/executor-candidates/preview")
def preview_work_executor_candidates(payload: ExecutorMatchingPreview, db: DB, context: Read):
    return preview_executor_candidates(
        db,
        service_code=payload.service_code,
        work_type=payload.work_type,
        source_language=payload.source_language,
        target_language=payload.target_language,
        deadline=payload.deadline,
        executor_deadline=payload.executor_deadline,
        order_deadline=payload.order_deadline,
    )


@router.get("/orders/{order_id}/works/{work_id}/executor-candidates")
def work_executor_candidates(order_id: str, work_id: str, db: DB, context: Read):
    order = get_record(db, Order, order_id)
    work = db.scalar(
        select(OrderWork).where(
            OrderWork.id == work_id,
            OrderWork.order_id == order.id,
            OrderWork.archived.is_(False),
        )
    )
    if work is None:
        raise HTTPException(404, "Работа не найдена в этом заказе")
    return direct_executor_candidates(db, order, work)


@router.get("/executors/{executor_id}/works")
def executor_works(executor_id: str, db: DB, context: Read, page: int = Query(1, ge=1)):
    get_record(db, Executor, executor_id)
    return paginate(db, OrderWork, [OrderWork.executor_id == executor_id], page, 20)


@router.post("/orders/{order_id}/works", status_code=201)
def create_work(order_id: str, payload: WorkFields, db: DB, context: Write):
    get_record(db, Order, order_id, active=True)
    if payload.executor_id:
        get_record(db, Executor, payload.executor_id, active=True)
    row = OrderWork(order_id=order_id, **payload.model_dump())
    db.add(row)
    db.flush()
    record(
        db, context, "work.created", order_id=order_id, work_id=row.id, executor_id=row.executor_id
    )
    commit(db)
    return view(row)


@router.patch("/orders/{order_id}/works/{work_id}")
def edit_work(order_id: str, work_id: str, payload: WorkEdit, db: DB, context: Write):
    get_record(db, Order, order_id, active=True)
    row = get_record(db, OrderWork, work_id, active=True)
    if row.order_id != order_id:
        raise HTTPException(404, "Работа не найдена в этом заказе")
    if payload.executor_id and payload.executor_id != row.executor_id:
        get_record(db, Executor, payload.executor_id, active=True)
    change(db, row, payload.version, payload.model_dump(exclude={"version"}))
    record(
        db,
        context,
        "work.updated",
        order_id=order_id,
        work_id=row.id,
        executor_id=payload.executor_id,
    )
    commit(db)
    db.refresh(row)
    return view(row)



FileSource = Literal["all", "order", "application"]
FileKind = Literal["all", "pdf", "document", "spreadsheet", "presentation", "image", "other"]

_FILE_KIND_SUFFIXES: dict[str, tuple[str, ...]] = {
    "pdf": (".pdf",),
    "document": (".doc", ".docx", ".txt", ".rtf", ".odt"),
    "spreadsheet": (".xls", ".xlsx", ".csv", ".ods"),
    "presentation": (".ppt", ".pptx", ".odp"),
    "image": (".png", ".jpg", ".jpeg", ".webp", ".gif", ".tif", ".tiff"),
}


def _file_registry_source():
    order_files = (
        select(
            OrderFile.id.label("id"),
            literal("order").label("source"),
            OrderFile.order_id.label("entity_id"),
            Order.number.label("entity_number"),
            Order.number.label("entity_title"),
            OrderFile.original_name.label("original_name"),
            OrderFile.mime_type.label("mime_type"),
            OrderFile.size_bytes.label("size_bytes"),
            OrderFile.page_count.label("page_count"),
            OrderFile.character_count.label("character_count"),
            OrderFile.word_count.label("word_count"),
            OrderFile.analysis_status.label("analysis_status"),
            OrderFile.analysis_note.label("analysis_note"),
            OrderFile.created_at.label("uploaded_at"),
        )
        .join(Order, Order.id == OrderFile.order_id)
    )
    application_files = (
        select(
            ApplicationFile.id.label("id"),
            literal("application").label("source"),
            ApplicationFile.application_id.label("entity_id"),
            Application.number.label("entity_number"),
            Application.name.label("entity_title"),
            ApplicationFile.original_name.label("original_name"),
            ApplicationFile.mime_type.label("mime_type"),
            ApplicationFile.size_bytes.label("size_bytes"),
            cast(literal(None), Integer).label("page_count"),
            cast(literal(None), Integer).label("character_count"),
            cast(literal(None), Integer).label("word_count"),
            literal("NOT_ANALYZED").label("analysis_status"),
            literal("").label("analysis_note"),
            ApplicationFile.uploaded_at.label("uploaded_at"),
        )
        .join(Application, Application.id == ApplicationFile.application_id)
    )
    return union_all(order_files, application_files).subquery("file_registry")


def _file_kind_clause(source, kind: FileKind):
    if kind == "all":
        return None
    name = func.lower(source.c.original_name)
    groups = [suffix for suffixes in _FILE_KIND_SUFFIXES.values() for suffix in suffixes]
    if kind == "other":
        return ~or_(*(name.like(f"%{suffix}") for suffix in groups))
    return or_(*(name.like(f"%{suffix}") for suffix in _FILE_KIND_SUFFIXES[kind]))


def _file_registry_filters(source, q: str, file_source: FileSource, kind: FileKind):
    filters = []
    if file_source != "all":
        filters.append(source.c.source == file_source)
    if q.strip():
        needle = q.strip()
        filters.append(
            or_(
                source.c.original_name.icontains(needle, autoescape=True),
                source.c.entity_number.icontains(needle, autoescape=True),
                source.c.entity_title.icontains(needle, autoescape=True),
            )
        )
    kind_clause = _file_kind_clause(source, kind)
    if kind_clause is not None:
        filters.append(kind_clause)
    return filters


def _file_registry_rows(db, q: str, file_source: FileSource, kind: FileKind, *, limit: int | None = None):
    source = _file_registry_source()
    filters = _file_registry_filters(source, q, file_source, kind)
    statement = select(source).where(*filters).order_by(source.c.uploaded_at.desc(), source.c.id.desc())
    if limit is not None:
        statement = statement.limit(limit)
    return list(db.execute(statement).mappings().all())


def _file_registry_item(row):
    name = row["original_name"] or ""
    suffix = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    mime_type = (row["mime_type"] or "").lower()
    previewable = mime_type == "application/pdf" or mime_type.startswith("image/") or mime_type.startswith("text/")
    preview_path = ""
    if previewable:
        preview_path = (
            f"/api/admin/orders/{row['entity_id']}/files/{row['id']}/preview"
            if row["source"] == "order"
            else f"/api/admin/applications/{row['entity_id']}/files/{row['id']}/preview"
        )
    return {
        **dict(row),
        "extension": suffix,
        "download_path": (
            f"/api/admin/orders/{row['entity_id']}/files/{row['id']}/download"
            if row["source"] == "order"
            else f"/api/admin/applications/{row['entity_id']}/files/{row['id']}/download"
        ),
        "preview_path": preview_path,
        "entity_path": (
            f"/admin/orders?open={row['entity_id']}"
            if row["source"] == "order"
            else f"/admin/applications/{row['entity_id']}"
        ),
    }


def _file_export_matrix(rows):
    headers = [
        "Файл",
        "Тип",
        "Источник",
        "Номер",
        "Заказ / заявка",
        "Размер, байт",
        "Страниц",
        "Знаков",
        "Слов",
        "Статус анализа",
        "Дата загрузки",
    ]
    values = []
    for row in rows:
        values.append(
            [
                row["original_name"] or "",
                (row["original_name"].rsplit(".", 1)[-1].upper() if "." in row["original_name"] else "FILE"),
                "Заказ" if row["source"] == "order" else "Заявка",
                row["entity_number"] or "",
                row["entity_title"] or "",
                row["size_bytes"] or 0,
                row["page_count"] if row["page_count"] is not None else "",
                row["character_count"] if row["character_count"] is not None else "",
                row["word_count"] if row["word_count"] is not None else "",
                row["analysis_status"] or "",
                row["uploaded_at"].strftime("%Y-%m-%d %H:%M") if row["uploaded_at"] else "",
            ]
        )
    return headers, values


def _csv_safe_cell(value: object) -> object:
    """Prevent spreadsheet formula execution for user-controlled exported text."""
    if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + value
    return value


def _xlsx_column_name(index: int) -> str:
    value = index + 1
    result = ""
    while value:
        value, remainder = divmod(value - 1, 26)
        result = chr(65 + remainder) + result
    return result


def _xlsx_bytes(headers: list[str], rows: list[list[object]]) -> bytes:
    """Create a small standards-compliant XLSX without adding a runtime dependency."""
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>""",
        )
        archive.writestr(
            "_rels/.rels",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>""",
        )
        archive.writestr(
            "xl/workbook.xml",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Файлы" sheetId="1" r:id="rId1"/></sheets>
</workbook>""",
        )
        archive.writestr(
            "xl/_rels/workbook.xml.rels",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>""",
        )
        lines = [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
            '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>',
            '<sheetData>',
        ]
        for row_index, row in enumerate([headers, *rows], start=1):
            lines.append(f'<row r="{row_index}">')
            for column_index, value in enumerate(row):
                ref = f"{_xlsx_column_name(column_index)}{row_index}"
                text = xml_escape(str(value if value is not None else ""))
                lines.append(f'<c r="{ref}" t="inlineStr"><is><t>{text}</t></is></c>')
            lines.append("</row>")
        lines.extend(["</sheetData>", "<autoFilter ref=\"A1:K1\"/>", "</worksheet>"])
        archive.writestr("xl/worksheets/sheet1.xml", "".join(lines))
    return buffer.getvalue()


@router.get("/files")
def list_files_registry(
    db: DB,
    context: Read,
    q: str = Query("", max_length=200),
    source: FileSource = "all",
    kind: FileKind = "all",
    page: int = Query(1, ge=1),
    page_size: int = Query(40, ge=1, le=100),
):
    registry = _file_registry_source()
    filters = _file_registry_filters(registry, q, source, kind)
    total = db.scalar(select(func.count()).select_from(registry).where(*filters)) or 0
    total_bytes = db.scalar(select(func.coalesce(func.sum(registry.c.size_bytes), 0)).where(*filters)) or 0
    rows = db.execute(
        select(registry)
        .where(*filters)
        .order_by(registry.c.uploaded_at.desc(), registry.c.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).mappings().all()
    order_total = db.scalar(
        select(func.count()).select_from(registry).where(*filters, registry.c.source == "order")
    ) or 0
    application_total = db.scalar(
        select(func.count()).select_from(registry).where(*filters, registry.c.source == "application")
    ) or 0
    return {
        "items": [_file_registry_item(row) for row in rows],
        "total": total,
        "total_bytes": int(total_bytes),
        "order_files": order_total,
        "application_files": application_total,
        "page": page,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


@router.get("/files/export.csv")
def export_files_csv(
    db: DB,
    context: Read,
    q: str = Query("", max_length=200),
    source: FileSource = "all",
    kind: FileKind = "all",
):
    rows = _file_registry_rows(db, q, source, kind, limit=10000)
    headers, values = _file_export_matrix(rows)
    output = StringIO()
    writer = csv.writer(output, delimiter=";", lineterminator="\r\n")
    writer.writerow(headers)
    writer.writerows([[_csv_safe_cell(cell) for cell in row] for row in values])
    content = "\ufeff" + output.getvalue()
    return Response(
        content=content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="lingvo-connect-files.csv"'},
    )


@router.get("/files/export.xlsx")
def export_files_xlsx(
    db: DB,
    context: Read,
    q: str = Query("", max_length=200),
    source: FileSource = "all",
    kind: FileKind = "all",
):
    rows = _file_registry_rows(db, q, source, kind, limit=10000)
    headers, values = _file_export_matrix(rows)
    return Response(
        content=_xlsx_bytes(headers, values),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="lingvo-connect-files.xlsx"'},
    )


@router.get("/orders/{order_id}/activity")
def order_activity(order_id: str, db: DB, context: Read, page: int = Query(1, ge=1)):
    get_record(db, Order, order_id)
    return paginate(db, OperationalActivity, [OperationalActivity.order_id == order_id], page, 20)


@router.get("/companies/{client_id}/applications")
def client_applications(client_id: str, db: DB, context: Read, page: int = Query(1, ge=1)):
    get_record(db, Company, client_id)
    ids = select(ApplicationClient.application_id).where(ApplicationClient.client_id == client_id)
    return paginate(db, Application, [Application.id.in_(ids)], page, 20)


@router.get("/executors/{executor_id}/activity")
def executor_activity(executor_id: str, db: DB, context: Read, page: int = Query(1, ge=1)):
    get_record(db, Executor, executor_id)
    return paginate(
        db, OperationalActivity, [OperationalActivity.executor_id == executor_id], page, 20
    )


@router.get("/orders/{order_id}/files")
def order_files(order_id: str, db: DB, context: Read, page: int = Query(1, ge=1)):
    get_record(db, Order, order_id)
    return paginate(db, OrderFile, [OrderFile.order_id == order_id], page, 20)


@router.post("/orders/{order_id}/files", status_code=201)
def upload_order_file(order_id: str, upload: UploadFile, db: DB, context: Write):
    get_record(db, Order, order_id, active=True)
    settings = get_settings()
    storage = storage_from_settings(
        settings.application_storage_path, settings.application_file_max_bytes
    )
    try:
        stored = storage.save(order_id, upload.filename or "", upload.file)
    except UnsafeFileError as exc:
        raise HTTPException(422, str(exc)) from exc
    try:
        row = OrderFile(order_id=order_id, uploaded_by=context.user.id, **asdict(stored))
        db.add(row)
        record(db, context, "file.uploaded", order_id=order_id)
        db.commit()
    except Exception:
        db.rollback()
        storage.delete(stored.storage_key)
        raise
    return view(row)


@router.get("/orders/{order_id}/files/{file_id}/download")
def download_order_file(order_id: str, file_id: str, db: DB, context: Read):
    get_record(db, Order, order_id)
    file = db.get(OrderFile, file_id)
    if not file or file.order_id != order_id:
        raise HTTPException(404, "Файл не найден")
    settings = get_settings()
    storage = storage_from_settings(
        settings.application_storage_path, settings.application_file_max_bytes
    )
    path = storage.resolve(file.storage_key)
    if not path.is_file():
        raise HTTPException(404, "Файл недоступен в хранилище")
    return FileResponse(
        path,
        filename=file.original_name,
        media_type=file.mime_type,
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.get("/orders/{order_id}/files/{file_id}/preview")
def preview_order_file(order_id: str, file_id: str, db: DB, context: Read):
    get_record(db, Order, order_id)
    file = db.get(OrderFile, file_id)
    if not file or file.order_id != order_id:
        raise HTTPException(404, "Файл не найден")
    mime_type = (file.mime_type or "").lower()
    if not (mime_type == "application/pdf" or mime_type.startswith("image/") or mime_type.startswith("text/")):
        raise HTTPException(415, "Предпросмотр этого формата не поддерживается")
    settings = get_settings()
    storage = storage_from_settings(
        settings.application_storage_path, settings.application_file_max_bytes
    )
    path = storage.resolve(file.storage_key)
    if not path.is_file():
        raise HTTPException(404, "Файл недоступен в хранилище")
    return FileResponse(
        path,
        media_type=file.mime_type,
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )
