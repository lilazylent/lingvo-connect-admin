"""Owner feedback 2026-10-27: client-specific tariffs, per-document written translation."""

from decimal import Decimal

from tests.test_crm import setup


def _services(client, headers):
    for code, name, unit in [
        ("written_translation", "Письменный перевод", "CONDITIONAL_PAGE"),
        ("notarial_certification", "Заверение нотариальное", "PER_DOCUMENT"),
    ]:
        assert client.post("/api/admin/crm/services", headers=headers, json={"code": code, "name": name, "billing_mode": unit}).status_code == 201
    # the standard grid: 500 ₽ per conditional page EN→RU, notarisation 900 ₽ per document
    for payload in [
        {"service_code": "written_translation", "source_language": "Английский", "target_language": "Русский", "direction": "TO_RUSSIAN", "unit": "CONDITIONAL_PAGE", "amount": "500"},
        {"service_code": "notarial_certification", "unit": "PER_DOCUMENT", "amount": "900"},
    ]:
        assert client.post("/api/admin/crm/tariffs", headers=headers, json=payload).status_code == 201


def _client_with_tariffs(client, headers, *, mode="CLIENT", discount="10"):
    company = client.post("/api/admin/companies", headers=headers, json={"name": "Паспортный стол"}).json()
    base = f"/api/admin/companies/{company['id']}"
    rows = [
        {"service_code": "written_translation", "variant": "DOCUMENT", "amount": "100"},
        {"service_code": "notarial_certification", "quantity_from": "1", "amount": "500"},
        {"service_code": "notarial_certification", "quantity_from": "5", "amount": "450"},
    ]
    for row in rows:
        created = client.post(f"{base}/tariffs", headers=headers, json=row)
        assert created.status_code == 201, created.text
    pricing = client.put(f"{base}/pricing", headers=headers, json={"pricing_mode": mode, "client_discount_percent": discount})
    assert pricing.status_code == 200, pricing.text
    return company, pricing.json()


def _order(client, headers, client_id, works):
    created = client.post("/api/admin/crm/orders/wizard", headers=headers, json={"client_id": client_id, "works": works})
    assert created.status_code == 201, created.text
    return created.json()


def test_client_tariff_crud_and_settings(client, create_user):
    headers = setup(client, create_user)
    _services(client, headers)
    company, pricing = _client_with_tariffs(client, headers)
    assert pricing["pricing_mode"] == "CLIENT" and Decimal(str(pricing["client_discount_percent"])) == Decimal("10")
    assert [(r["service_code"], r["variant"], Decimal(str(r["quantity_from"]))) for r in pricing["items"]] == [
        ("notarial_certification", "", Decimal("1")),
        ("notarial_certification", "", Decimal("5")),
        ("written_translation", "DOCUMENT", Decimal("1")),
    ]
    base = f"/api/admin/companies/{company['id']}/tariffs"
    item = pricing["items"][0]
    edited = client.patch(f"{base}/{item['id']}", headers=headers, json={"service_code": "notarial_certification", "quantity_from": "1", "amount": "550"})
    assert edited.status_code == 200 and Decimal(str(edited.json()["items"][0]["amount"])) == Decimal("550")
    assert client.post(base, headers=headers, json={"service_code": "written_translation", "variant": "NOPE", "amount": "1"}).status_code == 422
    assert client.post(base, headers=headers, json={"service_code": "missing", "amount": "1"}).status_code == 422
    removed = client.delete(f"{base}/{item['id']}", headers=headers)
    assert removed.status_code == 200 and len(removed.json()["items"]) == 2
    # editing the client card must not reset the pricing settings
    card = client.get(f"/api/admin/companies/{company['id']}").json()
    assert client.patch(f"/api/admin/companies/{company['id']}", headers=headers, json={"name": "Паспортный стол 2", "version": card["version"]}).status_code == 200
    assert client.get(base).json()["pricing_mode"] == "CLIENT"


def test_client_tariffs_price_works_automatically(client, create_user):
    headers = setup(client, create_user)
    _services(client, headers)
    company, _ = _client_with_tariffs(client, headers)
    order = _order(client, headers, company["id"], [
        # passports: written translation counted per document, no characters needed
        {"service_code": "written_translation", "certification_mode": "DOCUMENT", "source_language": "Английский", "target_language": "Русский", "document_count": 3},
        # notarisation ladder: 6 documents -> the "from 5" price
        {"service_code": "notarial_certification", "document_count": 6},
    ])
    translation, notary = order["works"]
    assert translation["billing_unit"] == "PER_DOCUMENT" and translation["certification_mode"] == "DOCUMENT"
    assert translation["document_count"] == 3 and translation["character_count"] is None
    assert Decimal(str(translation["client_rate"])) == Decimal("100") and Decimal(str(translation["price"])) == Decimal("270.00")
    assert translation["tariff_ids"].startswith("client:")
    assert Decimal(str(notary["client_rate"])) == Decimal("450") and Decimal(str(notary["price"])) == Decimal("2430.00")
    assert Decimal(str(notary["discount_percent"])) == Decimal("10")

    # editing the work in the order card keeps the client price list, the ladder follows the quantity
    work = client.patch(f"/api/admin/crm/orders/{order['id']}/works/{notary['id']}", headers=headers, json={
        "service_code": "notarial_certification", "document_count": 2, "tariff_ids": [notary["tariff_ids"]], "version": notary["version"],
    })
    assert work.status_code == 200, work.text
    assert Decimal(str(work.json()["client_rate"])) == Decimal("500") and Decimal(str(work.json()["price"])) == Decimal("900.00")


def test_pricing_options_offer_client_and_standard_tariffs(client, create_user):
    headers = setup(client, create_user)
    _services(client, headers)
    company, _ = _client_with_tariffs(client, headers, mode="STANDARD", discount="0")
    options = client.post("/api/admin/crm/pricing/options", headers=headers, json={"service_code": "notarial_certification", "document_count": 2, "client_id": company["id"]}).json()
    keys = [o["key"] for o in options["options"]]
    assert keys[0].startswith("client:") and len(keys) == 2
    # standard mode: the company grid stays the default, the client price list is one click away
    standard = next(o for o in options["options"] if not o["key"].startswith("client:"))
    assert options["auto_key"] == standard["key"] and Decimal(str(standard["amount"])) == Decimal("1800.00")
    assert options["options"][0]["client_tariff"]["client_name"] == "Паспортный стол"

    # a manager may still pick the client tariff explicitly
    order = _order(client, headers, company["id"], [{"service_code": "notarial_certification", "document_count": 2, "tariff_ids": [keys[0]]}])
    assert Decimal(str(order["works"][0]["price"])) == Decimal("1000.00")
    # without a selection the standard tariff applies in STANDARD mode
    standard_order = _order(client, headers, company["id"], [{"service_code": "notarial_certification", "document_count": 2}])
    assert Decimal(str(standard_order["works"][0]["price"])) == Decimal("1800.00")


def test_per_document_translation_without_client_tariff_uses_manual_rate(client, create_user):
    headers = setup(client, create_user)
    _services(client, headers)
    # the per-page grid must not be applied to template documents
    options = client.post("/api/admin/crm/pricing/options", headers=headers, json={
        "service_code": "written_translation", "certification_mode": "DOCUMENT", "source_language": "Английский", "target_language": "Русский", "document_count": 2,
    }).json()
    assert options["options"] == [] and options["auto_key"] == ""
    order = _order(client, headers, None, [{
        "service_code": "written_translation", "certification_mode": "DOCUMENT", "source_language": "Английский", "target_language": "Русский",
        "document_count": 2, "client_rate": "150",
    }])
    work = order["works"][0]
    assert work["billing_unit"] == "PER_DOCUMENT" and Decimal(str(work["price"])) == Decimal("300.00")
    # the classic per-character translation is unchanged
    classic = _order(client, headers, None, [{"service_code": "written_translation", "source_language": "Английский", "target_language": "Русский", "character_count": 3600}])
    assert classic["works"][0]["billing_unit"] == "CONDITIONAL_PAGE" and Decimal(str(classic["works"][0]["price"])) == Decimal("1000.00")
