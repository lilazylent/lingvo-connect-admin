"""Paid upgrade package 2026-10-31 (DOCX v3): pricing rules, volumes, per-work documents, topics."""

from decimal import Decimal

from tests.test_crm import setup

EN_RU = {"source_language": "Английский", "target_language": "Русский"}


def D(value) -> Decimal:
    return Decimal(str(value))


def _pricing_setup(client, headers):
    for code, name, unit in [
        ("written_translation", "Письменный перевод", "CONDITIONAL_PAGE"),
        ("proofreading", "Вычитка", "CONDITIONAL_PAGE"),
    ]:
        assert client.post("/api/admin/crm/services", headers=headers, json={"code": code, "name": name, "billing_mode": unit}).status_code == 201
    assert client.post("/api/admin/crm/tariffs", headers=headers, json={
        "service_code": "written_translation", **EN_RU, "direction": "TO_RUSSIAN", "unit": "CONDITIONAL_PAGE", "amount": "500",
    }).status_code == 201


def _order(client, headers, **payload):
    created = client.post("/api/admin/crm/orders/wizard", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    return created.json()


def test_repetitions_get_an_automatic_30_percent_discount_once(client, create_user):
    headers = setup(client, create_user)
    _pricing_setup(client, headers)
    base = {"service_code": "written_translation", "certification_mode": "REPETITIONS", **EN_RU, "character_count": 3600}
    options = client.post("/api/admin/crm/pricing/options", headers=headers, json=base).json()
    auto = next(o for o in options["options"] if o["key"] == options["auto_key"])
    assert (D(auto["rate"]), D(auto["discount_percent"]), D(auto["amount"])) == (D("500.00"), D("30"), D("700.00"))
    assert auto["discount_name"] == "Повторения −30 %"

    order = _order(client, headers, works=[base])
    work = order["works"][0]
    assert (work["certification_mode"], D(work["discount_percent"]), D(work["price"])) == ("REPETITIONS", D("30"), D("700.00"))
    # a manual discount replaces the automatic 30 % (never 30 % + 10 %)
    edited = client.patch(f"/api/admin/crm/orders/{order['id']}/works/{work['id']}", headers=headers, json={
        **base, "discount_percent": 10, "version": work["version"],
    }).json()
    assert (D(edited["discount_percent"]), D(edited["price"])) == (D("10"), D("900.00"))


def test_proofreading_is_priced_by_the_written_grid_minus_30_percent(client, create_user):
    headers = setup(client, create_user)
    _pricing_setup(client, headers)
    work = {"service_code": "proofreading", **EN_RU, "character_count": 1800}
    quote = client.post("/api/admin/crm/pricing/quote", headers=headers, json=work).json()
    assert quote["resolved"] and D(quote["rate"]) == D("350.00") and D(quote["amount"]) == D("350.00")
    order = _order(client, headers, works=[work])
    saved = order["works"][0]
    assert (D(saved["client_rate"]), D(saved["price"]), D(saved["discount_percent"])) == (D("350.00"), D("350.00"), D("0"))
    # the selected tariff id (a written-translation row) is accepted for the proofreading work
    edited = client.patch(f"/api/admin/crm/orders/{order['id']}/works/{saved['id']}", headers=headers, json={
        **work, "character_count": 3600, "tariff_ids": quote["tariff_ids"], "version": saved["version"],
    })
    assert edited.status_code == 200, edited.text
    assert D(edited.json()["price"]) == D("700.00")


def test_executor_volume_has_no_client_minimum(client, create_user):
    headers = setup(client, create_user)
    _pricing_setup(client, headers)
    executor = client.post("/api/admin/executors", headers=headers, json={"name": "Иванов"}).json()
    order = _order(client, headers, works=[{
        "service_code": "written_translation", **EN_RU, "character_count": 180,
        "executor_assignments": [{"executor_id": executor["id"], "character_count": 180, "billing_unit": "CONDITIONAL_PAGE", "rate": "230"}],
    }])
    work = order["works"][0]
    # the client pays at least 1 conditional page, the executor 0.1 page
    assert D(work["page_count"]) == D("1") and D(work["price"]) == D("500.00")
    assignment = work["executor_assignments"][0]
    assert D(assignment["page_count"]) == D("0.1") and D(assignment["cost"]) == D("23.00")


def test_final_volume_reprices_and_keeps_provenance(client, create_user):
    headers = setup(client, create_user)
    _pricing_setup(client, headers)
    work = {"service_code": "written_translation", **EN_RU, "character_count": 3600, "character_count_source": "AUTO",
            "measured_character_count": 3600, "document_names": "Договор; Приложение", "document_names_source": "AUTO"}
    order = _order(client, headers, works=[work])
    saved = order["works"][0]
    assert (saved["character_count_source"], saved["measured_character_count"], saved["final_character_count"], saved["final_volume_at"]) == ("AUTO", 3600, None, None)
    assert saved["document_names"] == "Договор; Приложение" and D(saved["price"]) == D("1000.00")

    final = client.patch(f"/api/admin/crm/orders/{order['id']}/works/{saved['id']}", headers=headers, json={
        **work, "final_character_count": 5400, "version": saved["version"],
    }).json()
    # the preliminary volume and its source stay; the price follows the final volume
    assert (final["character_count"], final["character_count_source"], final["final_character_count"]) == (3600, "AUTO", 5400)
    assert final["final_volume_at"] and D(final["page_count"]) == D("3") and D(final["price"]) == D("1500.00")


def test_legacy_work_keeps_unknown_volume_source(client, create_user):
    headers = setup(client, create_user)
    _pricing_setup(client, headers)
    order = _order(client, headers, works=[{"service_code": "written_translation", **EN_RU, "character_count": 1800}])
    assert order["works"][0]["character_count_source"] == ""


def test_client_documents_attach_to_a_work(client, create_user):
    headers = setup(client, create_user)
    _pricing_setup(client, headers)
    order = _order(client, headers, works=[{"service_code": "written_translation", **EN_RU}])
    work_id = order["works"][0]["id"]
    path = f"/api/admin/crm/orders/{order['id']}/files/analyze"
    uploaded = client.post(path, headers=headers, data={"work_id": work_id}, files={"upload": ("passport.txt", b"hello world", "text/plain")})
    assert uploaded.status_code == 201, uploaded.text
    assert uploaded.json()["work_id"] == work_id
    order_level = client.post(path, headers=headers, files={"upload": ("brief.txt", b"x", "text/plain")})
    assert order_level.status_code == 201 and order_level.json()["work_id"] is None
    foreign = client.post(path, headers=headers, data={"work_id": "missing"}, files={"upload": ("x.txt", b"x", "text/plain")})
    assert foreign.status_code == 422
    files = client.get(f"/api/admin/crm/orders/{order['id']}").json()["files"]
    assert sorted((f["original_name"], f["work_id"]) for f in files) == [("brief.txt", None), ("passport.txt", work_id)]


def test_topic_dictionary_crud_without_duplicates(client, create_user):
    headers = setup(client, create_user)
    created = client.post("/api/admin/crm/topics", headers=headers, json={"name": "юридическая", "sort_order": 10})
    assert created.status_code == 201, created.text
    assert client.post("/api/admin/crm/topics", headers=headers, json={"name": "Юридическая"}).status_code == 409
    disabled = client.patch(f"/api/admin/crm/topics/{created.json()['id']}", headers=headers, json={"name": "юридическая", "active": False})
    assert disabled.status_code == 200
    assert client.get("/api/admin/crm/topics").json()["items"] == []
    assert [t["name"] for t in client.get("/api/admin/crm/topics?include_inactive=true").json()["items"]] == ["юридическая"]


def test_order_detail_reports_deposit_debited_by_the_order(client, create_user):
    headers = setup(client, create_user)
    company = client.post("/api/admin/companies", headers=headers, json={"name": "Депозитный клиент"}).json()
    assert client.post(f"/api/admin/companies/{company['id']}/deposit", headers=headers, json={"mode": "TOP_UP", "amount": "300", "note": ""}).status_code == 200
    order = _order(client, headers, client_id=company["id"], works=[{"work_type": "custom", "billing_unit": "FIXED", "client_rate": "500"}])
    assert D(order["deposit_applied"]) == D("300.00")
    assert D(order["payment"]["amount_paid"]) == D("300.00")
    # reading the order again never debits twice
    again = client.get(f"/api/admin/crm/orders/{order['id']}").json()
    assert D(again["deposit_applied"]) == D("300.00") and D(again["financial"]["client_debt"]) == D("200.00")
