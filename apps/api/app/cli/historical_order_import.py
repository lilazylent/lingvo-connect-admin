"""One-time historical order migration from the owner's 2026 order spreadsheet.

This is deliberately a controlled CLI migration, not a product import feature.
It writes the intended *historical* state directly and bypasses the live order
wizard, because the wizard has real-time side effects that are wrong for history:
it allocates new public numbers, deducts client deposits today and writes
"created now" activity.

Guarantees:

* historical order numbers are preserved exactly (``YY-NNNN``; the numeric part is
  the spreadsheet number, the year is the numbering series = order date year);
* every imported record has a deterministic UUID derived from its source key, so a
  rerun recognises its own rows and never duplicates orders, works, clients,
  contacts or executors;
* an existing order with the same number that was *not* created by this import is a
  conflict: nothing is written and the command exits with an error;
* no deposit ledger rows, deposit balance changes or synthetic payments are created;
* ``order_counters`` are raised (never lowered) to the highest imported sequence per
  year inside the same transaction, so the next CRM order continues at ``max + 1``.

Usage (inside the backend container)::

    python -m app.cli.historical_order_import --file orders.xlsx            # dry-run
    python -m app.cli.historical_order_import --file orders.xlsx --execute  # write
    python -m app.cli.historical_order_import --file orders.xlsx --verify   # re-check
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from openpyxl import load_workbook
from sqlalchemy import case, func, select, update
from sqlalchemy.orm import Session

from app.client_models import ClientDepositTransaction, Company, Representative
from app.crm_models import ClientPayment, ExecutorPayment, LanguageCatalog, ServiceType
from app.models import SecurityAuditEvent, User
from app.operations_models import (
    Executor,
    ExecutorAssignment,
    Order,
    OrderCounter,
    OrderWork,
)
from app.order_numbering import _ensure_year_counter, format_order_number, peek_next_order_number
from app.service_definitions import billing_unit_for, definition_for

IMPORT_NAMESPACE = uuid.UUID("5b0f7a52-4c1e-4f0e-9a51-6c1f3a2d2026")
IMPORT_ACTION = "historical_orders.imported"
HISTORICAL_PRICE_REASON = "Историческая сумма из таблицы заказов"

# Spreadsheet layout (row 1 = section headers, row 2 = column headers).
HEADER_ROW = 2
FIRST_DATA_ROW = 3
EXPECTED_HEADERS = {
    0: "№ заказа",
    1: "дата",
    2: "статус",
    3: "компания",
    4: "контактное лицо",
    5: "услуга",
    16: "коплате",
    17: "способ",
    21: "исполнитель",
    29: "Наименование документа",
}
C_NUMBER, C_DATE, C_STATUS, C_COMPANY, C_CONTACT, C_SERVICE = 0, 1, 2, 3, 4, 5
C_CHARS, C_PAGES, C_SRC, C_TGT, C_TOPIC, C_DEADLINE, C_DEADLINE_TIME = 6, 7, 8, 9, 10, 11, 12
C_ORDER_COMMENT, C_RATE, C_MULTIPLIER, C_PRICE, C_METHOD = 13, 14, 15, 16, 17
C_INVOICE, C_PAID_AT, C_PAYMENT_COMMENT = 18, 19, 20
C_EXECUTOR, C_EXEC_DEADLINE, C_EXEC_DEADLINE_TIME, C_EXEC_COMMENT = 21, 22, 23, 24
C_EXEC_RATE, C_EXEC_CHARS, C_EXEC_PAGES, C_EXEC_COST, C_DOCUMENT = 25, 26, 27, 28, 29
COLUMN_COUNT = 30

# Deliberate terminology mapping: spreadsheet label -> canonical CRM service code.
SERVICE_MAP = {
    "письм. перевод": "written_translation",
    "редактура": "editing",
    "набор текста": "typing",
    "заверение нотар.": "notarial_certification",
    "заверение наше": "company_certification",
    "апостиль": "apostille",
    "нотар. копия": "notarial_copy",
    "вёрстка текста": "text_layout",
    # A bilingual layout of source + translation; billed per page like text layout.
    "двуязычная версия": "text_layout",
    "вёрстка чертежей": "drawing_layout",
    "распознавание": "recognition",
    "курьер": "delivery",
    "устн. послед. перевод": "consecutive_interpreting",
}
# Labels whose CRM service differs in name; the original label is kept in work notes.
SERVICE_LABEL_NOTES = {"двуязычная версия": "Двуязычная версия"}
# company_certification tariffs: 200 per bound document, 30/50 per page.
COMPANY_CERT_PER_PAGE_RATES = {Decimal("30"), Decimal("50")}

# Spreadsheet language codes -> canonical CRM language catalog names.
LANGUAGE_MAP = {
    "AB": "Абхазский",
    "AR": "Арабский",
    "AZ": "Азербайджанский",
    "BL": "Болгарский",
    "BY": "Белорусский",
    "CN": "Китайский",
    "DA": "Датский",
    "DE": "Немецкий",
    "EN": "Английский",
    "ES": "Испанский",
    "ET": "Эстонский",
    "FR": "Французский",
    "GR": "Греческий",
    "HE": "Иврит",
    "HU": "Венгерский",
    "HY": "Армянский",
    "JP": "Японский",
    "KA": "Грузинский",
    "KO": "Корейский",
    "KY": "Киргизский",
    "KZ": "Казахский",
    "LV": "Латышский",
    "NO": "Норвежский",
    "PT": "Португальский",
    "RU": "Русский",
    "SR": "Сербский",
    "TJ": "Таджикский",
    "TR": "Турецкий",
    "UA": "Украинский",
    "UZ": "Узбекский",
    "VI": "Вьетнамский",
}

ORDER_STATUS_MAP = {
    "сдано": "COMPLETED",
    "готово": "READY",
    "в работе": "IN_PROGRESS",
    "одобрено": "APPROVED",
    "рассчитано": "ESTIMATING",
    "согласование": "ESTIMATING",
    "отменён": "CANCELLED",
}
WORK_STATUS_MAP = {
    "сдано": "COMPLETED",
    "готово": "COMPLETED",
    "в работе": "IN_PROGRESS",
    "одобрено": "NEW",
    "рассчитано": "NEW",
    "согласование": "NEW",
    "отменён": "CANCELLED",
}
PAYMENT_METHOD_MAP = {"б/н": "cashless", "нал": "cash", "деп": "deposit"}
# Orders in these states were executed, so a "paid" marker in the sheet is meaningful.
EXECUTED_ORDER_STATUSES = {"COMPLETED", "READY", "IN_PROGRESS", "APPROVED"}

INVOICE_RE = re.compile(
    r"^\s*Сч[её]т[уа]?\s*№?\s*(?P<number>[^\s]+)\s*(?P<date>\d{2}\.\d{2}\.\d{2,4})?\s*$"
)
PREPAYMENT_RE = re.compile(r"предопла\w*\s+(?P<amount>\d[\d\s ]*)", re.IGNORECASE)


def _uuid(kind: str, key: str) -> str:
    return str(uuid.uuid5(IMPORT_NAMESPACE, f"{kind}:{key}"))


def norm_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = str(value).replace(" ", " ")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def match_key(value: str) -> str:
    """Case/whitespace/ё-insensitive key used only for deduplication."""
    return re.sub(r"\s+", " ", value).strip().casefold().replace("ё", "е")


def money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def to_decimal(value: Any) -> Decimal | None:
    """Parse numbers stored as numbers or as Russian-formatted text (``26 199,30``)."""
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise ValueError(f"unexpected boolean {value!r}")
    if isinstance(value, int | float | Decimal):
        return Decimal(str(value))
    text = str(value).replace(" ", "").replace(" ", "").replace(",", ".")
    try:
        return Decimal(text)
    except InvalidOperation as exc:
        raise ValueError(f"not a number: {value!r}") from exc


def to_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    raise ValueError(f"not a date: {value!r}")


def to_hhmm(value: Any) -> str:
    if value is None or value == "":
        return ""
    if isinstance(value, time):
        return f"{value.hour:02d}:{value.minute:02d}"
    if isinstance(value, datetime):
        return f"{value.hour:02d}:{value.minute:02d}"
    raise ValueError(f"not a time: {value!r}")


def historical_timestamp(day: date) -> datetime:
    # 12:00 UTC keeps the calendar day stable for Russian time zones.
    return datetime(day.year, day.month, day.day, 12, 0, tzinfo=UTC)


# --------------------------------------------------------------------------- source


@dataclass
class SourceRow:
    row: int
    values: tuple
    number: str = ""


@dataclass
class Report:
    source_file: str
    sheets: list[str] = field(default_factory=list)
    counts: Counter = field(default_factory=Counter)
    warnings: list[dict] = field(default_factory=list)
    conflicts: list[dict] = field(default_factory=list)
    invalid_rows: list[dict] = field(default_factory=list)
    mappings: dict = field(default_factory=dict)
    unmapped: dict = field(default_factory=lambda: defaultdict(list))
    extra: dict = field(default_factory=dict)

    def warn(self, code: str, message: str, **context: Any) -> None:
        self.warnings.append({"code": code, "message": message, **context})

    def as_dict(self) -> dict:
        warning_counts = Counter(item["code"] for item in self.warnings)
        return {
            "source_file": self.source_file,
            "sheets": self.sheets,
            "counts": dict(sorted(self.counts.items())),
            "warning_counts": dict(sorted(warning_counts.items())),
            "conflicts": self.conflicts,
            "invalid_rows": self.invalid_rows,
            "unmapped": {key: sorted(set(values)) for key, values in self.unmapped.items()},
            "mappings": self.mappings,
            **self.extra,
            "warnings": self.warnings,
        }


def _is_template_row(values: tuple) -> bool:
    """The sheet ends with pre-formatted blank rows that only carry column defaults."""
    defaults = {C_PAGES: 0, C_MULTIPLIER: 1, C_PRICE: 0, C_METHOD: "б/н", C_EXEC_PAGES: 0, C_EXEC_COST: 0}
    for index, value in enumerate(values):
        if value in (None, ""):
            continue
        if index in defaults and value == defaults[index]:
            continue
        return False
    return True


def read_source(path: Path, report: Report) -> list[SourceRow]:
    workbook = load_workbook(path, read_only=False, data_only=True)
    report.sheets = list(workbook.sheetnames)
    if len(workbook.worksheets) != 1:
        raise SystemExit(f"Ожидался один лист, найдено: {workbook.sheetnames}")
    sheet = workbook.worksheets[0]
    headers = next(sheet.iter_rows(min_row=HEADER_ROW, max_row=HEADER_ROW, values_only=True))
    for index, expected in EXPECTED_HEADERS.items():
        actual = norm_text(headers[index]) if index < len(headers) else ""
        if actual.replace("\n", " ") != expected:
            raise SystemExit(f"Неожиданный заголовок колонки {index + 1}: {actual!r} вместо {expected!r}")

    rows: list[SourceRow] = []
    for row_number, values in enumerate(
        sheet.iter_rows(min_row=FIRST_DATA_ROW, values_only=True), start=FIRST_DATA_ROW
    ):
        values = tuple(values[:COLUMN_COUNT]) + (None,) * max(0, COLUMN_COUNT - len(values))
        if all(value in (None, "") for value in values):
            report.counts["source_rows_empty"] += 1
            continue
        if values[C_NUMBER] in (None, ""):
            if _is_template_row(values):
                report.counts["source_rows_template_skipped"] += 1
            else:
                report.counts["source_rows_invalid"] += 1
                report.invalid_rows.append({"row": row_number, "reason": "нет номера заказа"})
            continue
        rows.append(SourceRow(row_number, values))
    report.counts["source_rows_with_data"] = len(rows)
    return rows


# --------------------------------------------------------------------------- plan


@dataclass
class ClientPlan:
    id: str
    key: str
    name: str
    kind: str
    first_date: date
    existing: bool = False


@dataclass
class ContactPlan:
    id: str
    client_id: str
    name: str
    first_date: date
    existing: bool = False


@dataclass
class ExecutorPlan:
    id: str
    key: str
    name: str
    variants: Counter
    first_date: date
    existing: bool = False


@dataclass
class AssignmentPlan:
    id: str
    executor_key: str
    character_count: int | None
    page_count: Decimal | None
    document_count: int | None
    hour_count: Decimal | None
    billing_unit: str
    rate: Decimal
    auto_cost: Decimal
    cost: Decimal
    deadline: date | None
    deadline_time: str
    status: str
    notes: str


@dataclass
class WorkPlan:
    id: str
    source_row: int
    service_code: str
    source_language: str
    target_language: str
    topic: str
    urgent: bool
    urgency_multiplier: Decimal
    discount_percent: Decimal
    character_count: int | None
    page_count: Decimal | None
    document_count: int | None
    hour_count: Decimal | None
    certification_mode: str
    billing_unit: str
    client_rate: Decimal
    auto_price: Decimal
    price: Decimal
    deadline: date | None
    deadline_time: str
    status: str
    notes: str
    assignment: AssignmentPlan | None
    # Values the CRM service has no field for; kept in notes unless another work of
    # the same order already stores them.
    deferred_notes: list[tuple[str, str, str]] = field(default_factory=list)


@dataclass
class OrderPlan:
    id: str
    number: str
    year: int
    sequence: int
    source_rows: list[int]
    order_date: date
    client_key: str | None
    contact_id: str | None
    status: str
    notes: str
    works: list[WorkPlan]
    amount_due: Decimal
    amount_paid: Decimal
    payment_method: str
    invoice_number: str
    invoice_date: date | None
    paid_at: date | None
    payment_notes: str
    already_imported: bool = False

    @property
    def deadline(self) -> date | None:
        deadlines = [work.deadline for work in self.works if work.deadline]
        return max(deadlines) if deadlines else None


@dataclass
class Plan:
    orders: list[OrderPlan]
    clients: dict[str, ClientPlan]
    contacts: dict[str, ContactPlan]
    executors: dict[str, ExecutorPlan]
    languages_to_create: list[str]
    counters: dict[int, int]


def _row_error(report: Report, row: SourceRow, column: int, exc: Exception) -> None:
    report.warn("invalid_value", str(exc), row=row.row, column=column + 1, order=row.number or row.values[C_NUMBER])


def _safe(report: Report, row: SourceRow, column: int, parser, default=None):
    try:
        return parser(row.values[column])
    except ValueError as exc:
        _row_error(report, row, column, exc)
        return default


def _language(report: Report, row: SourceRow, column: int) -> tuple[str, str]:
    """Return (catalog language name, note for an unrecognised code)."""
    code = norm_text(row.values[column]).upper()
    if not code:
        return "", ""
    name = LANGUAGE_MAP.get(code)
    if name:
        return name, ""
    report.unmapped["languages"].append(code)
    report.warn("unmapped_language", f"Код языка {code!r} не распознан; язык не заполнен", row=row.row, order=row.number or row.values[C_NUMBER])
    label = "Язык оригинала" if column == C_SRC else "Язык перевода"
    return "", f"{label} в таблице: {code} (код не распознан)"


def _order_number(order_date: date, raw_number: Any) -> tuple[int, int, str]:
    sequence = int(raw_number)
    year = order_date.year
    return year, sequence, format_order_number(year, sequence)


def _quantities(service_code: str, certification_mode: str, chars: int | None, pages: Decimal | None):
    """Map the spreadsheet volume columns onto the CRM fields each service owns."""
    character_count = page_count = document_count = hour_count = None
    if service_code in {"written_translation", "editing", "proofreading", "typing", "transcription"}:
        character_count, page_count = chars, pages
    elif service_code in {"notarial_certification", "apostille"} or (
        service_code == "company_certification" and certification_mode == "BOUND"
    ):
        document_count = pages
    elif service_code == "consecutive_interpreting":
        hour_count = pages
    elif service_code == "delivery" or service_code == "":
        pass
    else:
        page_count = pages
    return character_count, page_count, document_count, hour_count


def _as_int_count(report: Report, row: SourceRow, value: Decimal | None, label: str) -> tuple[int | None, str]:
    if value is None:
        return None, ""
    if value == value.to_integral_value():
        return int(value), ""
    report.warn("fractional_document_count", f"{label}: дробное количество {value} не помещается в целое поле CRM", row=row.row, order=row.number or row.values[C_NUMBER])
    return None, f"Количество в таблице: {str(value).replace('.', ',')}"


def _auto_amount(unit: str, rate: Decimal, character_count, page_count, document_count, hour_count, multiplier: Decimal = Decimal("1")) -> Decimal:
    if unit == "FIXED":
        quantity = Decimal("1")
    elif unit in {"CONDITIONAL_PAGE", "PER_PAGE"}:
        quantity = Decimal(page_count or 0)
    elif unit == "PER_DOCUMENT":
        quantity = Decimal(document_count or 0)
    elif unit == "HOURLY":
        quantity = Decimal(hour_count or 0)
    else:
        quantity = Decimal("0")
    return money(money(quantity * rate) * multiplier)


def build_plan(db: Session, rows: list[SourceRow], report: Report) -> Plan:
    groups: dict[Any, list[SourceRow]] = {}
    order_of_groups: list[Any] = []
    previous = object()
    for row in rows:
        number = row.values[C_NUMBER]
        if number in groups and number != previous:
            report.conflicts.append({"type": "non_contiguous_order_rows", "order": number, "row": row.row})
        if number not in groups:
            groups[number] = []
            order_of_groups.append(number)
        groups[number].append(row)
        previous = number
    report.counts["source_orders_unique"] = len(groups)

    active_services = set(db.scalars(select(ServiceType.code).where(ServiceType.active.is_(True))).all())
    catalog = set(db.scalars(select(LanguageCatalog.name)).all())

    clients: dict[str, ClientPlan] = {}
    contacts: dict[str, ContactPlan] = {}
    executors: dict[str, ExecutorPlan] = {}
    orders: list[OrderPlan] = []
    languages_needed: set[str] = set()
    service_usage: Counter = Counter()
    status_usage: Counter = Counter()
    language_usage: Counter = Counter()

    for raw_number in order_of_groups:
        group = groups[raw_number]
        head = group[0]
        order_date = _safe(report, head, C_DATE, to_date)
        if order_date is None:
            report.invalid_rows.append({"row": head.row, "order": raw_number, "reason": "нет даты заказа"})
            report.conflicts.append({"type": "order_without_date", "order": raw_number})
            continue
        try:
            year, sequence, number = _order_number(order_date, raw_number)
        except Exception as exc:  # noqa: BLE001 - reported, import aborts on conflicts
            report.conflicts.append({"type": "invalid_order_number", "order": raw_number, "error": str(exc)})
            continue
        for row in group:
            row.number = number

        for column, label in ((C_DATE, "дата"), (C_COMPANY, "компания"), (C_CONTACT, "контактное лицо")):
            if len({norm_text(r.values[column]) for r in group}) > 1:
                report.conflicts.append({"type": "order_field_differs_between_rows", "order": number, "field": label})

        # ---------------------------------------------------------------- client
        company_name = norm_text(head.values[C_COMPANY])
        contact_name = norm_text(head.values[C_CONTACT])
        client_key = contact_id = None
        if company_name == "ч/л":
            if contact_name:
                client_key = f"individual:{match_key(contact_name)}"
                client_name, client_kind = contact_name, "individual"
            else:
                report.warn("individual_without_name", "Частное лицо без имени — клиент не указан", order=number)
        elif company_name:
            client_key = f"company:{match_key(company_name)}"
            client_name, client_kind = company_name, "company"
        else:
            report.warn("order_without_client", "В заказе не указан клиент", order=number)
        if client_key:
            if client_key not in clients:
                clients[client_key] = ClientPlan(_uuid("client", client_key), client_key, client_name, client_kind, order_date)
            else:
                clients[client_key].first_date = min(clients[client_key].first_date, order_date)
            if client_kind == "company" and contact_name:
                contact_key = f"{client_key}|{match_key(contact_name)}"
                if contact_key not in contacts:
                    contacts[contact_key] = ContactPlan(_uuid("contact", contact_key), clients[client_key].id, contact_name, order_date)
                else:
                    contacts[contact_key].first_date = min(contacts[contact_key].first_date, order_date)
                contact_id = contacts[contact_key].id

        # ---------------------------------------------------------------- status
        raw_statuses = [norm_text(r.values[C_STATUS]).lower() for r in group]
        for raw in raw_statuses:
            status_usage[raw] += 1
            if raw not in ORDER_STATUS_MAP:
                report.unmapped["statuses"].append(raw)
                report.conflicts.append({"type": "unmapped_status", "order": number, "status": raw})
        mapped = [ORDER_STATUS_MAP.get(raw, "NEW") for raw in raw_statuses]
        live = [status for status in mapped if status != "CANCELLED"]
        if not live:
            order_status = "CANCELLED"
        elif len(set(live)) == 1:
            order_status = live[0]
        else:
            order_status = "IN_PROGRESS"
            report.warn("mixed_row_statuses", f"Разные статусы строк {sorted(set(raw_statuses))} → заказ «В работе»", order=number)

        # ---------------------------------------------------------------- notes
        order_comments = [norm_text(r.values[C_ORDER_COMMENT]) for r in group]
        shared_comment = order_comments[0] if len(set(order_comments)) == 1 else ""
        order_notes = shared_comment

        # ---------------------------------------------------------------- works
        works: list[WorkPlan] = []
        for index, row in enumerate(group, start=1):
            values = row.values
            service_label = norm_text(values[C_SERVICE]).lower()
            price = _safe(report, row, C_PRICE, to_decimal, Decimal("0")) or Decimal("0")
            executor_name = norm_text(values[C_EXECUTOR])
            if not service_label and price == 0 and not executor_name:
                report.counts["works_empty_rows_skipped"] += 1
                report.warn("empty_work_row", "Строка без услуги, суммы и исполнителя — работа не создана", row=row.row, order=number)
                continue
            if service_label and service_label not in SERVICE_MAP:
                report.unmapped["services"].append(service_label)
                report.conflicts.append({"type": "unmapped_service", "order": number, "row": row.row, "service": service_label})
                continue
            service_code = SERVICE_MAP.get(service_label, "")
            service_usage[service_label or "(не указана)"] += 1
            if service_code and service_code not in active_services:
                report.conflicts.append({"type": "service_missing_in_crm", "service": service_code})

            rate = _safe(report, row, C_RATE, to_decimal, Decimal("0")) or Decimal("0")
            multiplier = _safe(report, row, C_MULTIPLIER, to_decimal, Decimal("1"))
            multiplier = Decimal("1") if multiplier in (None, Decimal("0")) else multiplier
            chars_value = _safe(report, row, C_CHARS, to_decimal)
            chars = int(chars_value) if chars_value is not None else None
            pages = _safe(report, row, C_PAGES, to_decimal)

            certification_mode = ""
            if service_code == "company_certification":
                certification_mode = "PER_PAGE" if rate in COMPANY_CERT_PER_PAGE_RATES else "BOUND"
            unit = billing_unit_for(service_code, certification_mode) if service_code else "FIXED"
            if not definition_for(service_code) and service_code:
                report.conflicts.append({"type": "service_without_definition", "service": service_code})
            character_count, page_count, document_count, hour_count = _quantities(service_code, certification_mode, chars, pages)
            note_lines: list[str] = []
            deferred: list[tuple[str, str, str]] = []
            if SERVICE_LABEL_NOTES.get(service_label):
                note_lines.append(f"Услуга в таблице: {SERVICE_LABEL_NOTES[service_label]}")
            if document_count is not None:
                document_count, extra_note = _as_int_count(report, row, Decimal(document_count), "Документы")
                if extra_note:
                    note_lines.append(extra_note)

            source_language, src_note = _language(report, row, C_SRC)
            target_language, tgt_note = _language(report, row, C_TGT)
            note_lines += [n for n in (src_note, tgt_note) if n]
            definition = definition_for(service_code)
            # A service without language fields (e.g. certification) keeps the value in notes.
            fields = set(definition["fields"]) if definition else set()
            if definition and source_language and "source_language" not in fields:
                deferred.append(("language", source_language, f"Язык оригинала в таблице: {source_language}"))
                source_language = ""
            if definition and target_language and "target_language" not in fields:
                deferred.append(("language", target_language, f"Язык перевода в таблице: {target_language}"))
                target_language = ""
            for language in (source_language, target_language):
                if language:
                    languages_needed.add(language)
                    language_usage[language] += 1

            urgent = multiplier > 1
            urgency_multiplier = multiplier if urgent else Decimal("1")
            discount_percent = money((Decimal("1") - multiplier) * Decimal("100")) if multiplier < 1 else Decimal("0")
            base = _auto_amount(unit, rate, character_count, page_count, document_count, hour_count, urgency_multiplier)
            auto_price = money(base * (Decimal("1") - discount_percent / Decimal("100")))
            if auto_price != money(price):
                report.counts["works_price_differs_from_formula"] += 1
                report.warn("historical_price_kept", f"Сумма {price} отличается от расчёта по формуле {auto_price}; сохранена сумма из таблицы", row=row.row, order=number)

            row_comment = norm_text(values[C_ORDER_COMMENT])
            document = norm_text(values[C_DOCUMENT])
            if document:
                note_lines.insert(0, f"Документ: {document}")
            if row_comment and not shared_comment:
                note_lines.append(f"Комментарий: {row_comment}")
            topic = norm_text(values[C_TOPIC])
            if definition and "topic" not in definition["fields"] and topic:
                deferred.append(("topic", topic, f"Тематика в таблице: {topic}"))
                topic = ""

            work_status = WORK_STATUS_MAP.get(norm_text(values[C_STATUS]).lower(), "NEW")
            work_id = _uuid("work", f"{number}#{index}")

            assignment = None
            if executor_name:
                exec_key = match_key(executor_name)
                if exec_key not in executors:
                    executors[exec_key] = ExecutorPlan(_uuid("executor", exec_key), exec_key, executor_name, Counter(), order_date)
                executors[exec_key].variants[executor_name] += 1
                executors[exec_key].first_date = min(executors[exec_key].first_date, order_date)
                exec_rate = _safe(report, row, C_EXEC_RATE, to_decimal, Decimal("0")) or Decimal("0")
                exec_chars_value = _safe(report, row, C_EXEC_CHARS, to_decimal)
                exec_pages = _safe(report, row, C_EXEC_PAGES, to_decimal)
                exec_cost = _safe(report, row, C_EXEC_COST, to_decimal, Decimal("0")) or Decimal("0")
                exec_chars = int(exec_chars_value) if exec_chars_value is not None else None
                a_chars, a_pages, a_docs, a_hours = _quantities(service_code, certification_mode, exec_chars, exec_pages)
                assignment_notes = [norm_text(values[C_EXEC_COMMENT])] if norm_text(values[C_EXEC_COMMENT]) else []
                if a_docs is not None:
                    a_docs, extra_note = _as_int_count(report, row, Decimal(a_docs), "Документы исполнителя")
                    if extra_note:
                        assignment_notes.append(extra_note)
                try:
                    exec_deadline = to_date(values[C_EXEC_DEADLINE])
                except ValueError:
                    exec_deadline = None
                    assignment_notes.append(f"Срок исполнителя в таблице: {norm_text(values[C_EXEC_DEADLINE])}")
                    report.warn("invalid_date", f"Некорректная дата сдачи исполнителя {values[C_EXEC_DEADLINE]!r}", row=row.row, order=number)
                exec_time = _safe(report, row, C_EXEC_DEADLINE_TIME, to_hhmm, "")
                auto_cost = _auto_amount(unit, exec_rate, a_chars, a_pages, a_docs, a_hours)
                if auto_cost != money(exec_cost):
                    report.counts["assignments_cost_differs_from_formula"] += 1
                assignment = AssignmentPlan(
                    id=_uuid("assignment", f"{number}#{index}"),
                    executor_key=exec_key,
                    character_count=a_chars,
                    page_count=a_pages,
                    document_count=a_docs,
                    hour_count=a_hours,
                    billing_unit=unit,
                    rate=exec_rate,
                    auto_cost=auto_cost,
                    cost=money(exec_cost),
                    deadline=exec_deadline,
                    deadline_time=exec_time,
                    status=work_status,
                    notes="\n".join(assignment_notes),
                )

            works.append(WorkPlan(
                id=work_id,
                source_row=row.row,
                service_code=service_code,
                source_language=source_language,
                target_language=target_language,
                topic=topic[:160],
                urgent=urgent,
                urgency_multiplier=urgency_multiplier,
                discount_percent=discount_percent,
                character_count=character_count,
                page_count=page_count,
                document_count=document_count,
                hour_count=hour_count,
                certification_mode=certification_mode,
                billing_unit=unit,
                client_rate=rate,
                auto_price=auto_price,
                price=money(price),
                deadline=_safe(report, row, C_DEADLINE, to_date),
                deadline_time=_safe(report, row, C_DEADLINE_TIME, to_hhmm, ""),
                status=work_status,
                notes="\n".join(note_lines),
                assignment=assignment,
                deferred_notes=deferred,
            ))

        stored_topics = {work.topic for work in works if work.topic}
        stored_languages = {lang for work in works for lang in (work.source_language, work.target_language) if lang}
        for work in works:
            for kind, value, text in work.deferred_notes:
                stored = stored_topics if kind == "topic" else stored_languages
                if value not in stored:
                    work.notes = "\n".join(part for part in (work.notes, text) if part)

        # ---------------------------------------------------------------- payment
        amount_due = money(sum((work.price for work in works), Decimal("0")))
        methods = [PAYMENT_METHOD_MAP.get(norm_text(r.values[C_METHOD]).lower(), "") for r in group]
        payment_method = methods[0]
        payment_notes: list[str] = []
        if len(set(methods)) > 1:
            labels = {"cashless": "безналичный", "cash": "наличные", "deposit": "депозит"}
            payment_notes.append("Способы оплаты по работам: " + ", ".join(labels.get(m, m) for m in methods))
        for raw in {norm_text(r.values[C_METHOD]) for r in group}:
            if raw and raw.lower() not in PAYMENT_METHOD_MAP:
                report.unmapped["payment_methods"].append(raw)
        invoice_number, invoice_date = "", None
        invoices = sorted({norm_text(r.values[C_INVOICE]) for r in group} - {""})
        if invoices:
            match = INVOICE_RE.match(invoices[0].replace("\n", " "))
            if match:
                invoice_number = match.group("number")
                raw_date = match.group("date")
                if raw_date:
                    try:
                        invoice_date = datetime.strptime(raw_date, "%d.%m.%y" if len(raw_date) == 8 else "%d.%m.%Y").date()
                    except ValueError:
                        payment_notes.append(f"Счёт в таблице: {invoices[0]}")
                        report.warn("invalid_date", f"Некорректная дата счёта {raw_date!r}; сохранена в примечании", order=number)
            else:
                invoice_number = invoices[0][:80]
                report.warn("invoice_unparsed", f"Счёт {invoices[0]!r} сохранён как текст", order=number)
            if len(invoices) > 1:
                payment_notes.append("Счета: " + "; ".join(invoices))
        paid_dates = sorted({v for v in (r.values[C_PAID_AT] for r in group) if isinstance(v, datetime | date)})
        paid_marker = any(norm_text(r.values[C_PAID_AT]) == "." for r in group)
        paid_at = to_date(paid_dates[-1]) if paid_dates else None
        if len(paid_dates) > 1:
            payment_notes.append("Даты оплаты: " + ", ".join(to_date(d).strftime("%d.%m.%Y") for d in paid_dates))
        comments = []
        for r in group:
            comment = norm_text(r.values[C_PAYMENT_COMMENT])
            if comment and comment not in comments:
                comments.append(comment)
        payment_notes.extend(comments)

        if paid_at:
            amount_paid = amount_due
        elif paid_marker and order_status in EXECUTED_ORDER_STATUSES:
            # "." in the payment-date column: settled without a separate payment date
            # (almost always deposit clients).
            amount_paid = amount_due
            report.counts["orders_paid_by_marker"] += 1
        else:
            amount_paid = Decimal("0")
            if paid_marker:
                report.warn("paid_marker_ignored", "Отметка «.» в дате оплаты у неисполненного заказа — оплата не проставлена", order=number)
            prepaid = [PREPAYMENT_RE.search(c) for c in comments]
            prepaid_amounts = [to_decimal(m.group("amount").strip()) for m in prepaid if m]
            if prepaid_amounts and order_status != "CANCELLED":
                amount_paid = money(min(amount_due, sum(prepaid_amounts, Decimal("0"))))
                report.warn("prepayment_from_comment", f"Оплата {amount_paid} взята из комментария к оплате", order=number)

        orders.append(OrderPlan(
            id=_uuid("order", number),
            number=number,
            year=year,
            sequence=sequence,
            source_rows=[r.row for r in group],
            order_date=order_date,
            client_key=client_key,
            contact_id=contact_id,
            status=order_status,
            notes=order_notes,
            works=works,
            amount_due=amount_due,
            amount_paid=amount_paid,
            payment_method=payment_method,
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            paid_at=paid_at,
            payment_notes="\n".join(payment_notes),
        ))

    # Executor display name: most frequent spelling in the source.
    for plan in executors.values():
        plan.name = plan.variants.most_common(1)[0][0]
        if len(plan.variants) > 1:
            report.warn("executor_spelling_merged", f"Варианты написания объединены: {sorted(plan.variants)} → {plan.name}")
    _flag_similar_executors(executors, report)

    counters: dict[int, int] = {}
    for order in orders:
        counters[order.year] = max(counters.get(order.year, 0), order.sequence)

    report.mappings = {
        "services": {label: SERVICE_MAP.get(label, "") for label in sorted(service_usage)},
        "service_usage": dict(service_usage),
        "order_statuses": {raw: ORDER_STATUS_MAP.get(raw) for raw in sorted(status_usage)},
        "work_statuses": {raw: WORK_STATUS_MAP.get(raw) for raw in sorted(status_usage)},
        "languages": {code: name for code, name in LANGUAGE_MAP.items()},
        "language_usage": dict(language_usage),
        "payment_methods": PAYMENT_METHOD_MAP,
    }
    languages_to_create = sorted(languages_needed - catalog)
    return Plan(orders, clients, contacts, executors, languages_to_create, counters)


def _flag_similar_executors(executors: dict[str, ExecutorPlan], report: Report) -> None:
    """Report (never merge) executors whose base names coincide, e.g. "Арина" / "Арина (LGC)"."""
    by_base: dict[str, list[str]] = defaultdict(list)
    for plan in executors.values():
        base = re.sub(r"\s*\(.*?\)\s*", "", plan.key).strip()
        by_base[base].append(plan.name)
    for names in by_base.values():
        if len(names) > 1:
            report.warn("possible_duplicate_executor", f"Похожие исполнители оставлены раздельно: {sorted(names)}")


# --------------------------------------------------------------------------- resolve


def resolve_existing(db: Session, plan: Plan, report: Report) -> None:
    """Match plan entities to existing CRM rows and detect conflicts (read-only)."""
    for client in plan.clients.values():
        if db.get(Company, client.id):
            client.existing = True
            report.counts["clients_already_imported"] += 1
            continue
        candidates = [
            row for row in db.scalars(select(Company).where(Company.kind == client.kind)).all()
            if match_key(row.name) == match_key(client.name)
        ]
        if len(candidates) > 1:
            report.conflicts.append({"type": "ambiguous_existing_client", "client": client.name, "ids": [c.id for c in candidates]})
        elif candidates:
            report.counts["clients_matched_existing"] += 1
            report.warn("client_matched_existing", f"Клиент «{client.name}» сопоставлен с существующим клиентом CRM")
            client.id, client.existing = candidates[0].id, True
    # Contacts belong to the (possibly remapped) client id.
    for key, contact in plan.contacts.items():
        client_key = key.split("|", 1)[0]
        contact.client_id = plan.clients[client_key].id
        if db.get(Representative, contact.id):
            contact.existing = True
            continue
        candidates = [
            row for row in db.scalars(select(Representative).where(Representative.company_id == contact.client_id)).all()
            if match_key(row.name) == match_key(contact.name)
        ]
        if len(candidates) > 1:
            report.conflicts.append({"type": "ambiguous_existing_contact", "contact": contact.name})
        elif candidates:
            old_id = contact.id
            contact.id, contact.existing = candidates[0].id, True
            for order in plan.orders:
                if order.contact_id == old_id:
                    order.contact_id = contact.id
    for executor in plan.executors.values():
        if db.get(Executor, executor.id):
            executor.existing = True
            report.counts["executors_already_imported"] += 1
            continue
        candidates = [row for row in db.scalars(select(Executor)).all() if match_key(row.name) == executor.key]
        if len(candidates) > 1:
            report.conflicts.append({"type": "ambiguous_existing_executor", "executor": executor.name})
        elif candidates:
            report.counts["executors_matched_existing"] += 1
            report.warn("executor_matched_existing", f"Исполнитель «{executor.name}» сопоставлен с существующим исполнителем CRM")
            executor.id, executor.existing = candidates[0].id, True

    existing_by_number = {
        row.number: row
        for row in db.scalars(select(Order).where(Order.number.in_([o.number for o in plan.orders]))).all()
    }
    for order in plan.orders:
        existing = existing_by_number.get(order.number)
        if existing is None:
            if db.get(Order, order.id):
                report.conflicts.append({"type": "imported_order_renumbered", "order": order.number})
            continue
        if existing.id != order.id:
            report.conflicts.append({
                "type": "order_number_taken",
                "order": order.number,
                "message": "В CRM уже есть другой заказ с этим номером; он не будет перезаписан",
            })
            continue
        order.already_imported = True
        work_count = db.scalar(select(func.count()).select_from(OrderWork).where(OrderWork.order_id == order.id)) or 0
        payment = db.scalar(select(ClientPayment).where(ClientPayment.order_id == order.id))
        if work_count != len(order.works) or not payment or money(Decimal(str(payment.amount_due))) != order.amount_due:
            report.conflicts.append({
                "type": "imported_order_differs",
                "order": order.number,
                "message": "Заказ уже импортирован, но отличается от таблицы; автоматическая перезапись запрещена",
            })

    # A counter that is already beyond an imported number means CRM issued numbers
    # in that range; any collision is caught above, the rest is reported.
    for year, max_sequence in plan.counters.items():
        row = db.get(OrderCounter, year)
        if row and row.value > max_sequence:
            report.warn("counter_already_higher", f"Счётчик {year} уже {row.value} (> {max_sequence}); не понижается")

    # Existing deposit/payment state is never touched; record the baseline.
    report.extra["baseline"] = {
        "orders": db.scalar(select(func.count()).select_from(Order)) or 0,
        "clients": db.scalar(select(func.count()).select_from(Company)) or 0,
        "executors": db.scalar(select(func.count()).select_from(Executor)) or 0,
        "deposit_transactions": db.scalar(select(func.count()).select_from(ClientDepositTransaction)) or 0,
        "deposit_balance_total": str(money(Decimal(str(db.scalar(select(func.coalesce(func.sum(Company.deposit_balance), 0))) or 0)))),
        "counters": {row.id: row.value for row in db.scalars(select(OrderCounter)).all()},
    }


def summarize(plan: Plan, report: Report) -> None:
    new_orders = [o for o in plan.orders if not o.already_imported]
    report.counts["orders_planned"] = len(plan.orders)
    report.counts["orders_to_create"] = len(new_orders)
    report.counts["orders_already_imported"] = len(plan.orders) - len(new_orders)
    report.counts["works_to_create"] = sum(len(o.works) for o in new_orders)
    report.counts["works_planned"] = sum(len(o.works) for o in plan.orders)
    report.counts["assignments_to_create"] = sum(1 for o in new_orders for w in o.works if w.assignment)
    report.counts["clients_in_source"] = len(plan.clients)
    report.counts["clients_to_create"] = sum(1 for c in plan.clients.values() if not c.existing)
    report.counts["contacts_in_source"] = len(plan.contacts)
    report.counts["contacts_to_create"] = sum(1 for c in plan.contacts.values() if not c.existing)
    report.counts["executors_in_source"] = len(plan.executors)
    report.counts["executors_to_create"] = sum(1 for e in plan.executors.values() if not e.existing)
    report.counts["languages_to_create"] = len(plan.languages_to_create)
    report.counts["orders_multi_work"] = sum(1 for o in plan.orders if len(o.works) > 1)
    report.counts["orders_cancelled"] = sum(1 for o in plan.orders if o.status == "CANCELLED")
    by_year = defaultdict(list)
    for order in plan.orders:
        by_year[order.year].append(order.sequence)
    report.extra["numbering"] = {
        str(year): {
            "count": len(seqs),
            "first": format_order_number(year, min(seqs)),
            "last": format_order_number(year, max(seqs)),
            "missing_sequences": sorted(set(range(min(seqs), max(seqs) + 1)) - set(seqs)),
            "counter_after_import": plan.counters[year],
            "expected_next_number": format_order_number(year, plan.counters[year] + 1),
        }
        for year, seqs in sorted(by_year.items())
    }
    report.extra["languages_to_create"] = plan.languages_to_create
    report.extra["financial_totals"] = {
        "amount_due": str(sum((o.amount_due for o in plan.orders), Decimal("0"))),
        "amount_paid": str(sum((o.amount_paid for o in plan.orders), Decimal("0"))),
        "executor_cost": str(sum((w.assignment.cost for o in plan.orders for w in o.works if w.assignment), Decimal("0"))),
    }
    report.extra["executors"] = sorted(e.name for e in plan.executors.values())
    report.extra["clients"] = sorted(f"{c.name} ({c.kind})" for c in plan.clients.values())


# --------------------------------------------------------------------------- write


def _lock_counters(db: Session, years: list[int]) -> None:
    """Serialise with live order creation until this transaction commits."""
    for year in sorted(years):
        _ensure_year_counter(db, year)
    db.flush()
    query = select(OrderCounter).where(OrderCounter.id.in_(years))
    if db.get_bind().dialect.name == "postgresql":
        query = query.with_for_update()
    db.execute(query).all()


def raise_counters(db: Session, counters: dict[int, int]) -> None:
    for year, max_sequence in counters.items():
        _ensure_year_counter(db, year)
        db.execute(
            update(OrderCounter)
            .where(OrderCounter.id == year)
            .values(value=case((OrderCounter.value < max_sequence, max_sequence), else_=OrderCounter.value))
        )


def write_plan(db: Session, plan: Plan, report: Report, actor_user_id: str | None, source_name: str) -> None:
    now = datetime.now(UTC)
    for index, name in enumerate(plan.languages_to_create, start=1):
        if not db.scalar(select(LanguageCatalog).where(LanguageCatalog.name == name)):
            db.add(LanguageCatalog(id=_uuid("language", name), name=name, active=True, sort_order=1000 + index * 10, created_at=now, updated_at=now))
            report.counts["languages_created"] += 1

    for client in plan.clients.values():
        if client.existing:
            report.counts["clients_reused"] += 1
            continue
        stamp = historical_timestamp(client.first_date)
        db.add(Company(id=client.id, name=client.name[:200], kind=client.kind, created_at=stamp, updated_at=stamp))
        report.counts["clients_created"] += 1
    db.flush()
    for contact in plan.contacts.values():
        if contact.existing:
            report.counts["contacts_reused"] += 1
            continue
        stamp = historical_timestamp(contact.first_date)
        db.add(Representative(id=contact.id, company_id=contact.client_id, name=contact.name[:160], created_at=stamp, updated_at=stamp))
        report.counts["contacts_created"] += 1
    for executor in plan.executors.values():
        if executor.existing:
            report.counts["executors_reused"] += 1
            continue
        stamp = historical_timestamp(executor.first_date)
        db.add(Executor(id=executor.id, name=executor.name[:200], created_at=stamp, updated_at=stamp))
        report.counts["executors_created"] += 1
    db.flush()

    for order in plan.orders:
        if order.already_imported:
            report.counts["orders_skipped_already_imported"] += 1
            continue
        stamp = historical_timestamp(order.order_date)
        client_id = plan.clients[order.client_key].id if order.client_key else None
        db.add(Order(
            id=order.id, number=order.number, title=order.number, client_id=client_id,
            contact_id=order.contact_id, manager_id=None, application_id=None,
            deadline=order.deadline, status=order.status, notes=order.notes,
            archived=order.status == "CANCELLED", created_at=stamp, updated_at=stamp,
        ))
        db.flush()
        for position, work in enumerate(order.works, start=1):
            assignment = work.assignment
            executor_id = plan.executors[assignment.executor_key].id if assignment else None
            db.add(OrderWork(
                id=work.id, order_id=order.id, work_type=work.service_code or "custom",
                service_code=work.service_code, source_language=work.source_language,
                target_language=work.target_language, topic=work.topic, urgent=work.urgent,
                urgency_multiplier=work.urgency_multiplier, native_speaker=False,
                discount_percent=work.discount_percent, discount_overridden=work.discount_percent > 0,
                tariff_ids="", character_count=work.character_count, page_count=work.page_count,
                document_count=work.document_count, hour_count=work.hour_count,
                certification_mode=work.certification_mode, billing_unit=work.billing_unit,
                client_rate=work.client_rate, auto_price=work.auto_price, price=work.price,
                price_overridden=work.price != work.auto_price,
                price_override_reason=HISTORICAL_PRICE_REASON if work.price != work.auto_price else "",
                client_billable=True, executor_id=executor_id,
                executor_rate=assignment.rate if assignment else Decimal("0"),
                executor_billing_unit=assignment.billing_unit if assignment else "CUSTOM",
                executor_auto_cost=assignment.auto_cost if assignment else Decimal("0"),
                executor_cost=assignment.cost if assignment else Decimal("0"),
                executor_cost_overridden=bool(assignment and assignment.cost != assignment.auto_cost),
                deadline=work.deadline, deadline_time=work.deadline_time,
                executor_deadline=assignment.deadline if assignment else None,
                executor_deadline_time=assignment.deadline_time if assignment else "",
                status=work.status, sort_order=position * 10, notes=work.notes,
                created_at=stamp, updated_at=stamp,
            ))
            db.flush()
            if assignment:
                db.add(ExecutorAssignment(
                    id=assignment.id, work_id=work.id, executor_id=executor_id,
                    character_count=assignment.character_count, page_count=assignment.page_count,
                    document_count=assignment.document_count, hour_count=assignment.hour_count,
                    billing_unit=assignment.billing_unit, rate=assignment.rate,
                    auto_cost=assignment.auto_cost, cost=assignment.cost,
                    cost_overridden=assignment.cost != assignment.auto_cost,
                    amount_paid=Decimal("0"), paid_at=None, deadline=assignment.deadline,
                    deadline_time=assignment.deadline_time, status=assignment.status,
                    sort_order=10, notes=assignment.notes, created_at=stamp, updated_at=stamp,
                ))
                report.counts["assignments_created"] += 1
            db.add(ExecutorPayment(
                id=_uuid("executor_payment", work.id), work_id=work.id, executor_id=executor_id,
                amount_due=assignment.cost if assignment else Decimal("0"), amount_paid=Decimal("0"),
                created_at=stamp, updated_at=stamp,
            ))
            report.counts["works_created"] += 1
        db.add(ClientPayment(
            id=_uuid("client_payment", order.number), order_id=order.id,
            amount_due=order.amount_due, amount_paid=order.amount_paid,
            payment_method=order.payment_method, invoice_number=order.invoice_number,
            invoice_date=order.invoice_date, paid_at=order.paid_at, notes=order.payment_notes,
            created_at=stamp, updated_at=stamp,
        ))
        report.counts["orders_created"] += 1

    raise_counters(db, plan.counters)
    if not report.counts["orders_created"]:
        return
    db.add(SecurityAuditEvent(
        actor_user_id=actor_user_id,
        action=IMPORT_ACTION,
        outcome="SUCCESS",
        details={
            "source_file": source_name,
            "orders_created": report.counts["orders_created"],
            "works_created": report.counts["works_created"],
            "clients_created": report.counts["clients_created"],
            "executors_created": report.counts["executors_created"],
            "counters": {str(k): v for k, v in plan.counters.items()},
        },
    ))


# --------------------------------------------------------------------------- verify


def verify(db: Session, plan: Plan, report: Report) -> list[str]:
    """Compare the database against the source plan. Returns a list of failures."""
    failures: list[str] = []
    numbers = [o.number for o in plan.orders]
    duplicates = [n for n, c in Counter(db.scalars(select(Order.number)).all()).items() if c > 1]
    if duplicates:
        failures.append(f"duplicate order numbers in CRM: {duplicates[:10]}")
    for order in plan.orders:
        row = db.get(Order, order.id)
        if row is None or row.number != order.number:
            failures.append(f"{order.number}: order missing or renumbered")
            continue
        client_id = plan.clients[order.client_key].id if order.client_key else None
        if row.client_id != client_id or row.contact_id != order.contact_id:
            failures.append(f"{order.number}: client/contact mismatch")
        if row.status != order.status or row.deadline != order.deadline:
            failures.append(f"{order.number}: status/deadline mismatch")
        if row.created_at.date() != order.order_date:
            failures.append(f"{order.number}: order date mismatch")
        works = db.scalars(select(OrderWork).where(OrderWork.order_id == row.id, OrderWork.archived.is_(False)).order_by(OrderWork.sort_order)).all()
        if [w.id for w in works] != [w.id for w in order.works]:
            failures.append(f"{order.number}: works mismatch ({len(works)} vs {len(order.works)})")
            continue
        for work, expected in zip(works, order.works, strict=True):
            if money(Decimal(str(work.price))) != expected.price or work.service_code != expected.service_code:
                failures.append(f"{order.number}: work row {expected.source_row} price/service mismatch")
            assignments = db.scalars(select(ExecutorAssignment).where(ExecutorAssignment.work_id == work.id)).all()
            if expected.assignment:
                exec_id = plan.executors[expected.assignment.executor_key].id
                if len(assignments) != 1 or assignments[0].executor_id != exec_id or money(Decimal(str(assignments[0].cost))) != expected.assignment.cost:
                    failures.append(f"{order.number}: executor assignment mismatch on row {expected.source_row}")
            elif assignments:
                failures.append(f"{order.number}: unexpected assignment on row {expected.source_row}")
        payment = db.scalar(select(ClientPayment).where(ClientPayment.order_id == row.id))
        if not payment or money(Decimal(str(payment.amount_due))) != order.amount_due or money(Decimal(str(payment.amount_paid))) != order.amount_paid:
            failures.append(f"{order.number}: client payment mismatch")
        if db.scalar(select(func.count()).select_from(ClientDepositTransaction).where(ClientDepositTransaction.order_id == row.id)):
            failures.append(f"{order.number}: unexpected deposit transaction")
    for year, max_sequence in plan.counters.items():
        preview = peek_next_order_number(db, execution_year=year)
        counter = db.get(OrderCounter, year)
        if counter is None or counter.value < max_sequence:
            failures.append(f"counter {year} below imported maximum {max_sequence}")
        report.extra.setdefault("next_numbers", {})[str(year)] = preview
    report.extra["verified_orders"] = len(numbers)
    return failures


# --------------------------------------------------------------------------- cli


def _print_summary(report: Report, mode: str) -> None:
    data = report.as_dict()
    print(f"=== Historical order import: {mode} ===")
    print(f"source: {data['source_file']}  sheets: {data['sheets']}")
    for key, value in data["counts"].items():
        print(f"  {key}: {value}")
    print("numbering:", json.dumps(data.get("numbering", {}), ensure_ascii=False))
    print("financial totals:", json.dumps(data.get("financial_totals", {}), ensure_ascii=False))
    print("languages to create:", data.get("languages_to_create"))
    print("unmapped:", json.dumps(data["unmapped"], ensure_ascii=False))
    print("warning counts:", json.dumps(data["warning_counts"], ensure_ascii=False))
    print(f"conflicts: {len(data['conflicts'])}")
    for conflict in data["conflicts"][:50]:
        print("  CONFLICT", json.dumps(conflict, ensure_ascii=False))


def run(path: Path, *, execute: bool = False, verify_only: bool = False, actor_email: str | None = None,
        report_path: Path | None = None, session_factory=None) -> tuple[int, Report]:
    if session_factory is None:
        from app import db as app_db  # lazy: the engine is created on first use

        session_factory = app_db.SessionLocal
    report = Report(source_file=path.name)
    rows = read_source(path, report)
    mode = "VERIFY" if verify_only else ("EXECUTE" if execute else "DRY-RUN")
    exit_code = 0
    with session_factory() as db:
        plan = build_plan(db, rows, report)
        if verify_only:
            failures = verify(db, plan, report)
            report.extra["verify_failures"] = failures
            summarize(plan, report)
            exit_code = 1 if failures else 0
        else:
            actor_id = None
            if actor_email:
                actor = db.scalar(select(User).where(func.lower(User.email) == actor_email.lower()))
                if not actor:
                    raise SystemExit(f"Пользователь {actor_email} не найден")
                actor_id = actor.id
            if execute:
                _lock_counters(db, list(plan.counters))
            resolve_existing(db, plan, report)
            summarize(plan, report)
            if report.conflicts:
                db.rollback()
                exit_code = 2
            elif execute:
                write_plan(db, plan, report, actor_id, path.name)
                db.flush()
                failures = verify(db, plan, report)
                report.extra["verify_failures"] = failures
                if failures:
                    db.rollback()
                    exit_code = 3
                else:
                    db.commit()
            else:
                db.rollback()
    report.extra["mode"] = mode
    report.extra["result"] = {0: "OK", 1: "VERIFY_FAILED", 2: "ABORTED_CONFLICTS", 3: "ROLLED_BACK_VERIFY_FAILED"}[exit_code]
    if report_path:
        report_path.write_text(json.dumps(report.as_dict(), ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    _print_summary(report, mode)
    print("result:", report.extra["result"])
    return exit_code, report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--file", required=True, type=Path, help="Путь к таблице .xlsx")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--execute", action="store_true", help="Записать данные (без флага — dry-run)")
    group.add_argument("--verify", action="store_true", help="Сверить БД с таблицей, ничего не меняя")
    parser.add_argument("--actor-email", default=None, help="Пользователь для записи в журнале аудита")
    parser.add_argument("--report", type=Path, default=None, help="Куда сохранить JSON-отчёт")
    args = parser.parse_args(argv)
    code, _ = run(args.file, execute=args.execute, verify_only=args.verify, actor_email=args.actor_email, report_path=args.report)
    return code


if __name__ == "__main__":
    sys.exit(main())
