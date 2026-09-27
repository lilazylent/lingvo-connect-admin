"""Dashboard revenue/profit count only orders the client has accepted."""

from decimal import Decimal

from app.db import SessionLocal
from app.operations_models import Order
from tests.test_crm import setup

STATUSES = {
    "NEW": False,
    "ESTIMATING": False,  # «Рассчитан»: waiting for the client's decision
    "APPROVED": True,
    "IN_PROGRESS": True,
    "REVIEW": True,
    "READY": True,
    "DELIVERED": True,
    "COMPLETED": True,
    "CANCELLED": False,
}


def _create_order(client, headers, executor_id, status, price):
    created = client.post(
        "/api/admin/crm/orders/wizard",
        headers=headers,
        json={
            "works": [{
                "price": str(price),
                "executor_assignments": [{"executor_id": executor_id, "cost": str(price * 0.4)}],
            }],
        },
    )
    assert created.status_code == 201, created.text
    order = created.json()
    if status != "NEW":
        changed = client.patch(f"/api/admin/crm/orders/{order['id']}/status", headers=headers, json={"status": status})
        assert changed.status_code == 200, changed.text
    return order


def test_dashboard_revenue_and_profit_use_accepted_statuses_only(client, create_user):
    headers = setup(client, create_user)
    executor = client.post("/api/admin/executors", headers=headers, json={"name": "KPI Исполнитель"}).json()
    # Distinct prices make every status's contribution identifiable in the totals.
    prices = {status: 1000 * (index + 1) for index, status in enumerate(STATUSES)}
    orders = {status: _create_order(client, headers, executor["id"], status, price) for status, price in prices.items()}

    expected_revenue = sum(price for status, price in prices.items() if STATUSES[status])
    expected_cost = sum(price * 0.4 for status, price in prices.items() if STATUSES[status])
    dashboard = client.get("/api/admin/crm/dashboard").json()
    assert Decimal(str(dashboard["revenue"])) == Decimal(expected_revenue)
    assert Decimal(str(dashboard["executor_cost"])) == Decimal(str(expected_cost))
    assert Decimal(str(dashboard["profit"])) == Decimal(str(expected_revenue - expected_cost))

    # A completed order that sits in the archive (e.g. imported history) still counts;
    # the archive flag alone must not change revenue.
    with SessionLocal() as db:
        row = db.get(Order, orders["COMPLETED"]["id"])
        row.archived = True
        db.commit()
    archived = client.get("/api/admin/crm/dashboard").json()
    assert Decimal(str(archived["revenue"])) == Decimal(expected_revenue)
    assert Decimal(str(archived["profit"])) == Decimal(str(expected_revenue - expected_cost))
