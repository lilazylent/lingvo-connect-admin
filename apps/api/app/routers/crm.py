"""Production CRM endpoints layered on top of the Stage 1/2 operational model."""

from __future__ import annotations

from dataclasses import asdict
from datetime import date
from pathlib import Path
from tempfile import NamedTemporaryFile
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from app.client_models import ClientDepositTransaction, Company, Representative
from app.crm_models import (
    ClientPayment,
    ExecutorPayment,
    LanguageCatalog,
    OrderStatusOption,
    PricingRule,
    ServiceType,
    Tariff,
)
from app.audit import record_event
from app.db import get_db
from app.dependencies import (
    SessionContext,
    require_admin_write,
    require_authenticated,
    require_authenticated_write,
)
from app.document_analysis import analyze_document
from app.executor_matching import direct_executor_candidates
from app.models import Application, ApplicationActivity, User, utcnow
from app.operations_models import ApplicationClient, Executor, ExecutorAssignment, ExecutorDirection, OperationalActivity, Order, OrderWork
from app.order_files import OrderFile
from app.order_numbering import next_order_number, peek_next_order_number
from app.service_definitions import billing_unit_for, canonical_service_code, definition_for, definition_view, fields_for, lookup_codes
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
StatusBoard = Literal["MAIN", "ARCHIVE"]
StatusColor = Literal["slate", "blue", "violet", "amber", "cyan", "green", "rose"]

BUILTIN_ORDER_STATUS_BOARDS = {
    "NEW": "MAIN",
    "ESTIMATING": "MAIN",
    "APPROVED": "MAIN",
    "IN_PROGRESS": "MAIN",
    "REVIEW": "MAIN",
    "READY": "MAIN",
    "DELIVERED": "MAIN",
    "COMPLETED": "MAIN",
    "CANCELLED": "ARCHIVE",
}


class ServicePayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    code: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9_]+$")
    name: str = Field(min_length=2, max_length=160)
    billing_mode: BillingUnit = "CUSTOM"
    active: bool = True
    sort_order: int = Field(default=100, ge=0, le=100000)
    notes: str = Field(default="", max_length=2000)


class LanguagePayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    name: str = Field(min_length=2, max_length=80)
    active: bool = True
    sort_order: int = Field(default=100, ge=0, le=100000)


class OrderStatusPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    name: str = Field(min_length=2, max_length=80)
    color: StatusColor = "slate"
    board: StatusBoard | None = None
    active: bool = True
    sort_order: int = Field(default=100, ge=0, le=100000)


class OrderStatusCreatePayload(OrderStatusPayload):
    board: StatusBoard = "MAIN"


class OrderArchivePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    archived: bool


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


def _ensure_catalog_languages(db: Session, *values: str) -> None:
    requested = {value.strip() for value in values if value and value.strip()}
    if not requested:
        return

    # Alembic seeds the production catalog from existing CRM data. Test fixtures
    # and freshly created metadata can legitimately start with an empty catalog,
    # so keep backward compatibility until at least one canonical language exists.
    catalog_size = db.scalar(select(func.count()).select_from(LanguageCatalog)) or 0
    if catalog_size == 0:
        return

    known = set(
        db.scalars(
            select(LanguageCatalog.name).where(
                LanguageCatalog.name.in_(requested),
                LanguageCatalog.active.is_(True),
            )
        ).all()
    )
    missing = sorted(requested - known, key=str.casefold)
    if missing:
        raise HTTPException(422, f"Добавьте язык в справочник CRM: {', '.join(missing)}")


class PricingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    unit: BillingUnit
    rate: Decimal = Field(ge=0)
    character_count: int | None = Field(default=None, ge=0)
    page_count: Decimal | None = Field(default=None, ge=0)
    quantity: Decimal | None = Field(default=None, ge=0)
    duration_seconds: int | None = Field(default=None, ge=0)
    document_count: int | None = Field(default=None, ge=0)
    hour_count: Decimal | None = Field(default=None, ge=0)
    urgent: bool = False
    urgency_multiplier: Decimal = Field(default=Decimal("1.50"), ge=1, le=10)
    native_speaker: bool = False
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
    duration_seconds: int | None = Field(default=None, ge=0)
    document_count: int | None = Field(default=None, ge=0)
    hour_count: Decimal | None = Field(default=None, ge=0)
    certification_mode: str = Field(default="", max_length=20)
    urgent: bool = False
    urgency_multiplier: Decimal | None = Field(default=None, ge=1, le=10)
    native_speaker: bool = False


def _active_tariff_query(service_code: str):
    today = date.today()
    service_codes = lookup_codes(service_code) or {service_code}
    return select(Tariff).where(
        Tariff.service_code.in_(service_codes),
        Tariff.active.is_(True),
        (Tariff.active_from.is_(None) | (Tariff.active_from <= today)),
        (Tariff.active_to.is_(None) | (Tariff.active_to >= today)),
    )


def _discount_for(db: Session, service_code: str, quantity: Decimal) -> tuple[Decimal, str | None]:
    service_codes = lookup_codes(service_code) or {service_code}
    rules = db.scalars(
        select(PricingRule).where(
            PricingRule.active.is_(True),
            PricingRule.rule_type == "VOLUME_DISCOUNT",
            or_(PricingRule.service_code.in_(service_codes), PricingRule.service_code == ""),
        ).order_by(
            (PricingRule.service_code == service_code).desc(),
            PricingRule.threshold_from.desc(),
        )
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
    if any(canonical_service_code(t.service_code) != canonical_service_code(payload.service_code) for t in tariffs):
        return False
    if payload.service_code != "written_translation":
        expected_unit = billing_unit_for(payload.service_code, payload.certification_mode)
        if len(tariffs) != 1 or (expected_unit and tariffs[0].unit != expected_unit):
            return False
        tariff = tariffs[0]
        return (
            tariff.source_language in {"", payload.source_language}
            and tariff.target_language in {"", payload.target_language}
        )
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

def _unresolved_tariff_message(resolution: str) -> str:
    if resolution == "native_not_available":
        return "Тариф носителя для выбранного языка отсутствует. Используйте ручной режим / тариф по запросу."
    return "Тариф по запросу / автоматический тариф не найден. Укажите ставку вручную или добавьте подтверждённый тариф в настройках."


def _tariff_components(tariffs: list[Tariff]) -> list[dict]:
    return [
        {
            "tariff_id": tariff.id,
            "source_language": tariff.source_language,
            "target_language": tariff.target_language,
            "direction": tariff.direction,
            "rate": money(Decimal(str(tariff.amount))),
            "unit": tariff.unit,
        }
        for tariff in tariffs
    ]


def _quote_from_tariffs(payload: QuoteRequest, tariffs: list[Tariff], resolution: str) -> dict:
    unit = tariffs[0].unit
    if any(t.unit != unit for t in tariffs):
        raise HTTPException(422, "Выбранные тарифы используют разные единицы расчёта")
    rate = money(sum((Decimal(str(t.amount)) for t in tariffs), Decimal("0")))
    tariff_urgency_multiplier = max((Decimal(str(t.urgency_multiplier)) for t in tariffs), default=Decimal("1"))
    urgency_multiplier = payload.urgency_multiplier or tariff_urgency_multiplier
    native_multiplier = max((Decimal(str(t.native_multiplier)) for t in tariffs), default=Decimal("1"))
    priced = calculate(PricingRequest(
        unit=unit, rate=rate, character_count=payload.character_count, page_count=payload.page_count,
        quantity=payload.quantity, duration_seconds=payload.duration_seconds,
        document_count=payload.document_count, hour_count=payload.hour_count, urgent=payload.urgent,
        native_speaker=payload.native_speaker and not any(t.direction == "NATIVE_SPEAKER" for t in tariffs),
        urgency_multiplier=urgency_multiplier, native_multiplier=native_multiplier,
        min_quantity=max((Decimal(str(t.min_quantity)) for t in tariffs), default=Decimal("0")),
    ))
    return {
        "unit": unit, "rate": rate, "quantity": priced["quantity"],
        "base_amount": priced["base_amount"], "surcharge_multiplier": priced["multiplier"],
        "before_discount": Decimal(str(priced["amount"])),
    }

class ExecutorAssignmentPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    id: str | None = None
    executor_id: str
    character_count: int | None = Field(default=None, ge=0)
    page_count: Decimal | None = Field(default=None, ge=0)
    document_count: int | None = Field(default=None, ge=0)
    duration_seconds: int | None = Field(default=None, ge=0)
    hour_count: Decimal | None = Field(default=None, ge=0)
    billing_unit: BillingUnit = "CONDITIONAL_PAGE"
    rate: Decimal = Field(default=Decimal("0"), ge=0)
    cost: Decimal | None = Field(default=None, ge=0)
    deadline: date | None = None
    deadline_time: str = Field(default="", max_length=5)
    route_stage_index: int | None = Field(default=None, ge=1, le=2)
    route_source_language: str = Field(default="", max_length=80)
    route_target_language: str = Field(default="", max_length=80)
    status: str = Field(default="NEW", max_length=32)
    notes: str = Field(default="", max_length=5000)


class WizardWork(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    service_code: str = Field(default="", max_length=64)
    work_type: str = Field(default="written_translation", max_length=64)
    source_language: str = Field(default="", max_length=80)
    target_language: str = Field(default="", max_length=80)
    topic: str = Field(default="", max_length=160)
    urgent: bool = False
    urgency_multiplier: Decimal = Field(default=Decimal("1.50"), ge=1, le=10)
    native_speaker: bool = False
    discount_percent: Decimal | None = Field(default=None, ge=0, le=100)
    tariff_ids: list[str] = Field(default_factory=list, max_length=2)
    character_count: int | None = Field(default=None, ge=0)
    page_count: Decimal | None = Field(default=None, ge=0)
    word_count: int | None = Field(default=None, ge=0)
    document_count: int | None = Field(default=None, ge=0)
    duration_seconds: int | None = Field(default=None, ge=0)
    hour_count: Decimal | None = Field(default=None, ge=0)
    start_date: date | None = None
    start_time: str = Field(default="", max_length=5)
    certification_mode: str = Field(default="", max_length=20)
    billing_unit: BillingUnit = "CUSTOM"
    client_rate: Decimal = Field(default=Decimal("0"), ge=0)
    price: Decimal | None = Field(default=None, ge=0)
    price_override_reason: str = Field(default="", max_length=500)
    client_billable: bool = True
    executor_id: str | None = None
    executor_rate: Decimal = Field(default=Decimal("0"), ge=0)
    executor_billing_unit: BillingUnit = "CUSTOM"
    executor_cost: Decimal | None = Field(default=None, ge=0)
    deadline: date | None = None
    deadline_time: str = Field(default="", max_length=5)
    executor_deadline: date | None = None
    executor_deadline_time: str = Field(default="", max_length=5)
    executor_assignments: list[ExecutorAssignmentPayload] = Field(default_factory=list, max_length=20)
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
    status: str = Field(default="NEW", min_length=2, max_length=32, pattern=r"^[A-Z0-9_]+$")
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
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    status: str = Field(min_length=2, max_length=32, pattern=r"^[A-Z0-9_]+$")


def money(value: Decimal | int | float | str) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def conditional_page_quantity(character_count: int | Decimal) -> Decimal:
    """Return 1800-character pages rounded upward to one decimal place.

    Oleg's order-registration rule treats one conditional page as the minimum
    billable/display volume: 1..1800 characters = 1 page. Above that threshold
    the value is rounded upward to one decimal place.
    """
    chars = Decimal(str(character_count))
    if chars <= 0:
        return Decimal("0")
    pages = chars / Decimal("1800")
    rounded = (pages * Decimal("10")).to_integral_value(rounding=ROUND_CEILING) / Decimal("10")
    return max(Decimal("1"), rounded)


def quantity_for(payload: PricingRequest) -> Decimal:
    if payload.unit == "CONDITIONAL_PAGE":
        if payload.character_count is None:
            return payload.page_count or payload.quantity or Decimal("0")
        return conditional_page_quantity(payload.character_count)
    if payload.unit == "PER_1000_CHARS":
        return Decimal(payload.character_count or 0) / Decimal("1000")
    if payload.unit == "PER_PAGE":
        return payload.page_count or payload.quantity or Decimal("0")
    if payload.unit == "PER_DOCUMENT":
        return Decimal(payload.document_count or 0) if payload.document_count is not None else (payload.quantity or Decimal("0"))
    if payload.unit == "PER_SECOND":
        return Decimal(payload.duration_seconds or 0)
    if payload.unit == "PER_MINUTE":
        seconds = Decimal(payload.duration_seconds or 0)
        return max(Decimal("1"), (seconds / Decimal("60")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)) if seconds else (payload.quantity or Decimal("0"))
    if payload.unit == "HOURLY":
        return Decimal(str(payload.hour_count or 0)) if payload.hour_count is not None else (payload.quantity or Decimal("0"))
    if payload.unit == "CUSTOM":
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
    unit = work.executor_billing_unit if executor else (billing_unit_for(work.service_code, work.certification_mode) or work.billing_unit)
    rate = work.executor_rate if executor else work.client_rate
    result = calculate(PricingRequest(
        unit=unit,
        rate=rate,
        character_count=work.character_count,
        page_count=work.page_count,
        document_count=work.document_count,
        duration_seconds=work.duration_seconds,
        hour_count=work.hour_count,
        urgent=work.urgent if not executor else False,
        urgency_multiplier=work.urgency_multiplier if not executor else Decimal("1"),
        native_speaker=work.native_speaker if not executor else False,
    ))
    return result["amount"]


def assignment_auto_amount(item: ExecutorAssignmentPayload) -> Decimal:
    result = calculate(PricingRequest(
        unit=item.billing_unit,
        rate=item.rate,
        character_count=item.character_count,
        page_count=item.page_count,
        document_count=item.document_count,
        duration_seconds=item.duration_seconds,
        hour_count=item.hour_count,
        urgent=False,
        urgency_multiplier=Decimal("1"),
        native_speaker=False,
    ))
    return result["amount"]


def _legacy_assignment(payload: WizardWork) -> ExecutorAssignmentPayload | None:
    if not payload.executor_id:
        return None
    return ExecutorAssignmentPayload(
        executor_id=payload.executor_id,
        character_count=payload.character_count,
        page_count=payload.page_count,
        document_count=payload.document_count,
        duration_seconds=payload.duration_seconds,
        hour_count=payload.hour_count,
        billing_unit=payload.executor_billing_unit,
        rate=payload.executor_rate,
        cost=payload.executor_cost,
        deadline=payload.executor_deadline,
        deadline_time=payload.executor_deadline_time,
        status=payload.status,
        notes="",
    )


def _assignment_payloads(payload: WizardWork) -> list[ExecutorAssignmentPayload]:
    if payload.executor_assignments:
        return payload.executor_assignments
    legacy = _legacy_assignment(payload)
    return [legacy] if legacy else []


def _validate_executor(db: Session, executor_id: str) -> Executor:
    executor = db.get(Executor, executor_id)
    if not executor or executor.archived:
        raise HTTPException(422, "Выбранный исполнитель недоступен")
    return executor


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
            _validate_executor(db, item.executor_id)
        for assignment in item.executor_assignments:
            _validate_executor(db, assignment.executor_id)


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
        payment.amount_due = money(sum((Decimal(str(work.price)) for work in works if work.client_billable), Decimal("0")))
        payment.updated_at = utcnow()


def _sync_executor_assignments(db: Session, row: OrderWork, payload: WizardWork) -> list[ExecutorAssignment]:
    requested = _assignment_payloads(payload)
    routed = [item for item in requested if item.route_stage_index is not None]
    if routed:
        if len(routed) != len(requested) or {item.route_stage_index for item in routed} != {1, 2}:
            raise HTTPException(422, "Составной маршрут должен содержать ровно два последовательных этапа")
        order = db.get(Order, row.order_id)
        matching = direct_executor_candidates(db, order, row) if order else None
        route = matching.get("routed_match") if matching else None
        if not route or not route.get("eligible"):
            raise HTTPException(422, "Составной маршрут больше не доступен для этой работы")
        stages = {stage["index"]: stage for stage in route["stages"]}
        for item in routed:
            stage = stages.get(item.route_stage_index)
            if not stage:
                raise HTTPException(422, "Этап маршрута больше не существует")
            if item.route_source_language != stage["source_language"] or item.route_target_language != stage["target_language"]:
                raise HTTPException(422, "Языковая пара этапа маршрута устарела")
            candidate = next((candidate for candidate in stage["candidates"] if candidate["executor_id"] == item.executor_id), None)
            if not candidate or candidate["candidate_state"] == "UNAVAILABLE":
                raise HTTPException(422, "Выбранный исполнитель недоступен для этапа маршрута")
    existing = db.scalars(
        select(ExecutorAssignment).where(
            ExecutorAssignment.work_id == row.id,
            ExecutorAssignment.archived.is_(False),
        )
    ).all()
    existing_by_id = {item.id: item for item in existing}
    keep_ids: set[str] = set()
    active_rows: list[ExecutorAssignment] = []

    service_definition = definition_for(row.service_code) if row.service_code else None
    service_fields = fields_for(row.service_code, row.certification_mode) if service_definition else set()
    service_unit = billing_unit_for(row.service_code, row.certification_mode) if service_definition else None

    for index, item in enumerate(requested):
        _validate_executor(db, item.executor_id)
        # Canonical services own their quantity shape on the server too. The UI already
        # renders only these fields, but direct/stale API payloads must not reintroduce
        # hidden quantities or a billing unit that belongs to another service.
        effective_item = item
        if service_definition:
            effective_item = item.model_copy(
                update={
                    "character_count": item.character_count if "character_count" in service_fields else None,
                    "page_count": item.page_count if "page_count" in service_fields else None,
                    "document_count": item.document_count if "document_count" in service_fields else None,
                    "duration_seconds": item.duration_seconds if "duration_seconds" in service_fields else None,
                    "hour_count": item.hour_count if "hour_count" in service_fields else None,
                    "billing_unit": service_unit or item.billing_unit,
                }
            )
        assignment = existing_by_id.get(effective_item.id) if effective_item.id else None
        if effective_item.id and assignment is None:
            raise HTTPException(422, "Назначение исполнителя не принадлежит этой работе")
        if assignment is None:
            assignment = ExecutorAssignment(work_id=row.id, executor_id=effective_item.executor_id)
            db.add(assignment)
            db.flush()
        auto_cost = money(assignment_auto_amount(effective_item))
        actual_cost = money(effective_item.cost) if effective_item.cost is not None else auto_cost
        assignment.executor_id = effective_item.executor_id
        assignment.character_count = effective_item.character_count
        assignment.page_count = (
            quantity_for(PricingRequest(
                unit="CONDITIONAL_PAGE",
                rate=Decimal("0"),
                character_count=effective_item.character_count,
            ))
            if effective_item.billing_unit == "CONDITIONAL_PAGE" and effective_item.character_count is not None
            else effective_item.page_count
        )
        assignment.document_count = effective_item.document_count
        assignment.duration_seconds = effective_item.duration_seconds
        assignment.hour_count = effective_item.hour_count
        assignment.billing_unit = effective_item.billing_unit
        assignment.rate = effective_item.rate
        assignment.auto_cost = auto_cost
        assignment.cost = actual_cost
        assignment.cost_overridden = effective_item.cost is not None and actual_cost != auto_cost
        assignment.deadline = effective_item.deadline
        assignment.deadline_time = effective_item.deadline_time
        assignment.route_stage_index = effective_item.route_stage_index
        assignment.route_source_language = effective_item.route_source_language
        assignment.route_target_language = effective_item.route_target_language
        assignment.status = effective_item.status
        assignment.sort_order = (index + 1) * 10
        assignment.notes = effective_item.notes
        assignment.archived = False
        assignment.updated_at = utcnow()
        if assignment.id in existing_by_id:
            assignment.version += 1
        keep_ids.add(assignment.id)
        active_rows.append(assignment)

    for assignment in existing:
        if assignment.id not in keep_ids:
            assignment.archived = True
            assignment.version += 1
            assignment.updated_at = utcnow()

    total_auto = money(sum((Decimal(str(item.auto_cost)) for item in active_rows), Decimal("0")))
    total_cost = money(sum((Decimal(str(item.cost)) for item in active_rows), Decimal("0")))
    first = active_rows[0] if active_rows else None
    row.executor_id = first.executor_id if first else None
    row.executor_rate = first.rate if first else Decimal("0")
    row.executor_billing_unit = first.billing_unit if first else "CUSTOM"
    row.executor_auto_cost = total_auto
    row.executor_cost = total_cost
    row.executor_cost_overridden = any(item.cost_overridden for item in active_rows)
    row.executor_deadline = first.deadline if first else None
    row.executor_deadline_time = first.deadline_time if first else ""

    # Keep the legacy per-work payment row as a compatibility aggregate. When a work
    # is split between several executors, attribution lives in executor_assignments.
    payment = db.scalar(select(ExecutorPayment).where(ExecutorPayment.work_id == row.id))
    if payment is None:
        payment = ExecutorPayment(work_id=row.id)
        db.add(payment)
    payment.executor_id = first.executor_id if len(active_rows) == 1 else None
    payment.amount_due = total_cost
    payment.updated_at = utcnow()
    return active_rows


def _apply_work_payload(db: Session, row: OrderWork, payload: WizardWork) -> None:
    definition = definition_for(payload.service_code) if payload.service_code else None
    active_fields = fields_for(payload.service_code, payload.certification_mode) if definition else set()
    source_language = payload.source_language if not definition or "source_language" in active_fields else ""
    target_language = payload.target_language if not definition or "target_language" in active_fields else ""
    _ensure_catalog_languages(db, source_language, target_language)

    if payload.service_code:
        service = db.scalar(
            select(ServiceType).where(
                ServiceType.code == payload.service_code, ServiceType.active.is_(True)
            )
        )
        if not service:
            raise HTTPException(422, f"Неизвестная или отключённая услуга: {payload.service_code}")

    certification_mode = payload.certification_mode or ("BOUND" if payload.service_code == "company_certification" else "")
    service_unit = billing_unit_for(payload.service_code, certification_mode)
    resolved_rate = payload.client_rate
    resolved_unit = service_unit or payload.billing_unit
    effective_urgent = payload.urgent if not definition or "markup" in active_fields else False
    effective_native = payload.native_speaker if not definition or "translator_type" in active_fields else False

    pricing_payload = PricingRequest(
        unit=resolved_unit,
        rate=payload.client_rate,
        character_count=payload.character_count if not definition or "character_count" in active_fields else None,
        page_count=payload.page_count if not definition or "page_count" in active_fields else None,
        document_count=payload.document_count if not definition or "document_count" in active_fields else None,
        duration_seconds=payload.duration_seconds if not definition or "duration_seconds" in active_fields else None,
        hour_count=payload.hour_count if not definition or "hour_count" in active_fields else None,
        urgent=effective_urgent,
        urgency_multiplier=payload.urgency_multiplier,
        native_speaker=effective_native,
    )
    calculated = calculate(pricing_payload)
    before_discount = Decimal(str(calculated["amount"]))
    quantity = Decimal(str(calculated["quantity"]))

    selected_tariffs = _tariffs_by_ids(db, payload.tariff_ids, payload.service_code) if payload.service_code else []
    quote_payload = QuoteRequest(
        service_code=payload.service_code or "custom",
        source_language=source_language,
        target_language=target_language,
        character_count=pricing_payload.character_count,
        page_count=pricing_payload.page_count,
        duration_seconds=pricing_payload.duration_seconds,
        document_count=pricing_payload.document_count,
        hour_count=pricing_payload.hour_count,
        certification_mode=certification_mode,
        urgent=effective_urgent,
        urgency_multiplier=payload.urgency_multiplier,
        native_speaker=effective_native,
    )
    if payload.tariff_ids and len(selected_tariffs) != len(payload.tariff_ids):
        raise HTTPException(422, "Выбранный тариф недоступен или больше не действует")
    if selected_tariffs:
        if not _tariff_matches_request(selected_tariffs, quote_payload):
            raise HTTPException(422, "Выбранный тариф не соответствует параметрам работы")
        evaluated = _quote_from_tariffs(quote_payload, selected_tariffs, "manual_selection")
        before_discount = Decimal(str(evaluated["before_discount"]))
        quantity = Decimal(str(evaluated["quantity"]))
        resolved_rate = Decimal(str(evaluated["rate"]))
        resolved_unit = str(evaluated["unit"])
    elif payload.service_code and payload.price is None and payload.client_rate == 0:
        quote = pricing_quote(quote_payload, db, None)
        if quote.get("resolved"):
            before_discount = Decimal(str(quote["before_discount"]))
            quantity = Decimal(str(quote["quantity"]))
            resolved_rate = Decimal(str(quote["rate"]))
            resolved_unit = str(quote["unit"])

    if definition and "discount" not in active_fields:
        applied_discount = Decimal("0")
        discount_overridden = False
    elif payload.discount_percent is None:
        applied_discount, _ = _discount_for(db, payload.service_code, quantity)
        discount_overridden = False
    else:
        applied_discount = Decimal(str(payload.discount_percent))
        discount_overridden = True
    auto_price = money(before_discount * (Decimal("1") - applied_discount / Decimal("100")))
    actual_price = money(payload.price) if payload.price is not None else auto_price

    row.work_type = payload.service_code or payload.work_type
    row.service_code = payload.service_code
    row.source_language = source_language
    row.target_language = target_language
    row.topic = payload.topic if not definition or "topic" in active_fields else ""
    row.urgent = effective_urgent
    row.urgency_multiplier = payload.urgency_multiplier
    row.native_speaker = effective_native
    row.discount_percent = applied_discount
    row.discount_overridden = discount_overridden
    row.tariff_ids = ",".join(payload.tariff_ids)
    row.character_count = payload.character_count if not definition or "character_count" in active_fields else None
    row.page_count = (
        quantity
        if (not definition or "page_count" in active_fields)
        and resolved_unit == "CONDITIONAL_PAGE"
        and row.character_count is not None
        else (payload.page_count if not definition or "page_count" in active_fields else None)
    )
    row.word_count = payload.word_count if not definition else None
    row.document_count = payload.document_count if not definition or "document_count" in active_fields else None
    row.duration_seconds = payload.duration_seconds if not definition or "duration_seconds" in active_fields else None
    row.hour_count = payload.hour_count if not definition or "hour_count" in active_fields else None
    row.start_date = payload.start_date if not definition or "start_date" in active_fields else None
    row.start_time = payload.start_time if not definition or "start_time" in active_fields else ""
    row.certification_mode = certification_mode if payload.service_code == "company_certification" else ""
    row.billing_unit = resolved_unit
    row.client_rate = resolved_rate
    row.auto_price = auto_price
    row.price = actual_price
    row.price_overridden = payload.price is not None and actual_price != auto_price
    row.price_override_reason = payload.price_override_reason
    row.client_billable = payload.client_billable
    row.deadline = payload.deadline if not definition or "deadline" in active_fields else None
    row.deadline_time = payload.deadline_time if not definition or "deadline_time" in active_fields else ""
    row.status = payload.status
    row.notes = payload.notes
    row.updated_at = utcnow()
    _sync_executor_assignments(db, row, payload)


def _work_view(db: Session, work: OrderWork) -> dict:
    result = view(work)
    assignments = db.scalars(
        select(ExecutorAssignment).where(
            ExecutorAssignment.work_id == work.id,
            ExecutorAssignment.archived.is_(False),
        ).order_by(ExecutorAssignment.sort_order, ExecutorAssignment.created_at)
    ).all()
    assignment_items = []
    for assignment in assignments:
        item = view(assignment)
        executor = db.get(Executor, assignment.executor_id)
        item["executor_name"] = executor.name if executor else ""
        assignment_items.append(item)
    result["executor_assignments"] = assignment_items
    return result


def finance(db: Session, order_id: str) -> dict:
    works = db.scalars(
        select(OrderWork)
        .where(OrderWork.order_id == order_id, OrderWork.archived.is_(False))
        .order_by(OrderWork.sort_order, OrderWork.created_at)
    ).all()
    revenue = money(sum((Decimal(str(w.price)) for w in works if w.client_billable), Decimal("0")))
    work_ids = [work.id for work in works]
    assignments = db.scalars(
        select(ExecutorAssignment)
        .where(
            ExecutorAssignment.work_id.in_(work_ids),
            ExecutorAssignment.archived.is_(False),
        )
        .order_by(ExecutorAssignment.work_id, ExecutorAssignment.sort_order, ExecutorAssignment.created_at)
    ).all() if work_ids else []
    assignments_by_work: dict[str, list[ExecutorAssignment]] = {}
    for assignment in assignments:
        assignments_by_work.setdefault(assignment.work_id, []).append(assignment)

    executor_breakdown = []
    executor_cost_total = Decimal("0")
    for work in works:
        work_assignments = assignments_by_work.get(work.id, [])
        assignment_items = []
        if work_assignments:
            work_executor_cost = sum((Decimal(str(item.cost)) for item in work_assignments), Decimal("0"))
            for item in work_assignments:
                executor = db.get(Executor, item.executor_id)
                assignment_items.append({
                    "assignment_id": item.id,
                    "executor_id": item.executor_id,
                    "executor_name": executor.name if executor else "",
                    "route_stage_index": item.route_stage_index,
                    "route_source_language": item.route_source_language,
                    "route_target_language": item.route_target_language,
                    "character_count": item.character_count,
                    "page_count": item.page_count,
                    "document_count": item.document_count,
                    "duration_seconds": item.duration_seconds,
                    "hour_count": item.hour_count,
                    "billing_unit": item.billing_unit,
                    "rate": item.rate,
                    "auto_cost": item.auto_cost,
                    "cost": item.cost,
                    "cost_overridden": item.cost_overridden,
                    "amount_paid": item.amount_paid,
                    "deadline": item.deadline,
                    "status": item.status,
                })
            legacy_cost = False
        else:
            work_executor_cost = Decimal(str(work.executor_cost))
            legacy_cost = work_executor_cost > 0
        work_executor_cost = money(work_executor_cost)
        executor_cost_total += work_executor_cost
        executor_breakdown.append({
            "work_id": work.id,
            "service_code": work.service_code,
            "source_language": work.source_language,
            "target_language": work.target_language,
            "client_price": money(Decimal(str(work.price))) if work.client_billable else money(Decimal("0")),
            "client_billable": work.client_billable,
            "executor_cost": work_executor_cost,
            "legacy_cost": legacy_cost,
            "assignments": assignment_items,
        })

    executor_cost = money(executor_cost_total)
    profit = money(revenue - executor_cost)
    margin = money((profit / revenue * Decimal("100")) if revenue else Decimal("0"))
    payment = db.scalar(select(ClientPayment).where(ClientPayment.order_id == order_id))
    paid = money(Decimal(str(payment.amount_paid)) if payment else Decimal("0"))
    return {
        "revenue": revenue,
        "executor_cost": executor_cost,
        "profit": profit,
        "margin_percent": margin,
        "client_paid": paid,
        "client_debt": money(max(Decimal("0"), revenue - paid)),
        "executor_assignment_count": len(assignments),
        "executor_breakdown": executor_breakdown,
    }


@router.get("/services")
def services(db: DB, context: Read, active: bool | None = Query(None)):
    query = select(ServiceType)
    if active is not None:
        query = query.where(ServiceType.active == active)
    rows = db.scalars(query.order_by(ServiceType.sort_order, ServiceType.name)).all()
    result = []
    for row in rows:
        item = view(row)
        item["definition"] = definition_view(row.code)
        result.append(item)
    return result


@router.post("/services", status_code=201)
def create_service(payload: ServicePayload, db: DB, context: AdminWrite):
    if db.scalar(select(ServiceType).where(ServiceType.code == payload.code)):
        raise HTTPException(409, "Услуга с таким кодом уже существует")
    row = ServiceType(**payload.model_dump())
    db.add(row); db.commit(); return view(row)


@router.patch("/services/{service_id}")
def edit_service(service_id: str, payload: ServicePayload, db: DB, context: AdminWrite):
    row = db.get(ServiceType, service_id)
    if not row:
        raise HTTPException(404, "Услуга не найдена")
    # ServiceType.code is already persisted in tariffs, order works, pricing rules
    # and Phase 06 executor capabilities. Keep this business key stable until those
    # string references are migrated to real foreign keys.
    if payload.code != row.code:
        raise HTTPException(409, "Системный код существующей услуги менять нельзя")
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    row.updated_at = utcnow()
    db.commit()
    return view(row)


def _status_definition(db: Session, code: str) -> OrderStatusOption | None:
    row = db.get(OrderStatusOption, code)
    if row:
        return row
    if code in BUILTIN_ORDER_STATUS_BOARDS:
        return None
    raise HTTPException(422, "Статус заказа не найден")


def _status_board(db: Session, code: str) -> str:
    row = _status_definition(db, code)
    return row.board if row else BUILTIN_ORDER_STATUS_BOARDS[code]


def _default_status_for_board(db: Session, board: str) -> str:
    preferred = "CANCELLED" if board == "ARCHIVE" else "NEW"
    preferred_row = db.get(OrderStatusOption, preferred)
    if preferred_row and preferred_row.active and preferred_row.board == board:
        return preferred_row.code
    row = db.scalar(
        select(OrderStatusOption)
        .where(OrderStatusOption.active.is_(True), OrderStatusOption.board == board)
        .order_by(OrderStatusOption.sort_order, OrderStatusOption.created_at)
    )
    if row:
        return row.code
    # Fresh create_all-based tests do not run Alembic seed data. Keep the built-in
    # defaults available only when the persisted built-in row is genuinely absent.
    # If an administrator disabled the last stage on a board, fail explicitly rather
    # than returning a status whose persisted board no longer matches the request.
    if preferred_row is None and preferred in BUILTIN_ORDER_STATUS_BOARDS:
        return preferred
    raise HTTPException(409, "Для выбранной воронки нет активных статусов")


@router.get("/order-statuses")
def order_statuses(db: DB, context: Read):
    rows = db.scalars(select(OrderStatusOption).order_by(OrderStatusOption.board, OrderStatusOption.sort_order)).all()
    return [view(row) for row in rows]


@router.post("/order-statuses", status_code=201)
def create_order_status(payload: OrderStatusCreatePayload, request: Request, db: DB, context: AdminWrite):
    code = f"CUSTOM_{uuid4().hex[:12].upper()}"
    row = OrderStatusOption(code=code, **payload.model_dump())
    db.add(row)
    record_event(
        db,
        request,
        "order_status_created",
        actor_user_id=context.user.id,
        details={"status_code": code, "board": payload.board},
    )
    db.commit()
    return view(row)


@router.patch("/order-statuses/{status_code}")
def edit_order_status(status_code: str, payload: OrderStatusPayload, request: Request, db: DB, context: AdminWrite):
    row = db.get(OrderStatusOption, status_code)
    if not row:
        raise HTTPException(404, "Статус не найден")
    old_board = row.board
    expected_builtin_board = BUILTIN_ORDER_STATUS_BOARDS.get(status_code)
    if payload.board is not None and expected_builtin_board and payload.board != expected_builtin_board:
        raise HTTPException(409, "Системный этап нельзя переносить в другую воронку")
    for key, value in payload.model_dump().items():
        if key == "board" and value is None:
            continue
        setattr(row, key, value)
    row.updated_at = utcnow()
    if old_board != row.board:
        db.execute(
            update(Order)
            .where(Order.status == row.code)
            .values(archived=row.board == "ARCHIVE", updated_at=utcnow())
        )
    record_event(
        db,
        request,
        "order_status_updated",
        actor_user_id=context.user.id,
        details={"status_code": status_code, "fields": list(payload.model_dump()), "board": row.board},
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
    _ensure_catalog_languages(db, payload.source_language, payload.target_language)
    row = Tariff(**payload.model_dump()); db.add(row); db.commit(); return view(row)


@router.patch("/tariffs/{tariff_id}")
def edit_tariff(tariff_id: str, payload: TariffPayload, db: DB, context: AdminWrite):
    row = db.get(Tariff, tariff_id)
    if not row: raise HTTPException(404, "Тариф не найден")
    _ensure_catalog_languages(db, payload.source_language, payload.target_language)
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
def languages(
    db: DB,
    context: Read,
    q: str = Query("", max_length=80),
    include_inactive: bool = Query(False),
):
    query = select(LanguageCatalog)
    if not include_inactive:
        query = query.where(LanguageCatalog.active.is_(True))
    if q.strip():
        query = query.where(LanguageCatalog.name.icontains(q.strip(), autoescape=True))
    rows = db.scalars(query.order_by(LanguageCatalog.sort_order, LanguageCatalog.name).limit(200)).all()
    if rows or (db.scalar(select(func.count()).select_from(LanguageCatalog)) or 0):
        return {"items": [view(row) for row in rows]}

    # Test fixtures and legacy local databases created with metadata.create_all()
    # do not execute Alembic seed migrations. Preserve the old read contract until
    # 0017 is applied, without pretending those derived values are editable rows.
    values: set[str] = set()
    for source, target in db.execute(select(Tariff.source_language, Tariff.target_language)).all():
        if source and source.strip():
            values.add(source.strip())
        if target and target.strip():
            values.add(target.strip())
    for source, target in db.execute(select(OrderWork.source_language, OrderWork.target_language)).all():
        if source and source.strip():
            values.add(source.strip())
        if target and target.strip():
            values.add(target.strip())
    for source, target in db.execute(select(ExecutorDirection.source_language, ExecutorDirection.target_language)).all():
        if source and source.strip():
            values.add(source.strip())
        if target and target.strip():
            values.add(target.strip())
    for source, target in db.execute(select(Application.source_language, Application.target_language)).all():
        if source and source.strip():
            values.add(source.strip())
        if target and target.strip():
            values.add(target.strip())
    needle = q.strip().casefold()
    derived = [value for value in sorted(values, key=str.casefold) if not needle or needle in value.casefold()]
    return {
        "items": [
            {"id": value, "name": value, "active": True, "sort_order": (index + 1) * 10}
            for index, value in enumerate(derived[:200])
        ]
    }


@router.post("/languages", status_code=201)
def create_language(payload: LanguagePayload, db: DB, context: AdminWrite):
    duplicate = db.scalar(select(LanguageCatalog).where(func.lower(LanguageCatalog.name) == payload.name.lower()))
    if duplicate:
        raise HTTPException(409, "Такой язык уже есть в справочнике")
    row = LanguageCatalog(**payload.model_dump())
    db.add(row)
    db.commit()
    return view(row)


@router.patch("/languages/{language_id}")
def edit_language(language_id: str, payload: LanguagePayload, db: DB, context: AdminWrite):
    row = db.get(LanguageCatalog, language_id)
    if not row:
        raise HTTPException(404, "Язык не найден")
    # Operational entities still persist the language display name, so renaming a
    # catalog row would orphan existing tariffs/works/capabilities. Phase 10 needs
    # a stable key; until IDs are propagated end-to-end, rename by creating a new
    # language and deactivating the old one instead of silently breaking references.
    if payload.name != row.name:
        raise HTTPException(409, "Название существующего языка менять нельзя; добавьте новый язык")
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    row.updated_at = utcnow()
    db.commit()
    return view(row)

@router.post("/pricing/options")
def pricing_options(payload: QuoteRequest, db: DB, context: Read):
    service = db.scalar(select(ServiceType).where(ServiceType.code == payload.service_code, ServiceType.active.is_(True)))
    if not service:
        raise HTTPException(422, "Услуга не найдена или отключена")
    candidates: list[tuple[list[Tariff], str]] = []
    auto_tariffs, auto_resolution = (_resolve_translation_tariff(db, payload) if payload.service_code == "written_translation" else ([], "direct"))
    if payload.service_code != "written_translation":
        query = _active_tariff_query(payload.service_code)
        expected_unit = billing_unit_for(payload.service_code, payload.certification_mode)
        if expected_unit:
            query = query.where(Tariff.unit == expected_unit)
        rows = db.scalars(query.order_by(Tariff.active_from.desc().nullslast())).all()
        matching_rows = [row for row in rows if _tariff_matches_request([row], payload)]
        candidates.extend(([row], "direct") for row in matching_rows)
        if matching_rows and not auto_tariffs:
            auto_tariffs = [matching_rows[0]]
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
            "directions": [t.direction for t in tariffs], "components": _tariff_components(tariffs),
            "discount_name": discount_name,
            "is_auto": ids == tuple(t.id for t in auto_tariffs),
        })
    return {
        "options": options,
        "auto_key": ",".join(t.id for t in auto_tariffs) if auto_tariffs else "",
        "resolution": auto_resolution,
        "message": "" if options else _unresolved_tariff_message(auto_resolution),
    }


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
        expected_unit = billing_unit_for(payload.service_code, payload.certification_mode)
        if expected_unit:
            query = query.where(Tariff.unit == expected_unit)
        direct = db.scalar(query.order_by(Tariff.active_from.desc().nullslast()))
        if direct:
            tariffs = [direct]
    if not tariffs:
        return {
            "resolved": False, "service_code": payload.service_code, "resolution": resolution,
            "message": _unresolved_tariff_message(resolution),
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
        "components": _tariff_components(tariffs),
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
            .join(ExecutorAssignment, ExecutorAssignment.work_id == OrderWork.id)
            .join(Executor, Executor.id == ExecutorAssignment.executor_id)
            .where(
                OrderWork.archived.is_(False),
                ExecutorAssignment.archived.is_(False),
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
        assigned_work_ids = select(ExecutorAssignment.work_id).where(
            ExecutorAssignment.executor_id == executor_id,
            ExecutorAssignment.archived.is_(False),
        )
        work_query = work_query.where(
            or_(OrderWork.executor_id == executor_id, OrderWork.id.in_(assigned_work_ids))
        )
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


@router.get("/orders/number-preview")
def order_number_preview(
    db: DB,
    context: Read,
    execution_year: int | None = Query(default=None, ge=2000, le=9999),
):
    """Preview the next public number without consuming/reserving it."""
    return {
        "number": peek_next_order_number(db, execution_year=execution_year),
        "execution_year": execution_year,
        "reserved": False,
    }


@router.post("/orders/wizard", status_code=201)
def create_order_wizard(payload: WizardOrder, db: DB, context: Write):
    validate_order_refs(db, payload)
    if _status_board(db, payload.status) != "MAIN":
        raise HTTPException(422, "Новый заказ нельзя сразу создать в архивном статусе")
    if payload.application_id and db.scalar(select(Order).where(Order.application_id == payload.application_id)):
        raise HTTPException(409, "Для этой заявки уже создан заказ")
    deadlines = [w.deadline for w in payload.works if w.deadline]
    order_deadline = max(deadlines) if deadlines else None
    number = next_order_number(db, execution_year=order_deadline.year if order_deadline else None)
    order = Order(
        number=number, title=payload.title, client_id=payload.client_id,
        contact_id=payload.contact_id, manager_id=payload.manager_id,
        application_id=payload.application_id, deadline=order_deadline,
        status=payload.status, notes=payload.notes,
    )
    db.add(order); db.flush()
    total = Decimal("0")
    for index, item in enumerate(payload.works):
        work = OrderWork(
            order_id=order.id,
            work_type=item.work_type,
            sort_order=(index + 1) * 10,
        )
        db.add(work)
        db.flush()
        _apply_work_payload(db, work, item)
        if work.client_billable:
            total += Decimal(str(work.price))
    amount_due = money(total)
    manual_paid = money(payload.payment.amount_paid)
    deposit_applied = Decimal("0")
    if payload.client_id and amount_due > manual_paid:
        client_row = db.scalar(select(Company).where(Company.id == payload.client_id).with_for_update())
        if client_row:
            available = max(Decimal("0"), money(client_row.deposit_balance or 0))
            deposit_applied = money(min(available, amount_due - manual_paid))
            if deposit_applied > 0:
                next_balance = money(available - deposit_applied)
                client_row.deposit_balance = next_balance
                client_row.version += 1
                client_row.updated_at = utcnow()
                db.add(ClientDepositTransaction(
                    company_id=client_row.id,
                    order_id=order.id,
                    actor_user_id=context.user.id,
                    kind="ORDER_DEBIT",
                    amount=-deposit_applied,
                    balance_after=next_balance,
                    note=f"Списание по заказу {order.number}",
                ))
    effective_paid = money(min(amount_due, manual_paid + deposit_applied))
    payment_method = payload.payment.payment_method or ("deposit" if deposit_applied > 0 else "")
    db.add(ClientPayment(order_id=order.id, amount_due=amount_due, amount_paid=effective_paid,
                         payment_method=payment_method, invoice_number=payload.payment.invoice_number,
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
        works=[_work_view(db, w) for w in works],
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
    return _work_view(db, row)


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
    return _work_view(db, row)


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
        urgency_multiplier=source.urgency_multiplier,
        native_speaker=source.native_speaker,
        discount_percent=source.discount_percent,
        discount_overridden=source.discount_overridden,
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
        client_billable=source.client_billable,
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
    source_assignments = db.scalars(
        select(ExecutorAssignment).where(
            ExecutorAssignment.work_id == source.id,
            ExecutorAssignment.archived.is_(False),
        ).order_by(ExecutorAssignment.sort_order)
    ).all()
    for assignment in source_assignments:
        db.add(
            ExecutorAssignment(
                work_id=clone.id,
                executor_id=assignment.executor_id,
                character_count=assignment.character_count,
                page_count=assignment.page_count,
                billing_unit=assignment.billing_unit,
                rate=assignment.rate,
                auto_cost=assignment.auto_cost,
                cost=assignment.cost,
                cost_overridden=assignment.cost_overridden,
                amount_paid=Decimal("0"),
                deadline=assignment.deadline,
                deadline_time=assignment.deadline_time,
                status="NEW",
                sort_order=assignment.sort_order,
                notes=assignment.notes,
            )
        )
    db.add(
        ExecutorPayment(
            work_id=clone.id,
            executor_id=clone.executor_id if len(source_assignments) <= 1 else None,
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
    return _work_view(db, clone)


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
    if not row:
        raise HTTPException(404, "Заказ не найден")
    board = _status_board(db, payload.status)
    row.status = payload.status
    row.archived = board == "ARCHIVE"
    row.version += 1
    row.updated_at = utcnow()
    db.add(OperationalActivity(order_id=row.id, actor_user_id=context.user.id, action="order.status_changed"))
    db.commit()
    return view(row)


@router.post("/orders/{order_id}/archive")
def set_order_archive(order_id: str, payload: OrderArchivePayload, db: DB, context: Write):
    row = db.get(Order, order_id)
    if not row:
        raise HTTPException(404, "Заказ не найден")
    board = "ARCHIVE" if payload.archived else "MAIN"
    row.archived = payload.archived
    row.status = _default_status_for_board(db, board)
    row.version += 1
    row.updated_at = utcnow()
    db.add(OperationalActivity(
        order_id=row.id,
        actor_user_id=context.user.id,
        action="order.archived" if payload.archived else "order.restored",
    ))
    db.commit()
    return view(row)


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
    revenue = money(sum((Decimal(str(w.price)) for w in works if w.client_billable), Decimal("0")))
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
    return {"client": view(client), "orders": [view(o) for o in orders[:50]], "order_count": len(orders), "active_orders": sum(o.status not in {"COMPLETED", "CANCELLED"} and not o.archived for o in orders), "revenue": money(sum((f["revenue"] for f in financials), Decimal("0"))), "debt": money(sum((f["client_debt"] for f in financials), Decimal("0"))), "deposit_balance": money(client.deposit_balance or 0), "last_order": view(orders[0]) if orders else None}


@router.get("/executors/{executor_id}/summary")
def executor_summary(executor_id: str, db: DB, context: Read):
    executor = db.get(Executor, executor_id)
    if not executor:
        raise HTTPException(404, "Исполнитель не найден")
    assignments = db.scalars(
        select(ExecutorAssignment).where(
            ExecutorAssignment.executor_id == executor_id,
            ExecutorAssignment.archived.is_(False),
        ).order_by(ExecutorAssignment.created_at.desc())
    ).all()
    work_ids = list(dict.fromkeys(item.work_id for item in assignments))
    works_by_id = {
        work.id: work
        for work in db.scalars(
            select(OrderWork).where(
                OrderWork.id.in_(work_ids),
                OrderWork.archived.is_(False),
            )
        ).all()
    } if work_ids else {}
    due = money(sum((Decimal(str(item.cost)) for item in assignments), Decimal("0")))
    paid = money(sum((Decimal(str(item.amount_paid)) for item in assignments), Decimal("0")))
    active = sum(
        1 for item in assignments
        if item.status not in {"COMPLETED", "CANCELLED"}
    )
    completed = sum(1 for item in assignments if item.status == "COMPLETED")
    items = []
    for assignment in assignments[:50]:
        item = view(assignment)
        work = works_by_id.get(assignment.work_id)
        item["work"] = view(work) if work else None
        items.append(item)
    return {
        "executor": view(executor),
        "assignments": items,
        "works": [view(works_by_id[work_id]) for work_id in work_ids[:50] if work_id in works_by_id],
        "active_works": active,
        "completed_works": completed,
        "amount_due": due,
        "amount_paid": paid,
        "owed": money(max(Decimal("0"), due - paid)),
    }
