"""Historical order migration (app.cli.historical_order_import) on a synthetic sheet."""

from datetime import datetime, time
from decimal import Decimal

import pytest
from openpyxl import Workbook
from sqlalchemy import func, select

from app.cli.historical_order_import import run
from app.client_models import ClientDepositTransaction, Company, Representative
from app.crm_models import ClientPayment, ServiceType
from app.db import SessionLocal
from app.operations_models import Executor, ExecutorAssignment, Order, OrderCounter, OrderWork
from tests.conftest import csrf_headers
from tests.test_auth import complete_first_login

HEADERS = [
    "№ заказа", "дата", "статус", "компания", "контактное лицо", "услуга",
    "кол-во \nзнаков", "кол-во \nстр.", "Язык (с)", "Язык (на)", "тематика", "дата сдачи",
    "время сдачи", "комментарий", "тариф", "скидка/наценка", "коплате", "способ",
    "№ и дата счёта", "дата оплаты", "комментарий", "исполнитель", "дата сдачи",
    "время сдачи", "комментарий", "ставка", "кол-во знаков", "кол-во стр.", "к оплате",
    "Наименование документа",
]


def row(number, day, status, company, contact, service, chars, pages, src, tgt, rate, mult, price,
        method="б/н", invoice=None, paid=None, executor=None, exec_rate=None, exec_pages=None,
        exec_cost=None, document="Документ", comment=None):
    return [
        number, day, status, company, contact, service, chars, pages, src, tgt, "юридическая",
        datetime(2026, 1, 20), time(16, 0), comment, rate, mult, price, method, invoice, paid, None,
        executor, datetime(2026, 1, 19) if executor else None, time(12, 0) if executor else None,
        None, exec_rate, None, exec_pages, exec_cost, document,
    ]


SOURCE_ROWS = [
    # carry-over order from the 2025 numbering series with two works
    row(996, datetime(2025, 12, 25), "сдано", "Тест Компания", "Петров Пётр", "письм. перевод",
        3600, 2, "EN", "RU", 540, 0.9, 972, invoice="Счёт 757\n28.01.26", paid=datetime(2026, 1, 29),
        executor="Исполнитель А", exec_rate=230, exec_pages=2, exec_cost="460,00"),
    row(996, datetime(2025, 12, 25), "сдано", "Тест Компания", "Петров Пётр", "вёрстка текста",
        None, 3, None, None, 140, 1, 420, invoice="Счёт 757\n28.01.26", paid=datetime(2026, 1, 29),
        executor="исполнитель а", exec_rate=50, exec_pages=3, exec_cost=150),
    # 2026 series
    row(1, datetime(2026, 1, 7), "сдано", "ч/л", "Сидорова Анна", "заверение нотар.", None, 2,
        None, None, 800, 1.8, 2880, method="деп", paid=".", executor="Нотариус", exec_rate=290,
        exec_pages=2, exec_cost=580),
    row(2, datetime(2026, 1, 8), "рассчитано", "Тест Компания", "Петров Пётр", "письм. перевод",
        1000, 1, "RU", "DE", 790, 1, 790),
    row(3, datetime(2026, 1, 9), "отменён", "Другая Компания", "Иванов Иван", "курьер", None, 1,
        None, None, 600, 1, 600),
]
TEMPLATE_ROW = [None, None, None, None, None, None, None, 0, None, None, None, None, None, None,
                None, 1, 0, "б/н", None, None, None, None, None, None, None, None, None, 0, 0, None]

SERVICES = [
    ("written_translation", "Письменный перевод", "CONDITIONAL_PAGE"),
    ("text_layout", "Вёрстка текста", "PER_PAGE"),
    ("notarial_certification", "Нотариальное заверение", "PER_DOCUMENT"),
    ("delivery", "Доставка", "FIXED"),
]


@pytest.fixture
def sheet(tmp_path):
    workbook = Workbook()
    ws = workbook.active
    ws.append([None, None, None, "заказчик", None, "заказ"])
    ws.append(HEADERS)
    for values in SOURCE_ROWS:
        ws.append(values)
    for _ in range(3):
        ws.append(TEMPLATE_ROW)
    path = tmp_path / "orders.xlsx"
    workbook.save(path)
    with SessionLocal() as db:
        for index, (code, name, unit) in enumerate(SERVICES):
            db.add(ServiceType(code=code, name=name, billing_mode=unit, sort_order=index))
        db.commit()
    return path


def counts():
    with SessionLocal() as db:
        return {
            model.__tablename__: db.scalar(select(func.count()).select_from(model))
            for model in (Order, OrderWork, Company, Representative, Executor, ExecutorAssignment, ClientPayment)
        }


def test_dry_run_reports_plan_and_writes_nothing(sheet):
    code, report = run(sheet)
    assert code == 0
    data = report.as_dict()
    assert data["counts"]["source_rows_with_data"] == 5
    assert data["counts"]["source_rows_template_skipped"] == 3
    assert data["counts"]["source_orders_unique"] == 4
    assert data["counts"]["orders_to_create"] == 4
    assert data["counts"]["works_to_create"] == 5
    assert data["numbering"]["2026"]["expected_next_number"] == "26-0004"
    assert data["numbering"]["2025"]["first"] == "25-0996"
    assert all(value == 0 for value in counts().values())
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(OrderCounter)) == 0


def test_import_preserves_numbers_groups_rows_and_resolves_entities(sheet):
    code, report = run(sheet, execute=True)
    assert code == 0, report.as_dict()["conflicts"]
    with SessionLocal() as db:
        numbers = sorted(db.scalars(select(Order.number)).all())
        assert numbers == ["25-0996", "26-0001", "26-0002", "26-0003"]
        carry_over = db.scalar(select(Order).where(Order.number == "25-0996"))
        works = db.scalars(select(OrderWork).where(OrderWork.order_id == carry_over.id).order_by(OrderWork.sort_order)).all()
        assert [w.service_code for w in works] == ["written_translation", "text_layout"]
        assert carry_over.created_at.date().isoformat() == "2025-12-25"
        assert works[0].discount_percent == Decimal("10.0000")
        assert works[0].price == Decimal("972.00") and not works[0].price_overridden
        # The same company appears in two orders -> one client, one contact.
        companies = db.scalars(select(Company).order_by(Company.name)).all()
        assert [(c.name, c.kind) for c in companies] == [
            ("Другая Компания", "company"), ("Сидорова Анна", "individual"), ("Тест Компания", "company"),
        ]
        assert db.scalar(select(func.count()).select_from(Representative)) == 2
        # Case-only spelling differences resolve to one executor.
        assert db.scalar(select(func.count()).select_from(Executor)) == 2
        payment = db.scalar(select(ClientPayment).where(ClientPayment.order_id == carry_over.id))
        assert (payment.amount_due, payment.amount_paid, payment.invoice_number) == (Decimal("1392.00"), Decimal("1392.00"), "757")
        urgent = db.scalar(select(Order).where(Order.number == "26-0001"))
        urgent_work = db.scalar(select(OrderWork).where(OrderWork.order_id == urgent.id))
        assert urgent_work.urgent and urgent_work.urgency_multiplier == Decimal("1.8000")
        assert urgent_work.document_count == 2
        cancelled = db.scalar(select(Order).where(Order.number == "26-0003"))
        assert cancelled.status == "CANCELLED" and cancelled.archived
        assert db.get(OrderCounter, 2026).value == 3
        assert db.get(OrderCounter, 2025).value == 996


def test_rerun_is_idempotent_and_verify_passes(sheet):
    assert run(sheet, execute=True)[0] == 0
    before = counts()
    code, report = run(sheet, execute=True)
    assert code == 0
    assert report.as_dict()["counts"]["orders_skipped_already_imported"] == 4
    assert counts() == before
    assert run(sheet, verify_only=True)[0] == 0


def test_foreign_order_with_same_number_aborts_without_writes(sheet):
    with SessionLocal() as db:
        db.add(Order(number="26-0002", title="26-0002"))
        db.commit()
    code, report = run(sheet, execute=True)
    assert code == 2
    assert any(item["type"] == "order_number_taken" for item in report.as_dict()["conflicts"])
    assert counts()["orders"] == 1
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(OrderCounter)) == 0


def test_import_has_no_deposit_side_effects_and_reuses_existing_client(sheet):
    with SessionLocal() as db:
        db.add(Company(name="Тест  компания", kind="company", deposit_balance=Decimal("5000")))
        db.commit()
    assert run(sheet, execute=True)[0] == 0
    with SessionLocal() as db:
        clients = db.scalars(select(Company).where(Company.kind == "company")).all()
        assert len(clients) == 2
        existing = next(c for c in clients if c.name == "Тест  компания")
        assert existing.deposit_balance == Decimal("5000.00")
        assert db.scalar(select(func.count()).select_from(ClientDepositTransaction)) == 0
        deposit_order = db.scalar(select(Order).where(Order.number == "26-0001"))
        payment = db.scalar(select(ClientPayment).where(ClientPayment.order_id == deposit_order.id))
        assert payment.payment_method == "deposit" and payment.amount_paid == Decimal("2880.00")


def test_imported_orders_readable_via_api_and_new_order_continues_numbering(sheet, client, create_user):
    assert run(sheet, execute=True)[0] == 0
    complete_first_login(client, create_user)
    headers = csrf_headers(client)
    listing = client.get("/api/admin/crm/orders?page_size=100").json()
    assert {item["number"] for item in listing["items"]} == {"25-0996", "26-0001", "26-0002"}
    detail = client.get(f"/api/admin/crm/orders/{listing['items'][-1]['id']}").json()
    assert detail["works"] and detail["financial"]["revenue"]
    preview = client.get("/api/admin/crm/orders/number-preview?execution_year=2026").json()
    assert preview["number"] == "26-0004" and preview["reserved"] is False
    created = client.post(
        "/api/admin/crm/orders/wizard", headers=headers, json={"works": [{"deadline": "2026-10-01"}]}
    )
    assert created.status_code == 201, created.text
    assert created.json()["number"] == "26-0004"
