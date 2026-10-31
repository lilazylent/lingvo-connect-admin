"""Bug-fix sprint 2026-10-31 (owner report): regressions for confirmed defects."""

from decimal import Decimal
from types import SimpleNamespace

from app.routers.crm import rank_language_matches
from tests.test_crm import setup


def _service(client, headers, code, name, unit):
    created = client.post("/api/admin/crm/services", headers=headers, json={"code": code, "name": name, "billing_mode": unit})
    assert created.status_code == 201, created.text
    return created.json()


def test_language_search_ranks_exact_and_prefix_matches_first():
    # catalog order puts «Белорусский» before «Русский»; the combobox highlights the first row
    catalog = [SimpleNamespace(name=name) for name in ["Белорусский", "Русский", "Английский"]]
    assert [row.name for row in rank_language_matches(catalog[:2], "рус")] == ["Русский", "Белорусский"]
    assert [row.name for row in rank_language_matches(catalog[:2], " Русский ")] == ["Русский", "Белорусский"]
    # substring-only matches keep the catalog order
    assert [row.name for row in rank_language_matches(catalog, "ск")] == ["Белорусский", "Русский", "Английский"]


def test_language_endpoint_puts_exact_match_first(client, create_user):
    headers = setup(client, create_user)
    for name, order in [("Белорусский", 10), ("Русский", 20)]:
        assert client.post("/api/admin/crm/languages", headers=headers, json={"name": name, "sort_order": order}).status_code == 201
    # (the SQLite test DB matches Cyrillic case-sensitively; PostgreSQL ILIKE does not)
    assert [item["name"] for item in client.get("/api/admin/crm/languages?q=усский").json()["items"]] == ["Белорусский", "Русский"]
    assert [item["name"] for item in client.get("/api/admin/crm/languages").json()["items"]] == ["Белорусский", "Русский"]


def test_work_with_disabled_service_stays_editable(client, create_user):
    headers = setup(client, create_user)
    scan = _service(client, headers, "scan", "Скан", "PER_PAGE")
    order = client.post("/api/admin/crm/orders/wizard", headers=headers, json={
        "status": "COMPLETED",
        "works": [{"service_code": "scan", "billing_unit": "PER_PAGE", "page_count": 3, "client_rate": "50", "status": "NEW"}],
    })
    assert order.status_code == 201, order.text
    work = order.json()["works"][0]

    # the service is retired afterwards (as migration 0024 did for «Скан»)
    disabled = client.patch(f"/api/admin/crm/services/{scan['id']}", headers=headers, json={
        "code": "scan", "name": "Скан", "billing_mode": "PER_PAGE", "active": False,
    })
    assert disabled.status_code == 200, disabled.text

    # the existing work can still be corrected, e.g. its status in a completed order
    edited = client.patch(f"/api/admin/crm/orders/{order.json()['id']}/works/{work['id']}", headers=headers, json={
        "service_code": "scan", "billing_unit": "PER_PAGE", "page_count": 4, "client_rate": "50", "status": "COMPLETED", "version": work["version"],
    })
    assert edited.status_code == 200, edited.text
    assert edited.json()["status"] == "COMPLETED" and Decimal(str(edited.json()["price"])) == Decimal("200.00")

    # but a disabled service is still closed for new works
    created = client.post(f"/api/admin/crm/orders/{order.json()['id']}/works", headers=headers, json={"service_code": "scan", "page_count": 1})
    assert created.status_code == 422


def test_manual_character_count_is_saved_and_repriced(client, create_user):
    headers = setup(client, create_user)
    _service(client, headers, "written_translation", "Письменный перевод", "CONDITIONAL_PAGE")
    assert client.post("/api/admin/crm/tariffs", headers=headers, json={
        "service_code": "written_translation", "source_language": "Английский", "target_language": "Русский",
        "direction": "TO_RUSSIAN", "unit": "CONDITIONAL_PAGE", "amount": "500",
    }).status_code == 201
    base = {"service_code": "written_translation", "source_language": "Английский", "target_language": "Русский"}
    order = client.post("/api/admin/crm/orders/wizard", headers=headers, json={"works": [{**base, "character_count": 3600}]})
    assert order.status_code == 201, order.text
    work = order.json()["works"][0]
    assert Decimal(str(work["page_count"])) == Decimal("2") and Decimal(str(work["price"])) == Decimal("1000.00")

    # the manager corrects the automatically detected volume: pages and price follow
    edited = client.patch(f"/api/admin/crm/orders/{order.json()['id']}/works/{work['id']}", headers=headers, json={
        **base, "character_count": 5400, "version": work["version"],
    })
    assert edited.status_code == 200, edited.text
    reopened = client.get(f"/api/admin/crm/orders/{order.json()['id']}").json()["works"][0]
    assert reopened["character_count"] == 5400
    assert Decimal(str(reopened["page_count"])) == Decimal("3") and Decimal(str(reopened["price"])) == Decimal("1500.00")
