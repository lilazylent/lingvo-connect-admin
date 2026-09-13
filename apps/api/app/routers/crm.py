"""Production CRM endpoints layered on top of the Stage 1/2 operational model."""

from __future__ import annotations

from dataclasses import asdict
from datetime import date
from pathlib import Path
from tempfile import NamedTemporaryFile
from decimal import Decimal, ROUND_HALF_UP
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from app.client_models import Company, Representative
from app.crm_models import ClientPayment, ExecutorPayment, OrderStatusOption, PricingRule, ServiceType, Tariff
from app.audit import record_event
from app.db import get_db
from app.dependencies import (
    SessionContext,
    require_admin_write,
    require_authenticated,
    require_authenticated_write,
)
from app.document_analysis import analyze_document
from app.models import Application, ApplicationActivity, User, utcnow
from app.operations_models import ApplicationClient, Executor, ExecutorDirection, OperationalActivity, Order, OrderCounter, OrderWork
from app.order_files import OrderFile
from app.routers.clients import view
from app.storage import UnsafeFileError, storage_from_settings
from app.config import get_settings

router = APIRouter(prefix="/api/admin/crm", tags=["crm"])
DB = Annotated[Session, Depends(get_db)]
Read = Annotated[SessionContext, Depends(require_authenticated)]
Write = Annotated[SessionContext, Depends(require_authenticated_write)]
AdminWrite = Annotated[SessionContext, Depends(require_admin_write)]

BillingUnit = Literal[
    "CONDITIONAL_PAGE", "PER_1000_CHARS", "PER_PAGE", "PER_DOCUMENT", "PER_SECOND",
    "PER_MINUTE", "HOURLY", "FIXED", "PERCENT_OF_BASE_SERVICE", "CUSTOM"
]
OrderStatus = Literal["NEW", "ESTIMATING", "APPROVED", "IN_PROGRESS", "REVIEW", "READY", "DELIVERED", "COMPLETED", "CANCELLED"]
StatusColor = Literal["slate", "blue", "violet", "amber", "cyan", "green", "rose"]


class ServicePayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    code: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9_]+$")
    name: str = Field(min_length=2, max_length=160)
    billing_mode: BillingUnit = "CUSTOM"
    active: bool = True
    sort_order: int = Field(default=100, ge=0, le=100000)
    notes: str = Field(default="", max_length=2000)


class OrderStatusPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    name: str = Field(min_length=2, max_length=80)
    color: StatusColor = "slate"
    active: bool = True
    sort_order: int = Field(default=100, ge=0, le=100000)


class PricingRulePayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    code: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9_]+$")
    name: str = Field(min_length=2, max_length=160)
    rule_type: str = Field(default="VOLUME_DISCOUNT", max_length=40)
    service_code: str = Field(default="", max_length=64)
    threshold_from: Decimal | None = Field(default=None, ge=0)
    threshold_to: Decimal | None = Field(default=None, ge=0)
    percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    multiplier: Decimal = Field(default=Decimal("1"), ge=0)
    active: bool = True
    notes: str = Field(default="", max_length=2000)


class TariffPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    service_code: str = Field(min_length=2, max_length=64)
    source_language: str = Field(default="", max_length=80)
    target_language: str = Field(default="", max_length=80)
    direction: str = Field(default="ANY", max_length=32)
    unit: BillingUnit = "CONDITIONAL_PAGE"
    amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    min_quantity: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=4)
    urgency_multiplier: Decimal = Field(default=Decimal("1.50"), ge=1, max_digits=8, decimal_places=4)
    native_multiplier: Decimal = Field(default=Decimal("1.00"), ge=1, max_digits=8, decimal_places=4)
    active_from: date | None = None
    active_to: date | None = None
    active: bool = True
    notes: str = Field(default="", max_length=2000)


class PricingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    unit: BillingUnit
    rate: Decimal = Field(ge=0)
    character_count: int | None = Field(default=None, ge=0)
    page_count: Decimal | None = Field(default=None, ge=0)
    quantity: Decimal | None = Field(default=None, ge=0)
    duration_seconds: int | None = Field(default=None, ge=0)
    urgent: bool = False
    native_speaker: bool = False
    urgency_multiplier: Decimal = Field(default=Decimal("1.50"), ge=1)
    native_multiplier: Decimal = Field(default=Decimal("1.00"), ge=1)
    min_quantity: Decimal = Field(default=Decimal("0"), ge=0)


class QuoteRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    service_code: str = Field(min_length=2, max_length=64)
    source_language: str = Field(default="", max_length=80)
    target_language: str = Field(default="", max_length=80)
    character_count: int | None = Field(default=None, ge=0)
    page_count: Decimal | None = Field(default=None, ge=0)
    quantity: Decimal | None = Field(default=None, ge=0)
    urgent: bool = False
    native_speaker: bool = False


def _active_tariff_query(service_code: str):
    today = date.today()
    return select(Tariff).where(
        Tariff.service_code == service_code,
        Tariff.active.is_(True),
        (Tariff.active_from.is_(None) | (Tariff.active_from <= today)),
        (Tariff.active_to.is_(None) | (Tariff.active_to >= today)),
    )


def _discount_for(db: Session, service_code: str, quantity: Decimal) -> tuple[Decimal, str | None]:
    rules = db.scalars(
        select(PricingRule).where(
            PricingRule.active.is_(True),
            PricingRule.rule_type == "VOLUME_DISCOUNT",
            PricingRule.service_code == service_code,
        ).order_by(PricingRule.threshold_from.desc())
    ).all()
    for rule in rules:
        low = Decimal(str(rule.threshold_from)) if rule.threshold_from is not None else Decimal("0")
        high = Decimal(str(rule.threshold_to)) if rule.threshold_to is not None else None
        if quantity >= low and (high is None or quantity <= high):
            return Decimal(str(rule.percent)), rule.name
    return Decimal("0"), None

def _resolve_translation_tariff(db: Session, payload: QuoteRequest) -> tuple[list[Tariff], str]:
    base = _active_tariff_query("written_translation")
    if payload.native_speaker:
        tariff = db.scalar(base.where(Tariff.direction == "NATIVE_SPEAKER", Tariff.target_language == payload.target_language).order_by(Tariff.active_from.desc().nullslast()))
        if tariff:
            return [tariff], "native_speaker"
        # The 2026 sheet explicitly leaves the native-speaker column blank for some languages.
        # Do not silently fall back to a regular translation tariff when the manager requested a native speaker.
        return [], "native_not_available"
    if payload.source_language == "Русский" and payload.target_language:
        tariff = db.scalar(base.where(Tariff.direction == "FROM_RUSSIAN", Tariff.target_language == payload.target_language).order_by(Tariff.active_from.desc().nullslast()))
        if tariff:
            return [tariff], "from_russian"
    if payload.target_language == "Русский" and payload.source_language:
        tariff = db.scalar(base.where(Tariff.direction == "TO_RUSSIAN", Tariff.source_language == payload.source_language).order_by(Tariff.active_from.desc().nullslast()))
        if tariff:
            return [tariff], "to_russian"
    # Foreign → foreign: the supplied tariff sheet allows calculation through Russian.
    if payload.source_language and payload.target_language:
        first = db.scalar(base.where(Tariff.direction == "TO_RUSSIAN", Tariff.source_language == payload.source_language).order_by(Tariff.active_from.desc().nullslast()))
        second = db.scalar(base.where(Tariff.direction == "FROM_RUSSIAN", Tariff.target_language == payload.target_language).order_by(Tariff.active_from.desc().nullslast()))
        if first and second:
            return [first, second], "via_russian"
    return [], "not_found"


def _tariffs_by_ids(db: Session, ids: list[str], service_code: str) -> list[Tariff]:
    if not ids:
        return []
    rows = db.scalars(_active_tariff_query(service_code).where(Tariff.id.in_(ids))).all()
    indexed = {row.id: row for row in rows}
    return [indexed[item_id] for item_id in ids if item_id in indexed]

def _tariff_matches_request(tariffs: list[Tariff], payload: QuoteRequest) -> bool:
    if not tariffs:
        return False
    if any(t.service_code != payload.service_code for t in tariffs):
        return False
    if payload.service_code != "written_translation":
        return len(tariffs) == 1
    if len(tariffs) == 1:
        tariff = tariffs[0]
        if tariff.direction == "NATIVE_SPEAKER":
            return payload.native_speaker and tariff.target_language == payload.target_language
        if tariff.direction == "FROM_RUSSIAN":
            return payload.source_language == "Русский" and tariff.target_language == payload.target_language
        if tariff.direction == "TO_RUSSIAN":
            return payload.target_language == "Русский" and tariff.source_language == payload.source_language
        return tariff.source_language in {"", payload.source_language} and tariff.target_language in {"", payload.target_language}
    if len(tariffs) == 2 and payload.source_language and payload.target_language and payload.source_language != "Русский" and payload.target_language != "Русский":
        return (
            tariffs[0].direction == "TO_RUSSIAN" and tariffs[0].source_language == payload.source_language
            and tariffs[1].direction == "FROM_RUSSIAN" and tariffs[1].target_language == payload.target_language
        )
    return False

def _quote_from_tariffs(payload: QuoteRequest, tariffs: list[Tariff], resolution: str) -> dict:
    unit = tariffs[0].unit
    if any(t.unit != unit for t in tariffs):
        raise HTTPException(422, "Выбранные тарифы используют разные единицы расчёта")
    rate = money(sum((Decimal(str(t.amount)) for t in tariffs), Decimal("0")))
    urgency_multiplier = max((Decimal(str(t.urgency_multiplier)) for t in tariffs), default=Decimal("1"))
    native_multiplier = max((Decimal(str(t.native_multiplier)) for t in tariffs), default=Decimal("1"))
    priced = calculate(PricingRequest(
        unit=unit, rate=rate, character_count=payload.character_count, page_count=payload.page_count,
        quantity=payload.quantity, urgent=payload.urgent,
        native_speaker=payload.native_speaker and not any(t.direction == "NATIVE_SPEAKER" for t in tariffs),
        urgency_multiplier=urgency_multiplier, native_multiplier=native_multiplier,
        min_quantity=max((Decimal(str(t.min_quantity)) for t in tariffs), default=Decimal("0")),
    ))
    return {
        "unit": unit, "rate": rate, "quantity": priced["quantity"],
        "base_amount": priced["base_amount"], "surcharge_multiplier": priced["multiplier"],
        "before_discount": Decimal(str(priced["amount"])),
    }

class WizardWork(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    service_code: str = Field(default="", max_length=64)
    work_type: str = Field(default="written_translation", max_length=64)
    source_language: str = Field(default="", max_length=80)
    target_language: str = Field(default="", max_length=80)
    topic: str = Field(default="", max_length=160)
    urgent: bool = False
    native_speaker: bool = False
    tariff_ids: list[str] = Field(default_factory=list, max_length=2)
    character_count: int | None = Field(default=None, ge=0)
    page_count: Decimal | None = Field(default=None, ge=0)
    word_count: int | None = Field(default=None, ge=0)
    billing_unit: BillingUnit = "CUSTOM"
    client_rate: Decimal = Field(default=Decimal("0"), ge=0)
    price: Decimal | None = Field(default=None, ge=0)
    price_override_reason: str = Field(default="", max_length=500)
    executor_id: str | None = None
    executor_rate: Decimal = Field(default=Decimal("0"), ge=0)
    executor_billing_unit: BillingUnit = "CUSTOM"
    executor_cost: Decimal | None = Field(default=None, ge=0)
    deadline: date | None = None
    deadline_time: str = Field(default="", max_length=5)
    executor_deadline: date | None = None
    executor_deadline_time: str = Field(default="", max_length=5)
    status: str = Field(default="NEW", max_length=32)
    notes: str = Field(default="", max_length=5000)


class WizardPayment(BaseModel):
    amount_paid: Decimal = Field(default=Decimal("0"), ge=0)
    payment_method: str = Field(default="", max_length=64)
    invoice_number: str = Field(default="", max_length=80)
    invoice_date: date | None = None
    paid_at: date | None = None
    notes: str = Field(default="", max_length=5000)


class WizardOrder(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    title: str = Field(default="", max_length=200)
    client_id: str | None = None
    contact_id: str | None = None
    manager_id: str | None = None
    application_id: str | None = None
    status: OrderStatus = "NEW"
    notes: str = Field(default="", max_length=10000)
    works: list[WizardWork] = Field(default_factory=list, max_length=100)
    payment: WizardPayment = Field(default_factory=WizardPayment)


class OrderCoreEdit(BaseModel):
    """Business details stay editable so draft orders never block fast intake."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    title: str = Field(default="", max_length=200)
    client_id: str | None = None
    contact_id: str | None = None
    manager_id: str | None = None
    notes: str = Field(default="", max_length=10000)
    version: int = Field(ge=1)


class WorkEdit(WizardWork):
    version: int = Field(ge=1)


class WorkReorder(BaseModel):
    work_ids: list[str] = Field(min_length=1, max_length=100)


class ExecutorPaymentEdit(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    amount_paid: Decimal = Field(ge=0)
    paid_at: date | None = None
    notes: str = Field(default="", max_length=5000)
    version: int = Field(ge=1)


class PaymentEdit(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    amount_paid: Decimal = Field(ge=0)
    payment_method: str = Field(default="", max_length=64)
    invoice_number: str = Field(default="", max_length=80)
    invoice_date: date | None = None
    paid_at: date | None = None
    notes: str = Field(default="", max_length=5000)
    version: int = Field(ge=1)


class StatusEdit(BaseModel):
    status: OrderStatus


def money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def quantity_for(payload: PricingRequest) -> Decimal:
    if payload.unit == "CONDITIONAL_PAGE":
        if payload.character_count is None:
            return payload.page_count or payload.quantity or Decimal("0")
        pages = Decimal(payload.character_count) / Decimal("1800")
        return max(Decimal("1"), pages.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    if payload.unit == "PER_1000_CHARS":
        return Decimal(payload.character_count or 0) / Decimal("1000")
    if payload.unit == "PER_PAGE":
        return payload.page_count or payload.quantity or Decimal("0")
    if payload.unit == "PER_SECOND":
        return Decimal(payload.duration_seconds or 0)
    if payload.unit == "PER_MINUTE":
        seconds = Decimal(payload.duration_seconds or 0)
        return max(Decimal("1"), (seconds / Decimal("60")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)) if seconds else (payload.quantity or Decimal("0"))
    if payload.unit in {"PER_DOCUMENT", "HOURLY", "CUSTOM"}:
        return payload.quantity or Decimal("0")
    if payload.unit == "FIXED":
        return Decimal("1")
    return payload.quantity or Decimal("0")


def calculate(payload: PricingRequest) -> dict:
    quantity = max(payload.min_quantity, quantity_for(payload))
    base = money(quantity * payload.rate)
    multiplier = Decimal("1")
    if payload.urgent:
        multiplier *= payload.urgency_multiplier
    if payload.native_speaker:
        multiplier *= payload.native_multiplier
    total = money(base * multiplier)
    return {"quantity": quantity, "base_amount": base, "multiplier": multiplier, "amount": total}


def work_auto_amount(work: WizardWork, *, executor: bool = False) -> Decimal:
    unit = work.executor_billing_unit if executor else work.billing_unit
    rate = work.executor_rate if executor else work.client_rate
    result = calculate(PricingRequest(
        unit=unit,
        rate=rate,
        character_count=work.character_count,
        page_count=work.page_count,
        quantity=work.page_count if unit in {"PER_DOCUMENT", "CUSTOM", "HOURLY"} else None,
        urgent=work.urgent if not executor else False,
        native_speaker=work.native_speaker if not executor else False,
    ))
    return result["amount"]


def validate_order_refs(db: Session, payload: WizardOrder) -> None:
    if payload.client_id:
        client = db.get(Company, payload.client_id)
        if not client or client.archived:
            raise HTTPException(422, "Выбранный клиент недоступен")
    if payload.contact_id:
        contact = db.get(Representative, payload.contact_id)
        if not contact or contact.archived:
            raise HTTPException(422, "Выбранное контактное лицо недоступно")
        if not payload.client_id or contact.company_id != payload.client_id:
            raise HTTPException(422, "Контактное лицо можно выбрать только для выбранного клиента")
    if payload.manager_id:
        manager = db.get(User, payload.manager_id)
        if not manager or not manager.is_active or manager.role not in {"ADMIN", "MANAGER"}:
            raise HTTPException(422, "Выбранный менеджер недоступен")
    if payload.application_id and not db.get(Application, payload.application_id):
        raise HTTPException(404, "Исходная заявка не найдена")
    for item in payload.works:
        if item.service_code:
            service = db.scalar(select(ServiceType).where(ServiceType.code == item.service_code, ServiceType.active.is_(True)))
            if not service:
                raise HTTPException(422, f"Неизвестная или отключённая услуга: {item.service_code}")
        if item.executor_id:
            executor = db.get(Executor, item.executor_id)
            if not executor or executor.archived:
                raise HTTPException(422, "Выбранный исполнитель недоступен")




def _sync_order_totals(db: Session, order: Order) -> None:
    works = db.scalars(
        select(OrderWork).where(OrderWork.order_id == order.id, OrderWork.archived.is_(False))
    ).all()
    deadlines = [work.deadline for work in works if work.deadline]
    order.deadline = max(deadlines) if deadlines else None
    order.updated_at = utcnow()
    order.version += 1
    payment = db.scalar(select(ClientPayment).where(ClientPayment.order_id == order.id))
    if payment:
        payment.amount_due = money(sum((Decimal(str(work.price)) for work in works), Decimal("0")))
        payment.updated_at = utcnow()


def _apply_work_payload(db: Session, row: OrderWork, payload: WizardWork) -> None:
    if payload.executor_id:
        executor = db.get(Executor, payload.executor_id)
        if not executor or executor.archived:
            raise HTTPException(422, "Выбранный исполнитель недоступен")
    if payload.service_code:
        service = db.scalar(
            select(ServiceType).where(
                ServiceType.code == payload.service_code, ServiceType.active.is_(True)
            )
        )
        if not service:
            raise HTTPException(422, f"Неизвестная или отключённая услуга: {payload.service_code}")

    resolved_rate = payload.client_rate
    resolved_unit = payload.billing_unit
    auto_price = work_auto_amount(payload)
    selected_tariffs = _tariffs_by_ids(db, payload.tariff_ids, payload.service_code) if payload.service_code else []
    quote_payload = QuoteRequest(
        service_code=payload.service_code or "custom", source_language=payload.source_language,
        target_language=payload.target_language, character_count=payload.character_count,
        page_count=payload.page_count, urgent=payload.urgent, native_speaker=payload.native_speaker,
    )
    if payload.tariff_ids and len(selected_tariffs) != len(payload.tariff_ids):
        raise HTTPException(422, "Выбранный тариф недоступен или больше не действует")
    if selected_tariffs:
        if not _tariff_matches_request(selected_tariffs, quote_payload):
            raise HTTPException(422, "Выбранный тариф не соответствует параметрам работы")
        evaluated = _quote_from_tariffs(quote_payload, selected_tariffs, "manual_selection")
        discount_percent, _ = _discount_for(db, payload.service_code, Decimal(str(evaluated["quantity"])))
        auto_price = money(Decimal(str(evaluated["before_discount"])) * (Decimal("1") - discount_percent / Decimal("100")))
        resolved_rate = Decimal(str(evaluated["rate"]))
        resolved_unit = str(evaluated["unit"])
    elif payload.service_code and payload.price is None and payload.client_rate == 0:
        quote = pricing_quote(
            QuoteRequest(
                service_code=payload.service_code,
                source_language=payload.source_language,
                target_language=payload.target_language,
                character_count=payload.character_count,
                page_count=payload.page_count,
                urgent=payload.urgent,
                native_speaker=payload.native_speaker,
            ),
            db,
            None,
        )
        if quote.get("resolved"):
            auto_price = Decimal(str(quote["amount"]))
            resolved_rate = Decimal(str(quote["rate"]))
            resolved_unit = str(quote["unit"])
    actual_price = money(payload.price) if payload.price is not None else money(auto_price)
    auto_executor = work_auto_amount(payload, executor=True)
    actual_executor = money(payload.executor_cost) if payload.executor_cost is not None else money(auto_executor)

    values = payload.model_dump()
    values.pop("tariff_ids", None)
    values.update(
        billing_unit=resolved_unit,
        client_rate=resolved_rate,
        auto_price=money(auto_price),
        price=actual_price,
        price_overridden=payload.price is not None and actual_price != money(auto_price),
        executor_auto_cost=money(auto_executor),
        executor_cost=actual_executor,
        executor_cost_overridden=payload.executor_cost is not None and actual_executor != money(auto_executor),
    )
    values.pop("price", None)
    values.pop("executor_cost", None)
    for key, value in values.items():
        setattr(row, key, value)
    row.tariff_ids = ",".join(payload.tariff_ids)
    row.price = actual_price
    row.executor_cost = actual_executor
    row.updated_at = utcnow()

    payment = db.scalar(select(ExecutorPayment).where(ExecutorPayment.work_id == row.id))
    if payment is None:
        db.add(
            ExecutorPayment(
                work_id=row.id, executor_id=row.executor_id, amount_due=row.executor_cost
            )
        )
    else:
        payment.executor_id = row.executor_id
        payment.amount_due = row.executor_cost
        payment.updated_at = utcnow()


def finance(db: Session, order_id: str) -> dict:
    works = db.scalars(select(OrderWork).where(OrderWork.order_id == order_id, OrderWork.archived.is_(False))).all()
    revenue = money(sum((Decimal(str(w.price)) for w in works), Decimal("0")))
    executor_cost = money(sum((Decimal(str(w.executor_cost)) for w in works), Decimal("0")))
    profit = money(revenue - executor_cost)
    margin = money((profit / revenue * Decimal("100")) if revenue else Decimal("0"))
    payment = db.scalar(select(ClientPayment).where(ClientPayment.order_id == order_id))
    paid = money(Decimal(str(payment.amount_paid)) if payment else Decimal("0"))
    return {"revenue": revenue, "executor_cost": executor_cost, "profit": profit, "margin_percent": margin, "client_paid": paid, "client_debt": money(max(Decimal("0"), revenue - paid))}


@router.get("/services")
def services(db: DB, context: Read, active: bool | None = Query(None)):
    query = select(ServiceType)
    if active is not None:
        query = query.where(ServiceType.active == active)
    rows = db.scalars(query.order_by(ServiceType.sort_order, ServiceType.name)).all()
    return [view(row) for row in rows]


@router.post("/services", status_code=201)
def create_service(payload: ServicePayload, db: DB, context: AdminWrite):
    if db.scalar(select(ServiceType).where(ServiceType.code == payload.code)):
        raise HTTPException(409, "Услуга с таким кодом уже существует")
    row = ServiceType(**payload.model_dump())
    db.add(row); db.commit(); return view(row)


@router.patch("/services/{service_id}")
def edit_service(service_id: str, payload: ServicePayload, db: DB, context: AdminWrite):
    row = db.get(ServiceType, service_id)
    if not row: raise HTTPException(404, "Услуга не найдена")
    for key, value in payload.model_dump().items(): setattr(row, key, value)
    row.updated_at = utcnow(); db.commit(); return view(row)


@router.get("/order-statuses")
def order_statuses(db: DB, context: Read):
    rows = db.scalars(select(OrderStatusOption).order_by(OrderStatusOption.sort_order)).all()
    return [view(row) for row in rows]


@router.patch("/order-statuses/{status_code}")
def edit_order_status(status_code: str, payload: OrderStatusPayload, request: Request, db: DB, context: AdminWrite):
    row = db.get(OrderStatusOption, status_code)
    if not row:
        raise HTTPException(404, "Статус не найден")
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    row.updated_at = utcnow()
    record_event(
        db,
        request,
        "order_status_updated",
        actor_user_id=context.user.id,
        details={"status_code": status_code, "fields": list(payload.model_dump())},
    )
    db.commit()
    return view(row)


@router.get("/tariffs")
def tariffs(db: DB, context: Read, service_code: str = "", active: bool | None = Query(None)):
    filters = []
    if service_code: filters.append(Tariff.service_code == service_code)
    if active is not None: filters.append(Tariff.active == active)
    rows = db.scalars(select(Tariff).where(*filters).order_by(Tariff.service_code, Tariff.source_language, Tariff.target_language)).all()
    return [view(row) for row in rows]


@router.post("/tariffs", status_code=201)
def create_tariff(payload: TariffPayload, db: DB, context: AdminWrite):
    if not db.scalar(select(ServiceType).where(ServiceType.code == payload.service_code)):
        raise HTTPException(422, "Сначала создайте услугу")
    row = Tariff(**payload.model_dump()); db.add(row); db.commit(); return view(row)


@router.patch("/tariffs/{tariff_id}")
def edit_tariff(tariff_id: str, payload: TariffPayload, db: DB, context: AdminWrite):
    row = db.get(Tariff, tariff_id)
    if not row: raise HTTPException(404, "Тариф не найден")
    for key, value in payload.model_dump().items(): setattr(row, key, value)
    row.updated_at = utcnow(); db.commit(); return view(row)


@router.get("/pricing-rules")
def pricing_rules(db: DB, context: Read, service_code: str = "", active: bool | None = Query(None)):
    filters = []
    if service_code:
        filters.append(PricingRule.service_code == service_code)
    if active is not None:
        filters.append(PricingRule.active == active)
    rows = db.scalars(
        select(PricingRule).where(*filters).order_by(PricingRule.service_code, PricingRule.threshold_from)
    ).all()
    return [view(row) for row in rows]


@router.post("/pricing-rules", status_code=201)
def create_pricing_rule(payload: PricingRulePayload, db: DB, context: AdminWrite):
    if db.scalar(select(PricingRule).where(PricingRule.code == payload.code)):
        raise HTTPException(409, "Правило с таким кодом уже существует")
    if payload.service_code and not db.scalar(select(ServiceType).where(ServiceType.code == payload.service_code)):
        raise HTTPException(422, "Услуга не найдена")
    if payload.threshold_from is not None and payload.threshold_to is not None and payload.threshold_to < payload.threshold_from:
        raise HTTPException(422, "Верхняя граница не может быть меньше нижней")
    row = PricingRule(**payload.model_dump())
    db.add(row)
    db.commit()
    return view(row)


@router.patch("/pricing-rules/{rule_id}")
def edit_pricing_rule(rule_id: str, payload: PricingRulePayload, db: DB, context: AdminWrite):
    row = db.get(PricingRule, rule_id)
    if not row:
        raise HTTPException(404, "Правило не найдено")
    duplicate = db.scalar(select(PricingRule).where(PricingRule.code == payload.code, PricingRule.id != rule_id))
    if duplicate:
        raise HTTPException(409, "Правило с таким кодом уже существует")
    if payload.threshold_from is not None and payload.threshold_to is not None and payload.threshold_to < payload.threshold_from:
        raise HTTPException(422, "Верхняя граница не может быть меньше нижней")
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    row.updated_at = utcnow()
    db.commit()
    return view(row)


@router.get("/languages")
def languages(db: DB, context: Read, q: str = Query("", max_length=80)):
    values: set[str] = set()
    for source, target in db.execute(select(Tariff.source_language, Tariff.target_language).where(Tariff.active.is_(True))).all():
        if source: values.add(source.strip())
        if target: values.add(target.strip())
    for source, target in db.execute(select(OrderWork.source_language, OrderWork.target_language).where(OrderWork.archived.is_(False))).all():
        if source: values.add(source.strip())
        if target: values.add(target.strip())
    for source, target in db.execute(select(ExecutorDirection.source_language, ExecutorDirection.target_language)).all():
        if source: values.add(source.strip())
        if target: values.add(target.strip())
    needle = q.strip().casefold()
    result = sorted(value for value in values if not needle or needle in value.casefold())
    return {"items": [{"id": value, "name": value} for value in result[:100]]}

@router.post("/pricing/options")
def pricing_options(payload: QuoteRequest, db: DB, context: Read):
    service = db.scalar(select(ServiceType).where(ServiceType.code == payload.service_code, ServiceType.active.is_(True)))
    if not service:
        raise HTTPException(422, "Услуга не найдена или отключена")
    candidates: list[tuple[list[Tariff], str]] = []
    auto_tariffs, auto_resolution = (_resolve_translation_tariff(db, payload) if payload.service_code == "written_translation" else ([], "direct"))
    if payload.service_code != "written_translation":
        rows = db.scalars(_active_tariff_query(payload.service_code).order_by(Tariff.active_from.desc().nullslast())).all()
        candidates.extend(([row], "direct") for row in rows)
        if rows and not auto_tariffs:
            auto_tariffs = [rows[0]]
    else:
        base = _active_tariff_query(payload.service_code)
        rows = db.scalars(base.order_by(Tariff.active_from.desc().nullslast())).all()
        for row in rows:
            if _tariff_matches_request([row], payload):
                candidates.append(([row], row.direction.lower()))
        if payload.source_language and payload.target_language and payload.source_language != "Русский" and payload.target_language != "Русский":
            via, resolution = _resolve_translation_tariff(db, QuoteRequest(**payload.model_dump(exclude={"native_speaker"}), native_speaker=False))
            if len(via) == 2:
                candidates.append((via, resolution))
    if payload.native_speaker:
        candidates = [(tariffs, resolution) for tariffs, resolution in candidates if any(t.direction == "NATIVE_SPEAKER" for t in tariffs)]
    if auto_tariffs and not any([t.id for t in tariffs] == [t.id for t in auto_tariffs] for tariffs, _ in candidates):
        candidates.insert(0, (auto_tariffs, auto_resolution))
    options = []
    seen = set()
    for tariffs, resolution in candidates:
        ids = tuple(t.id for t in tariffs)
        if ids in seen or not _tariff_matches_request(tariffs, payload):
            continue
        seen.add(ids)
        evaluated = _quote_from_tariffs(payload, tariffs, resolution)
        discount_percent, discount_name = _discount_for(db, payload.service_code, Decimal(str(evaluated["quantity"])))
        before_discount = Decimal(str(evaluated["before_discount"]))
        amount = money(before_discount * (Decimal("1") - discount_percent / Decimal("100")))
        discount_amount = money(before_discount * discount_percent / Decimal("100"))
        options.append({
            "key": ",".join(ids), "tariff_ids": list(ids), "resolution": resolution,
            "rate": evaluated["rate"], "unit": evaluated["unit"], "amount": amount,
            "quantity": evaluated["quantity"], "base_amount": evaluated["base_amount"],
            "surcharge_multiplier": evaluated["surcharge_multiplier"],
            "before_discount": before_discount, "discount_percent": discount_percent,
            "discount_amount": discount_amount,
            "source_language": payload.source_language, "target_language": payload.target_language,
            "directions": [t.direction for t in tariffs], "discount_name": discount_name,
            "is_auto": ids == tuple(t.id for t in auto_tariffs),
        })
    return {"options": options, "auto_key": ",".join(t.id for t in auto_tariffs) if auto_tariffs else ""}


@router.post("/pricing/calculate")
def price_calculation(payload: PricingRequest, context: Read):
    return calculate(payload)


@router.post("/pricing/quote")
def pricing_quote(payload: QuoteRequest, db: DB, context: Read):
    service = db.scalar(select(ServiceType).where(ServiceType.code == payload.service_code, ServiceType.active.is_(True)))
    if not service:
        raise HTTPException(422, "Услуга не найдена или отключена")
    tariffs: list[Tariff] = []
    resolution = "direct"
    if payload.service_code == "written_translation":
        tariffs, resolution = _resolve_translation_tariff(db, payload)
    else:
        query = _active_tariff_query(payload.service_code)
        direct = db.scalar(query.order_by(Tariff.active_from.desc().nullslast()))
        if direct:
            tariffs = [direct]
    if not tariffs:
        return {
            "resolved": False, "service_code": payload.service_code,
            "message": "Подходящий тариф не найден. Укажите ставку вручную или добавьте тариф в настройках.",
        }
    evaluated = _quote_from_tariffs(payload, tariffs, resolution)
    unit = evaluated["unit"]
    rate = evaluated["rate"]
    discount_percent, discount_name = _discount_for(db, payload.service_code, Decimal(str(evaluated["quantity"])))
    before_discount = Decimal(str(evaluated["before_discount"]))
    discount_amount = money(before_discount * discount_percent / Decimal("100"))
    total = money(before_discount - discount_amount)
    return {
        "resolved": True, "service_code": payload.service_code, "resolution": resolution,
        "tariff_ids": [t.id for t in tariffs], "unit": unit, "rate": rate,
        "quantity": evaluated["quantity"], "base_amount": evaluated["base_amount"],
        "surcharge_multiplier": evaluated["surcharge_multiplier"], "before_discount": before_discount,
        "discount_percent": discount_percent, "discount_name": discount_name,
        "discount_amount": discount_amount, "amount": total,
        "formula": " + ".join(str(t.amount) for t in tariffs) + f" ₽ × {evaluated['quantity']}",
    }




@router.get("/orders")
def crm_orders(
    db: DB,
    context: Read,
    q: str = Query("", max_length=200),
    client_id: str = "",
    executor_id: str = "",
    manager_id: str = "",
    status: str = "",
    service_code: str = "",
    language: str = Query("", max_length=80),
    created_from: date | None = None,
    created_to: date | None = None,
    deadline_from: date | None = None,
    deadline_to: date | None = None,
    overdue: bool | None = None,
    paid: bool | None = None,
    archived: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    filters = [Order.archived == archived]
    work_query = select(OrderWork.order_id).where(OrderWork.archived.is_(False))
    has_work_filter = False

    if q:
        matching_clients = select(Company.id).where(
            or_(
                Company.name.icontains(q, autoescape=True),
                Company.email.icontains(q, autoescape=True),
                Company.phone.icontains(q, autoescape=True),
            )
        )
        matching_contacts = select(Representative.id).where(
            or_(
                Representative.name.icontains(q, autoescape=True),
                Representative.email.icontains(q, autoescape=True),
                Representative.phone.icontains(q, autoescape=True),
            )
        )
        matching_executor_orders = (
            select(OrderWork.order_id)
            .join(Executor, Executor.id == OrderWork.executor_id)
            .where(
                OrderWork.archived.is_(False),
                or_(
                    Executor.name.icontains(q, autoescape=True),
                    Executor.email.icontains(q, autoescape=True),
                    Executor.phone.icontains(q, autoescape=True),
                ),
            )
        )
        filters.append(
            or_(
                Order.number.icontains(q, autoescape=True),
                Order.title.icontains(q, autoescape=True),
                Order.client_id.in_(matching_clients),
                Order.contact_id.in_(matching_contacts),
                Order.id.in_(matching_executor_orders),
            )
        )
    if client_id:
        filters.append(Order.client_id == client_id)
    if manager_id:
        filters.append(Order.manager_id == manager_id)
    if status:
        filters.append(Order.status == status)
    if executor_id:
        work_query = work_query.where(OrderWork.executor_id == executor_id)
        has_work_filter = True
    if service_code:
        work_query = work_query.where(OrderWork.service_code == service_code)
        has_work_filter = True
    if language:
        work_query = work_query.where(
            or_(
                OrderWork.source_language.icontains(language, autoescape=True),
                OrderWork.target_language.icontains(language, autoescape=True),
            )
        )
        has_work_filter = True
    if has_work_filter:
        filters.append(Order.id.in_(work_query))
    if created_from:
        filters.append(func.date(Order.created_at) >= created_from)
    if created_to:
        filters.append(func.date(Order.created_at) <= created_to)
    if deadline_from:
        filters.append(Order.deadline >= deadline_from)
    if deadline_to:
        filters.append(Order.deadline <= deadline_to)
    if overdue is True:
        filters.extend([Order.deadline < date.today(), Order.status.notin_(["COMPLETED", "CANCELLED"])])
    elif overdue is False:
        filters.append(or_(Order.deadline.is_(None), Order.deadline >= date.today(), Order.status.in_(["COMPLETED", "CANCELLED"])))
    if paid is not None:
        payment_orders = select(ClientPayment.order_id).where(
            ClientPayment.amount_paid >= ClientPayment.amount_due
            if paid
            else ClientPayment.amount_paid < ClientPayment.amount_due
        )
        filters.append(Order.id.in_(payment_orders))

    total = db.scalar(select(func.count()).select_from(Order).where(*filters)) or 0
    rows = db.scalars(
        select(Order)
        .where(*filters)
        .order_by(Order.created_at.desc(), Order.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    items = []
    for row in rows:
        item = view(row)
        client = db.get(Company, row.client_id) if row.client_id else None
        contact = db.get(Representative, row.contact_id) if row.contact_id else None
        manager = db.get(User, row.manager_id) if row.manager_id else None
        item.update(
            client_name=client.name if client else "",
            contact_name=contact.name if contact else "",
            manager_name=manager.display_name if manager else "",
            financial=finance(db, row.id),
        )
        items.append(item)
    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


@router.post("/orders/wizard", status_code=201)
def create_order_wizard(payload: WizardOrder, db: DB, context: Write):
    validate_order_refs(db, payload)
    if payload.application_id and db.scalar(select(Order).where(Order.application_id == payload.application_id)):
        raise HTTPException(409, "Для этой заявки уже создан заказ")
    number = db.scalar(update(OrderCounter).where(OrderCounter.id == 1).values(value=OrderCounter.value + 1).returning(OrderCounter.value))
    if number is None: raise HTTPException(503, "Не инициализирован счётчик заказов")
    deadlines = [w.deadline for w in payload.works if w.deadline]
    order = Order(
        number=f"LC-O-{number:06d}", title=payload.title, client_id=payload.client_id,
        contact_id=payload.contact_id, manager_id=payload.manager_id,
        application_id=payload.application_id, deadline=max(deadlines) if deadlines else None,
        status=payload.status, notes=payload.notes,
    )
    db.add(order); db.flush()
    total = Decimal("0")
    for index, item in enumerate(payload.works):
        auto_price = work_auto_amount(item)
        resolved_rate = item.client_rate
        resolved_unit = item.billing_unit
        selected_tariffs = _tariffs_by_ids(db, item.tariff_ids, item.service_code) if item.service_code else []
        quote_payload = QuoteRequest(
            service_code=item.service_code or "custom", source_language=item.source_language,
            target_language=item.target_language, character_count=item.character_count,
            page_count=item.page_count, urgent=item.urgent, native_speaker=item.native_speaker,
        )
        if item.tariff_ids and len(selected_tariffs) != len(item.tariff_ids):
            raise HTTPException(422, "Выбранный тариф недоступен или больше не действует")
        if selected_tariffs:
            if not _tariff_matches_request(selected_tariffs, quote_payload):
                raise HTTPException(422, "Выбранный тариф не соответствует параметрам работы")
            evaluated = _quote_from_tariffs(quote_payload, selected_tariffs, "manual_selection")
            discount_percent, _ = _discount_for(db, item.service_code, Decimal(str(evaluated["quantity"])))
            auto_price = money(Decimal(str(evaluated["before_discount"])) * (Decimal("1") - discount_percent / Decimal("100")))
            resolved_rate = Decimal(str(evaluated["rate"]))
            resolved_unit = str(evaluated["unit"])
        elif item.service_code and item.price is None and item.client_rate == 0:
            quote = pricing_quote(
                QuoteRequest(
                    service_code=item.service_code, source_language=item.source_language,
                    target_language=item.target_language, character_count=item.character_count,
                    page_count=item.page_count, urgent=item.urgent, native_speaker=item.native_speaker,
                ),
                db, context,
            )
            if quote.get("resolved"):
                auto_price = Decimal(str(quote["amount"]))
                resolved_rate = Decimal(str(quote["rate"]))
                resolved_unit = str(quote["unit"])
        actual_price = money(item.price) if item.price is not None else auto_price
        auto_executor = work_auto_amount(item, executor=True)
        actual_executor = money(item.executor_cost) if item.executor_cost is not None else auto_executor
        work = OrderWork(
            order_id=order.id, work_type=item.work_type, service_code=item.service_code,
            source_language=item.source_language, target_language=item.target_language, topic=item.topic,
            urgent=item.urgent, native_speaker=item.native_speaker, tariff_ids=",".join(item.tariff_ids),
            character_count=item.character_count, page_count=item.page_count, word_count=item.word_count,
            billing_unit=resolved_unit, client_rate=resolved_rate, auto_price=auto_price,
            price=actual_price, price_overridden=item.price is not None and actual_price != auto_price,
            price_override_reason=item.price_override_reason,
            executor_id=item.executor_id, executor_rate=item.executor_rate,
            executor_billing_unit=item.executor_billing_unit, executor_auto_cost=auto_executor,
            executor_cost=actual_executor, executor_cost_overridden=item.executor_cost is not None and actual_executor != auto_executor,
            deadline=item.deadline, deadline_time=item.deadline_time,
            executor_deadline=item.executor_deadline, executor_deadline_time=item.executor_deadline_time,
            status=item.status, sort_order=(index + 1) * 10, notes=item.notes,
        )
        db.add(work); db.flush()
        db.add(ExecutorPayment(work_id=work.id, executor_id=work.executor_id, amount_due=actual_executor))
        total += actual_price
    db.add(ClientPayment(order_id=order.id, amount_due=money(total), amount_paid=payload.payment.amount_paid,
                         payment_method=payload.payment.payment_method, invoice_number=payload.payment.invoice_number,
                         invoice_date=payload.payment.invoice_date, paid_at=payload.payment.paid_at, notes=payload.payment.notes))
    if payload.application_id:
        link = db.get(ApplicationClient, payload.application_id)
        if payload.client_id:
            if link and link.client_id != payload.client_id:
                raise HTTPException(409, "Заявка уже связана с другим клиентом")
            if not link:
                db.add(ApplicationClient(application_id=payload.application_id, client_id=payload.client_id))
        db.add(ApplicationActivity(application_id=payload.application_id, actor_user_id=context.user.id, event_type="order_created", event_data={"order_id": order.id, "number": order.number}))
    db.add(OperationalActivity(order_id=order.id, actor_user_id=context.user.id, action="order.wizard_created"))
    db.commit()
    return order_detail(order.id, db, context)


@router.get("/orders/{order_id}")
def order_detail(order_id: str, db: DB, context: Read):
    order = db.get(Order, order_id)
    if not order: raise HTTPException(404, "Заказ не найден")
    works = db.scalars(select(OrderWork).where(OrderWork.order_id == order_id, OrderWork.archived.is_(False)).order_by(OrderWork.sort_order, OrderWork.created_at)).all()
    payment = db.scalar(select(ClientPayment).where(ClientPayment.order_id == order_id))
    files = db.scalars(select(OrderFile).where(OrderFile.order_id == order_id).order_by(OrderFile.created_at.desc())).all()
    result = view(order)
    executor_payments = db.scalars(
        select(ExecutorPayment).where(ExecutorPayment.work_id.in_([work.id for work in works]))
    ).all() if works else []
    client = db.get(Company, order.client_id) if order.client_id else None
    contact = db.get(Representative, order.contact_id) if order.contact_id else None
    manager = db.get(User, order.manager_id) if order.manager_id else None
    result.update(
        works=[view(w) for w in works],
        payment=view(payment) if payment else None,
        executor_payments=[view(item) for item in executor_payments],
        files=[view(f) for f in files],
        financial=finance(db, order_id),
        client_name=client.name if client else "",
        contact_name=contact.name if contact else "",
        manager_name=manager.display_name if manager else "",
    )
    return result


@router.patch("/orders/{order_id}")
def edit_order_core(order_id: str, payload: OrderCoreEdit, db: DB, context: Write):
    order = db.get(Order, order_id)
    if not order or order.archived:
        raise HTTPException(404, "Активный заказ не найден")
    if order.version != payload.version:
        raise HTTPException(409, "Заказ уже изменён. Обновите карточку и повторите.")

    client = None
    if payload.client_id:
        client = db.get(Company, payload.client_id)
        if not client or client.archived:
            raise HTTPException(422, "Выбранный клиент недоступен")
    if payload.contact_id:
        contact = db.get(Representative, payload.contact_id)
        if not contact or contact.archived:
            raise HTTPException(422, "Выбранное контактное лицо недоступно")
        if not payload.client_id or contact.company_id != payload.client_id:
            raise HTTPException(422, "Контактное лицо не принадлежит выбранному клиенту")
    if payload.manager_id:
        manager = db.get(User, payload.manager_id)
        if not manager or not manager.is_active or manager.role not in {"ADMIN", "MANAGER"}:
            raise HTTPException(422, "Выбранный менеджер недоступен")

    if order.application_id and payload.client_id != order.client_id:
        link = db.get(ApplicationClient, order.application_id)
        if payload.client_id:
            if link:
                link.client_id = payload.client_id
            else:
                db.add(ApplicationClient(application_id=order.application_id, client_id=payload.client_id))
        elif link:
            db.delete(link)

    changed = []
    for field in ("title", "client_id", "contact_id", "manager_id", "notes"):
        value = getattr(payload, field)
        if getattr(order, field) != value:
            setattr(order, field, value)
            changed.append(field)
    if changed:
        order.version += 1
        order.updated_at = utcnow()
        db.add(OperationalActivity(
            order_id=order.id, actor_user_id=context.user.id,
            action="order.details_updated",
        ))
        db.commit()
    return order_detail(order_id, db, context)


@router.post("/orders/{order_id}/works", status_code=201)
def create_crm_work(order_id: str, payload: WizardWork, db: DB, context: Write):
    order = db.get(Order, order_id)
    if not order or order.archived:
        raise HTTPException(404, "Активный заказ не найден")
    last_sort = db.scalar(
        select(func.coalesce(func.max(OrderWork.sort_order), 0)).where(OrderWork.order_id == order_id)
    ) or 0
    row = OrderWork(order_id=order_id, work_type=payload.work_type, sort_order=int(last_sort) + 10)
    db.add(row)
    db.flush()
    _apply_work_payload(db, row, payload)
    _sync_order_totals(db, order)
    db.add(
        OperationalActivity(
            order_id=order_id,
            work_id=row.id,
            executor_id=row.executor_id,
            actor_user_id=context.user.id,
            action="work.crm_created",
        )
    )
    db.commit()
    db.refresh(row)
    return view(row)


@router.patch("/orders/{order_id}/works/{work_id}")
def edit_crm_work(order_id: str, work_id: str, payload: WorkEdit, db: DB, context: Write):
    order = db.get(Order, order_id)
    row = db.get(OrderWork, work_id)
    if not order or order.archived or not row or row.order_id != order_id or row.archived:
        raise HTTPException(404, "Активная работа не найдена в этом заказе")
    if row.version != payload.version:
        raise HTTPException(409, "Работа уже изменена. Обновите карточку заказа.")
    _apply_work_payload(db, row, WizardWork(**payload.model_dump(exclude={"version"})))
    row.version += 1
    _sync_order_totals(db, order)
    db.add(
        OperationalActivity(
            order_id=order_id,
            work_id=row.id,
            executor_id=row.executor_id,
            actor_user_id=context.user.id,
            action="work.crm_updated",
        )
    )
    db.commit()
    db.refresh(row)
    return view(row)


@router.post("/orders/{order_id}/works/{work_id}/duplicate", status_code=201)
def duplicate_crm_work(order_id: str, work_id: str, db: DB, context: Write):
    order = db.get(Order, order_id)
    source = db.get(OrderWork, work_id)
    if not order or order.archived or not source or source.order_id != order_id or source.archived:
        raise HTTPException(404, "Активная работа не найдена в этом заказе")
    last_sort = db.scalar(
        select(func.coalesce(func.max(OrderWork.sort_order), 0)).where(OrderWork.order_id == order_id)
    ) or 0
    clone = OrderWork(
        order_id=order_id,
        work_type=source.work_type,
        service_code=source.service_code,
        source_language=source.source_language,
        target_language=source.target_language,
        topic=source.topic,
        urgent=source.urgent,
        native_speaker=source.native_speaker,
        tariff_ids=source.tariff_ids,
        character_count=source.character_count,
        page_count=source.page_count,
        word_count=source.word_count,
        billing_unit=source.billing_unit,
        client_rate=source.client_rate,
        auto_price=source.auto_price,
        price=source.price,
        price_overridden=source.price_overridden,
        price_override_reason=source.price_override_reason,
        executor_id=source.executor_id,
        executor_rate=source.executor_rate,
        executor_billing_unit=source.executor_billing_unit,
        executor_auto_cost=source.executor_auto_cost,
        executor_cost=source.executor_cost,
        executor_cost_overridden=source.executor_cost_overridden,
        deadline=source.deadline,
        deadline_time=source.deadline_time,
        executor_deadline=source.executor_deadline,
        executor_deadline_time=source.executor_deadline_time,
        status="NEW",
        sort_order=int(last_sort) + 10,
        notes=source.notes,
    )
    db.add(clone)
    db.flush()
    db.add(
        ExecutorPayment(
            work_id=clone.id,
            executor_id=clone.executor_id,
            amount_due=clone.executor_cost,
        )
    )
    _sync_order_totals(db, order)
    db.add(
        OperationalActivity(
            order_id=order_id,
            work_id=clone.id,
            executor_id=clone.executor_id,
            actor_user_id=context.user.id,
            action="work.duplicated",
        )
    )
    db.commit()
    db.refresh(clone)
    return view(clone)


@router.post("/orders/{order_id}/works/reorder")
def reorder_crm_works(order_id: str, payload: WorkReorder, db: DB, context: Write):
    order = db.get(Order, order_id)
    if not order or order.archived:
        raise HTTPException(404, "Активный заказ не найден")
    rows = db.scalars(
        select(OrderWork).where(OrderWork.order_id == order_id, OrderWork.archived.is_(False))
    ).all()
    by_id = {row.id: row for row in rows}
    if set(payload.work_ids) != set(by_id) or len(payload.work_ids) != len(by_id):
        raise HTTPException(422, "Передайте все активные работы заказа ровно по одному разу")
    for index, work_id in enumerate(payload.work_ids):
        by_id[work_id].sort_order = (index + 1) * 10
        by_id[work_id].version += 1
        by_id[work_id].updated_at = utcnow()
    db.add(
        OperationalActivity(
            order_id=order_id,
            actor_user_id=context.user.id,
            action="work.reordered",
        )
    )
    db.commit()
    return {"work_ids": payload.work_ids}


@router.post("/orders/{order_id}/works/{work_id}/archive")
def archive_crm_work(order_id: str, work_id: str, db: DB, context: Write):
    order = db.get(Order, order_id)
    row = db.get(OrderWork, work_id)
    if not order or order.archived or not row or row.order_id != order_id or row.archived:
        raise HTTPException(404, "Активная работа не найдена в этом заказе")
    row.archived = True
    row.version += 1
    row.updated_at = utcnow()
    _sync_order_totals(db, order)
    db.add(
        OperationalActivity(
            order_id=order_id,
            work_id=row.id,
            actor_user_id=context.user.id,
            action="work.archived",
        )
    )
    db.commit()
    return {"id": row.id, "archived": True}


@router.patch("/orders/{order_id}/works/{work_id}/executor-payment")
def update_executor_payment(
    order_id: str, work_id: str, payload: ExecutorPaymentEdit, db: DB, context: Write
):
    work = db.get(OrderWork, work_id)
    if not work or work.order_id != order_id or work.archived:
        raise HTTPException(404, "Работа не найдена")
    row = db.scalar(
        select(ExecutorPayment).where(ExecutorPayment.work_id == work_id).with_for_update()
    )
    if row is None:
        row = ExecutorPayment(
            work_id=work_id,
            executor_id=work.executor_id,
            amount_due=work.executor_cost,
        )
        db.add(row)
        db.flush()
    elif row.version != payload.version:
        raise HTTPException(409, "Оплата исполнителя уже изменена. Обновите карточку.")
    row.executor_id = work.executor_id
    row.amount_due = work.executor_cost
    row.amount_paid = payload.amount_paid
    row.paid_at = payload.paid_at
    row.notes = payload.notes
    row.version += 1
    row.updated_at = utcnow()
    db.add(
        OperationalActivity(
            order_id=order_id,
            work_id=work_id,
            executor_id=work.executor_id,
            actor_user_id=context.user.id,
            action="work.executor_payment_updated",
        )
    )
    db.commit()
    db.refresh(row)
    return view(row)


@router.patch("/orders/{order_id}/status")
def update_order_status(order_id: str, payload: StatusEdit, db: DB, context: Write):
    row = db.get(Order, order_id)
    if not row or row.archived: raise HTTPException(404, "Активный заказ не найден")
    row.status = payload.status; row.version += 1; row.updated_at = utcnow()
    db.add(OperationalActivity(order_id=row.id, actor_user_id=context.user.id, action="order.status_changed"))
    db.commit(); return view(row)


@router.patch("/orders/{order_id}/payment")
def update_client_payment(order_id: str, payload: PaymentEdit, db: DB, context: Write):
    if not db.get(Order, order_id): raise HTTPException(404, "Заказ не найден")
    row = db.scalar(select(ClientPayment).where(ClientPayment.order_id == order_id).with_for_update())
    if not row:
        row = ClientPayment(order_id=order_id, amount_due=finance(db, order_id)["revenue"])
        db.add(row); db.flush()
    elif row.version != payload.version:
        raise HTTPException(409, "Оплата уже изменена. Обновите страницу.")
    for key, value in payload.model_dump(exclude={"version"}).items(): setattr(row, key, value)
    row.amount_due = finance(db, order_id)["revenue"]
    row.version += 1; row.updated_at = utcnow()
    db.add(OperationalActivity(order_id=order_id, actor_user_id=context.user.id, action="order.client_payment_updated"))
    db.commit(); return view(row)


@router.post("/files/analyze-preview")
def analyze_preview(upload: UploadFile, context: Write):
    suffix = Path(upload.filename or "").suffix
    with NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        while chunk := upload.file.read(1024 * 1024):
            tmp.write(chunk)
        tmp.flush()
        return analyze_document(Path(tmp.name), upload.filename or "")


@router.post("/orders/{order_id}/files/analyze", status_code=201)
def upload_and_analyze(order_id: str, upload: UploadFile, db: DB, context: Write):
    order = db.get(Order, order_id)
    if not order or order.archived: raise HTTPException(404, "Активный заказ не найден")
    settings = get_settings(); storage = storage_from_settings(settings.application_storage_path, settings.application_file_max_bytes)
    try:
        stored = storage.save(order_id, upload.filename or "", upload.file)
    except UnsafeFileError as exc:
        raise HTTPException(422, str(exc)) from exc
    path = storage.resolve(stored.storage_key)
    metrics = analyze_document(path, stored.original_name)
    try:
        row = OrderFile(order_id=order_id, uploaded_by=context.user.id, **asdict(stored), **metrics)
        db.add(row); db.add(OperationalActivity(order_id=order_id, actor_user_id=context.user.id, action="file.analyzed")); db.commit()
    except Exception:
        db.rollback(); storage.delete(stored.storage_key); raise
    return view(row)


@router.get("/dashboard")
def crm_dashboard(db: DB, context: Read):
    today = date.today()
    active_statuses = ["NEW", "ESTIMATING", "APPROVED", "IN_PROGRESS", "REVIEW", "READY", "DELIVERED"]
    active_orders = db.scalar(select(func.count()).select_from(Order).where(Order.archived.is_(False), Order.status.in_(active_statuses))) or 0
    due_today = db.scalar(select(func.count()).select_from(Order).where(Order.archived.is_(False), Order.status.in_(active_statuses), Order.deadline == today)) or 0
    overdue = db.scalar(select(func.count()).select_from(Order).where(Order.archived.is_(False), Order.status.in_(active_statuses), Order.deadline < today)) or 0
    live_order_ids = select(Order.id).where(Order.archived.is_(False))
    unassigned = db.scalar(
        select(func.count(func.distinct(OrderWork.order_id))).where(
            OrderWork.order_id.in_(live_order_ids),
            OrderWork.archived.is_(False),
            OrderWork.executor_id.is_(None),
            OrderWork.status.notin_(["COMPLETED", "CANCELLED"]),
        )
    ) or 0
    works = db.scalars(
        select(OrderWork).where(
            OrderWork.order_id.in_(live_order_ids), OrderWork.archived.is_(False)
        )
    ).all()
    revenue = money(sum((Decimal(str(w.price)) for w in works), Decimal("0")))
    costs = money(sum((Decimal(str(w.executor_cost)) for w in works), Decimal("0")))
    unpaid = db.scalar(
        select(func.count()).select_from(ClientPayment).where(
            ClientPayment.order_id.in_(live_order_ids),
            ClientPayment.amount_paid < ClientPayment.amount_due,
        )
    ) or 0
    recent = db.scalars(select(Order).where(Order.archived.is_(False)).order_by(Order.created_at.desc()).limit(8)).all()
    new_leads = db.scalar(select(func.count()).select_from(Application).where(Application.status_code == "NEW")) or 0
    return {"new_leads": new_leads, "active_orders": active_orders, "due_today": due_today, "overdue": overdue, "unassigned": unassigned, "awaiting_payment": unpaid, "revenue": revenue, "executor_cost": costs, "profit": money(revenue-costs), "recent_orders": [view(r) for r in recent]}


@router.get("/clients/{client_id}/summary")
def client_summary(client_id: str, db: DB, context: Read):
    client = db.get(Company, client_id)
    if not client: raise HTTPException(404, "Клиент не найден")
    orders = db.scalars(select(Order).where(Order.client_id == client_id).order_by(Order.created_at.desc())).all()
    financials = [finance(db, o.id) for o in orders]
    return {"client": view(client), "orders": [view(o) for o in orders[:50]], "order_count": len(orders), "active_orders": sum(o.status not in {"COMPLETED", "CANCELLED"} and not o.archived for o in orders), "revenue": money(sum((f["revenue"] for f in financials), Decimal("0"))), "debt": money(sum((f["client_debt"] for f in financials), Decimal("0"))), "last_order": view(orders[0]) if orders else None}


@router.get("/executors/{executor_id}/summary")
def executor_summary(executor_id: str, db: DB, context: Read):
    executor = db.get(Executor, executor_id)
    if not executor: raise HTTPException(404, "Исполнитель не найден")
    works = db.scalars(select(OrderWork).where(OrderWork.executor_id == executor_id, OrderWork.archived.is_(False)).order_by(OrderWork.created_at.desc())).all()
    due = money(sum((Decimal(str(w.executor_cost)) for w in works), Decimal("0")))
    paid = db.scalar(select(func.coalesce(func.sum(ExecutorPayment.amount_paid), 0)).where(ExecutorPayment.executor_id == executor_id)) or Decimal("0")
    return {"executor": view(executor), "works": [view(w) for w in works[:50]], "active_works": sum(w.status not in {"COMPLETED", "CANCELLED"} for w in works), "completed_works": sum(w.status == "COMPLETED" for w in works), "amount_due": due, "amount_paid": money(Decimal(str(paid))), "owed": money(max(Decimal("0"), due-Decimal(str(paid))))}
