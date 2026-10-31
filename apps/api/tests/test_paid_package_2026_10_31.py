"""Paid upgrade package 2026-10-31 (DOCX v3): order registration, work forms, pricing rules."""

from tests.test_crm import setup


def _order(client, headers, **payload):
    created = client.post("/api/admin/crm/orders/wizard", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    return created.json()


def test_order_deadline_with_time_mode_is_saved_and_reopened(client, create_user):
    headers = setup(client, create_user)
    order = _order(client, headers, deadline="2026-11-06", deadline_time_mode="BY", deadline_time="15:00",
                   works=[{"service_code": "", "work_type": "custom", "billing_unit": "FIXED", "client_rate": "100"}])
    assert (order["deadline"], order["deadline_manual"], order["deadline_time_mode"], order["deadline_time"]) == (
        "2026-11-06", True, "BY", "15:00")
    # a work without its own deadline follows the order deadline
    assert order["works"][0]["deadline"] == "2026-11-06" and order["works"][0]["deadline_time"] == "15:00"

    reopened = client.get(f"/api/admin/crm/orders/{order['id']}").json()
    assert reopened["deadline_time_mode"] == "BY"

    # «в течение дня» drops the time; the manual deadline survives later work edits
    edited = client.patch(f"/api/admin/crm/orders/{order['id']}", headers=headers, json={
        "deadline": "2026-11-07", "deadline_time_mode": "DURING_DAY", "deadline_time": "18:00", "version": reopened["version"],
    })
    assert edited.status_code == 200, edited.text
    assert (edited.json()["deadline"], edited.json()["deadline_time_mode"], edited.json()["deadline_time"]) == ("2026-11-07", "DURING_DAY", "")
    work = edited.json()["works"][0]
    patched = client.patch(f"/api/admin/crm/orders/{order['id']}/works/{work['id']}", headers=headers, json={
        "work_type": "custom", "billing_unit": "FIXED", "client_rate": "100", "deadline": "2026-11-20", "version": work["version"],
    })
    assert patched.status_code == 200, patched.text
    assert client.get(f"/api/admin/crm/orders/{order['id']}").json()["deadline"] == "2026-11-07"


def test_order_without_manual_deadline_keeps_derived_behaviour(client, create_user):
    headers = setup(client, create_user)
    order = _order(client, headers, works=[{"work_type": "custom", "billing_unit": "FIXED", "deadline": "2026-12-01"}])
    assert order["deadline"] == "2026-12-01" and order["deadline_manual"] is False
    assert order["deadline_time_mode"] == "DURING_DAY"
    # editing other details without the deadline keys keeps everything as it was
    edited = client.patch(f"/api/admin/crm/orders/{order['id']}", headers=headers, json={"notes": "x", "version": order["version"]})
    assert edited.status_code == 200, edited.text
    assert edited.json()["deadline"] == "2026-12-01" and edited.json()["deadline_manual"] is False

    # setting and then clearing the manual deadline returns to the works deadline
    manual = client.patch(f"/api/admin/crm/orders/{order['id']}", headers=headers, json={
        "notes": "x", "deadline": "2026-11-15", "deadline_time_mode": "EXACT", "deadline_time": "10:30", "version": edited.json()["version"],
    }).json()
    assert (manual["deadline"], manual["deadline_time_mode"], manual["deadline_time"]) == ("2026-11-15", "EXACT", "10:30")
    cleared = client.patch(f"/api/admin/crm/orders/{order['id']}", headers=headers, json={
        "notes": "x", "deadline": None, "deadline_time_mode": "DURING_DAY", "version": manual["version"],
    }).json()
    assert cleared["deadline"] == "2026-12-01" and cleared["deadline_manual"] is False


def test_invalid_deadline_time_is_rejected(client, create_user):
    headers = setup(client, create_user)
    bad = client.post("/api/admin/crm/orders/wizard", headers=headers, json={"deadline_time_mode": "BY", "deadline_time": "25:00"})
    assert bad.status_code == 422


def test_orders_list_sorted_by_number_newest_first(client, create_user):
    headers = setup(client, create_user)
    for number in ["26-0009", "26-0100", "25-0500"]:
        _order(client, headers, number=number)
    numbers = [item["number"] for item in client.get("/api/admin/crm/orders").json()["items"]]
    assert numbers == ["26-0100", "26-0009", "25-0500"]


def test_directories_are_alphabetical_and_languages_put_russian_and_english_first(client, create_user):
    headers = setup(client, create_user)
    for name in ["Яковлев", "Абрамова", "Мельник"]:
        assert client.post("/api/admin/executors", headers=headers, json={"name": name}).status_code == 201
    assert [row["name"] for row in client.get("/api/admin/executors").json()["items"]] == ["Абрамова", "Мельник", "Яковлев"]

    for code, name in [("zz", "Апостиль"), ("aa", "Вычитка"), ("mm", "Набор текста")]:
        assert client.post("/api/admin/crm/services", headers=headers, json={"code": code, "name": name, "billing_mode": "FIXED"}).status_code == 201
    assert [row["name"] for row in client.get("/api/admin/crm/services").json()] == ["Апостиль", "Вычитка", "Набор текста"]

    for name, order in [("Белорусский", 10), ("Немецкий", 20), ("Английский", 30), ("Арабский", 40), ("Русский", 50)]:
        assert client.post("/api/admin/crm/languages", headers=headers, json={"name": name, "sort_order": order}).status_code == 201
    assert [row["name"] for row in client.get("/api/admin/crm/languages").json()["items"]] == [
        "Русский", "Английский", "Арабский", "Белорусский", "Немецкий",
    ]
