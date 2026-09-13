"""Clients become orders; orders contain independently assigned work."""

from dataclasses import asdict
from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.exc import IntegrityError

from app.client_models import ClientActivity, Company, Representative
from app.config import get_settings
from app.models import Application, ApplicationActivity, User
from app.operations_models import (
    ApplicationClient,
    Executor,
    ExecutorDirection,
    OperationalActivity,
    Order,
    OrderCounter,
    OrderWork,
)
from app.order_files import OrderFile
from app.routers.clients import DB, ArchiveChange, PersonFields, Read, Write, change, view
from app.storage import UnsafeFileError, storage_from_settings

router = APIRouter(prefix="/api/admin", tags=["operations"])


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


WorkType = Literal[
    "written_translation",
    "interpreting",
    "certification",
    "localization",
    "audio_video",
    "linguistic_support",
    "editing",
    "proofreading",
    "layout",
]
Status = Literal["NEW", "IN_PROGRESS", "COMPLETED", "CANCELLED"]


class Direction(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    source_language: str = Field(default="", max_length=80)
    target_language: str = Field(default="", max_length=80)
    work_type: WorkType = "written_translation"


class ExecutorFields(PersonFields):
    telegram: str = Field(default="", max_length=160)
    directions: list[Direction] = Field(default_factory=list, max_length=100)


class ExecutorEdit(ExecutorFields):
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
    result["directions"] = [
        view(item)
        for item in db.scalars(
            select(ExecutorDirection)
            .where(ExecutorDirection.executor_id == row.id)
            .order_by(
                ExecutorDirection.work_type,
                ExecutorDirection.source_language,
                ExecutorDirection.target_language,
            )
        )
    ]
    return result


def set_directions(db, executor_id, directions):
    db.execute(delete(ExecutorDirection).where(ExecutorDirection.executor_id == executor_id))
    for source, target, kind in sorted(
        {(d.source_language, d.target_language, d.work_type) for d in directions}
    ):
        db.add(
            ExecutorDirection(
                executor_id=executor_id,
                source_language=source,
                target_language=target,
                work_type=kind,
            )
        )


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
            or_(
                Order.title.icontains(q, autoescape=True),
                Order.number.icontains(q, autoescape=True),
            )
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
    number = db.scalar(
        update(OrderCounter)
        .where(OrderCounter.id == 1)
        .values(value=OrderCounter.value + 1)
        .returning(OrderCounter.value)
    )
    if number is None:
        raise HTTPException(503, "Не инициализирован счётчик заказов. Выполните миграции.")
    row = Order(number=f"LC-O-{number:06d}", **payload.model_dump())
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
