from decimal import Decimal

from app.db import SessionLocal
from app.models import Role
from app.operations_models import OrderCounter
from tests.conftest import csrf_headers
from tests.test_auth import complete_first_login


def setup(client, create_user, role=Role.ADMIN):
    complete_first_login(client, create_user, role=role)
    with SessionLocal() as db:
        db.add(OrderCounter(id=1, value=0))
        db.commit()
    return csrf_headers(client)


def test_crm_wizard_multi_work_finance_and_dashboard(client, create_user):
    headers = setup(client, create_user)
    manager = client.get("/api/admin/auth/session").json()["user"]["id"]
    company = client.post(
        "/api/admin/companies", headers=headers, json={"name": "CRM Клиент"}
    ).json()
    executor = client.post(
        "/api/admin/executors", headers=headers, json={"name": "CRM Исполнитель"}
    ).json()

    for code, name, unit in [("written_translation", "Письменный перевод", "CONDITIONAL_PAGE"), ("notarial_certification", "Заверение нотариальное", "PER_DOCUMENT")]:
        created_service = client.post(
            "/api/admin/crm/services",
            headers=headers,
            json={"code": code, "name": name, "billing_mode": unit},
        )
        assert created_service.status_code == 201, created_service.text
    services = client.get("/api/admin/crm/services?active=true")
    assert services.status_code == 200, services.text
    assert any(row["code"] == "written_translation" for row in services.json())

    priced = client.post(
        "/api/admin/crm/pricing/calculate",
        headers=headers,
        json={
            "unit": "CONDITIONAL_PAGE",
            "rate": "540",
            "character_count": 3600,
            "urgent": True,
        },
    )
    assert priced.status_code == 200, priced.text
    assert Decimal(str(priced.json()["quantity"])) == Decimal("2.00")
    assert Decimal(str(priced.json()["amount"])) == Decimal("1620.00")

    payload = {
        "title": "Договор RU → EN + нотариат",
        "client_id": company["id"],
        "manager_id": manager,
        "status": "IN_PROGRESS",
        "works": [
            {
                "service_code": "written_translation",
                "work_type": "written_translation",
                "source_language": "Русский",
                "target_language": "Английский",
                "character_count": 3600,
                "billing_unit": "CONDITIONAL_PAGE",
                "client_rate": "540",
                "executor_id": executor["id"],
                "executor_rate": "300",
                "executor_billing_unit": "CONDITIONAL_PAGE",
            },
            {
                "service_code": "notarial_certification",
                "work_type": "certification",
                "page_count": "1",
                "billing_unit": "PER_DOCUMENT",
                "client_rate": "900",
                "price": "900",
            },
        ],
        "payment": {"amount_paid": "500", "payment_method": "invoice"},
    }
    created = client.post("/api/admin/crm/orders/wizard", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    order = created.json()
    assert order["number"] == "LC-O-000001"
    assert len(order["works"]) == 2
    assert Decimal(str(order["financial"]["revenue"])) == Decimal("1980.00")
    assert Decimal(str(order["financial"]["executor_cost"])) == Decimal("600.00")
    assert Decimal(str(order["financial"]["profit"])) == Decimal("1380.00")
    assert Decimal(str(order["financial"]["client_debt"])) == Decimal("1480.00")

    detail = client.get(f"/api/admin/crm/orders/{order['id']}")
    assert detail.status_code == 200
    status = client.patch(
        f"/api/admin/crm/orders/{order['id']}/status",
        headers=headers,
        json={"status": "REVIEW"},
    )
    assert status.status_code == 200
    assert status.json()["status"] == "REVIEW"

    dashboard = client.get("/api/admin/crm/dashboard")
    assert dashboard.status_code == 200
    assert dashboard.json()["active_orders"] == 1
    assert Decimal(str(dashboard.json()["profit"])) == Decimal("1380.00")

    client_summary = client.get(f"/api/admin/crm/clients/{company['id']}/summary")
    assert client_summary.status_code == 200
    assert client_summary.json()["order_count"] == 1

    executor_summary = client.get(f"/api/admin/crm/executors/{executor['id']}/summary")
    assert executor_summary.status_code == 200
    assert executor_summary.json()["active_works"] == 1


def test_document_preview_and_order_file_analysis(client, create_user):
    headers = setup(client, create_user)
    preview = client.post(
        "/api/admin/crm/files/analyze-preview",
        headers=headers,
        files={"upload": ("brief.txt", "Привет мир".encode(), "text/plain")},
    )
    assert preview.status_code == 200, preview.text
    assert preview.json()["character_count"] == 10
    assert preview.json()["word_count"] == 2
    assert preview.json()["page_count"] is None


def test_manager_cannot_manage_tariffs_but_can_use_crm(client, create_user):
    headers = setup(client, create_user, Role.MANAGER)
    assert client.get("/api/admin/crm/services").status_code == 200
    blocked = client.post(
        "/api/admin/crm/services",
        headers=headers,
        json={"code": "qa_service", "name": "QA service", "billing_mode": "CUSTOM"},
    )
    assert blocked.status_code == 403


def test_crm_order_filters_and_work_lifecycle(client, create_user):
    headers = setup(client, create_user)
    manager = client.get("/api/admin/auth/session").json()["user"]["id"]
    company = client.post(
        "/api/admin/companies", headers=headers,
        json={"name": "Поисковый клиент", "email": "client@example.com", "phone": "+79990001122"},
    ).json()
    executor = client.post(
        "/api/admin/executors", headers=headers,
        json={"name": "Переводчик Иван", "email": "translator@example.com"},
    ).json()
    assert client.post(
        "/api/admin/crm/services", headers=headers,
        json={"code": "written_translation", "name": "Письменный перевод", "billing_mode": "CONDITIONAL_PAGE"},
    ).status_code == 201
    created = client.post(
        "/api/admin/crm/orders/wizard", headers=headers,
        json={
            "title": "Поисковый договор", "client_id": company["id"],
            "manager_id": manager, "status": "IN_PROGRESS",
            "works": [{
                "service_code": "written_translation", "work_type": "written_translation",
                "source_language": "Русский", "target_language": "Английский",
                "character_count": 1800, "client_rate": "600", "billing_unit": "CONDITIONAL_PAGE",
                "executor_id": executor["id"], "executor_rate": "300",
                "executor_billing_unit": "CONDITIONAL_PAGE",
            }],
        },
    )
    assert created.status_code == 201, created.text
    order = created.json()
    work = order["works"][0]

    assert client.get("/api/admin/crm/orders?q=Поисковый").json()["total"] == 1
    assert client.get("/api/admin/crm/orders?q=Переводчик").json()["total"] == 1
    assert client.get("/api/admin/crm/orders?language=Английский").json()["total"] == 1

    duplicate = client.post(
        f"/api/admin/crm/orders/{order['id']}/works/{work['id']}/duplicate", headers=headers
    )
    assert duplicate.status_code == 201, duplicate.text
    detail = client.get(f"/api/admin/crm/orders/{order['id']}").json()
    assert len(detail["works"]) == 2

    edited_work = detail["works"][0]
    edited = client.patch(
        f"/api/admin/crm/orders/{order['id']}/works/{edited_work['id']}", headers=headers,
        json={
            "service_code": "written_translation", "work_type": "written_translation",
            "source_language": "Русский", "target_language": "Английский", "character_count": 1800,
            "billing_unit": "CONDITIONAL_PAGE", "client_rate": "600", "price": "650",
            "price_override_reason": "Согласовано с клиентом", "executor_id": executor["id"],
            "executor_rate": "300", "executor_billing_unit": "CONDITIONAL_PAGE",
            "status": "IN_PROGRESS", "version": edited_work["version"],
        },
    )
    assert edited.status_code == 200, edited.text
    assert Decimal(str(edited.json()["price"])) == Decimal("650.00")
    assert edited.json()["price_overridden"] is True

    archived = client.post(
        f"/api/admin/crm/orders/{order['id']}/works/{detail['works'][1]['id']}/archive",
        headers=headers,
    )
    assert archived.status_code == 200, archived.text
    detail = client.get(f"/api/admin/crm/orders/{order['id']}").json()
    assert len(detail["works"]) == 1
    assert Decimal(str(detail["financial"]["revenue"])) == Decimal("650.00")


def test_fast_crm_drafts_can_be_created_and_completed_later(client, create_user):
    headers = setup(client, create_user)
    manager_id = client.get("/api/admin/auth/session").json()["user"]["id"]

    company = client.post("/api/admin/companies", headers=headers, json={})
    assert company.status_code == 201, company.text
    assert company.json()["name"] == ""

    executor = client.post("/api/admin/executors", headers=headers, json={})
    assert executor.status_code == 201, executor.text
    assert executor.json()["name"] == ""

    draft = client.post("/api/admin/crm/orders/wizard", headers=headers, json={})
    assert draft.status_code == 201, draft.text
    order = draft.json()
    assert order["title"] == ""
    assert order["client_id"] is None
    assert order["manager_id"] is None
    assert order["works"] == []

    draft_with_unknown_work = client.post(
        "/api/admin/crm/orders/wizard", headers=headers, json={"works": [{}]}
    )
    assert draft_with_unknown_work.status_code == 201, draft_with_unknown_work.text
    unknown_work = draft_with_unknown_work.json()["works"][0]
    assert unknown_work["service_code"] == ""
    assert unknown_work["source_language"] == ""
    assert unknown_work["target_language"] == ""

    completed = client.patch(
        f"/api/admin/crm/orders/{order['id']}",
        headers=headers,
        json={
            "title": "Уточнённый заказ",
            "client_id": company.json()["id"],
            "contact_id": None,
            "manager_id": manager_id,
            "notes": "Информация получена после первого звонка",
            "version": order["version"],
        },
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["title"] == "Уточнённый заказ"
    assert completed.json()["client_id"] == company.json()["id"]
    assert completed.json()["manager_id"] == manager_id


def test_manual_application_can_start_empty_and_be_edited_later(client, create_user):
    headers = setup(client, create_user)
    created = client.post("/api/admin/applications", headers=headers, json={})
    assert created.status_code == 201, created.text
    application = created.json()
    assert application["name"] == ""
    assert application["contact"] == ""
    assert application["requested_service"] == "not_sure"
    assert application["message"] == ""

    updated = client.patch(
        f"/api/admin/applications/{application['id']}",
        headers=headers,
        json={
            "name": "Анна",
            "contact_method": "phone",
            "contact": "+7 999 000-00-00",
            "requested_service": "written_translation",
            "message": "Перевод договора",
            "version": application["version"],
        },
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["name"] == "Анна"
    assert body["phone"] == "+79990000000"
    assert body["requested_service"] == "written_translation"


def test_wizard_search_languages_and_tariff_selection(client, create_user):
    headers = setup(client, create_user)
    manager_id = client.get("/api/admin/auth/session").json()["user"]["id"]

    company = client.post(
        "/api/admin/companies", headers=headers,
        json={"name": "Альфа Переводы", "email": "office@alpha.test", "phone": "+79991112233"},
    ).json()
    contact = client.post(
        f"/api/admin/companies/{company['id']}/representatives", headers=headers,
        json={"name": "Дмитрий Орлов", "position": "Юрист", "email": "d.orlov@alpha.test", "phone": "+79995556677"},
    ).json()
    executor = client.post(
        "/api/admin/executors", headers=headers,
        json={
            "name": "Анна Переводчик", "email": "anna@translator.test", "phone": "+79990000001",
            "telegram": "@anna_translator",
            "directions": [{"source_language": "Русский", "target_language": "Английский", "work_type": "written_translation"}],
        },
    ).json()

    assert client.get("/api/admin/companies?q=Дмитрий").json()["items"][0]["id"] == company["id"]
    assert client.get(f"/api/admin/companies/{company['id']}/representatives?q=556677").json()["items"][0]["id"] == contact["id"]
    assert client.get("/api/admin/executors?q=000001").json()["items"][0]["id"] == executor["id"]

    service = client.post(
        "/api/admin/crm/services", headers=headers,
        json={"code": "written_translation", "name": "Письменный перевод", "billing_mode": "CONDITIONAL_PAGE"},
    )
    assert service.status_code == 201, service.text

    def tariff(source, target, direction, amount):
        response = client.post(
            "/api/admin/crm/tariffs", headers=headers,
            json={
                "service_code": "written_translation", "source_language": source,
                "target_language": target, "direction": direction, "unit": "CONDITIONAL_PAGE",
                "amount": str(amount), "min_quantity": "1", "urgency_multiplier": "1.5",
                "native_multiplier": "1", "active": True,
            },
        )
        assert response.status_code == 201, response.text
        return response.json()

    english = tariff("Русский", "Английский", "FROM_RUSSIAN", 590)
    german = tariff("Русский", "Немецкий", "FROM_RUSSIAN", 650)
    native_english = tariff("", "Английский", "NATIVE_SPEAKER", 2200)

    languages = client.get("/api/admin/crm/languages?q=анг")
    assert languages.status_code == 200
    assert [row["name"] for row in languages.json()["items"]] == ["Английский"]

    options = client.post(
        "/api/admin/crm/pricing/options", headers=headers,
        json={
            "service_code": "written_translation", "source_language": "Русский",
            "target_language": "Английский", "character_count": 1800, "urgent": True,
        },
    )
    assert options.status_code == 200, options.text
    auto = next(row for row in options.json()["options"] if row["is_auto"])
    assert auto["tariff_ids"] == [english["id"]]
    assert Decimal(str(auto["amount"])) == Decimal("885.00")

    native_options = client.post(
        "/api/admin/crm/pricing/options", headers=headers,
        json={
            "service_code": "written_translation", "source_language": "Русский",
            "target_language": "Английский", "character_count": 1800,
            "urgent": True, "native_speaker": True,
        },
    )
    assert native_options.status_code == 200, native_options.text
    assert len(native_options.json()["options"]) == 1
    assert native_options.json()["options"][0]["tariff_ids"] == [native_english["id"]]
    assert Decimal(str(native_options.json()["options"][0]["amount"])) == Decimal("3300.00")

    german_options = client.post(
        "/api/admin/crm/pricing/options", headers=headers,
        json={
            "service_code": "written_translation", "source_language": "Русский",
            "target_language": "Немецкий", "character_count": 1800,
        },
    )
    assert german_options.status_code == 200
    assert german_options.json()["auto_key"] == german["id"]

    created = client.post(
        "/api/admin/crm/orders/wizard", headers=headers,
        json={
            "title": "Тарифный заказ", "client_id": company["id"], "contact_id": contact["id"],
            "manager_id": manager_id,
            "works": [{
                "service_code": "written_translation", "work_type": "written_translation",
                "source_language": "Русский", "target_language": "Английский",
                "tariff_ids": [english["id"]], "character_count": 1800, "urgent": True,
                "executor_id": executor["id"],
            }],
        },
    )
    assert created.status_code == 201, created.text
    work = created.json()["works"][0]
    assert work["tariff_ids"] == english["id"]
    assert Decimal(str(work["client_rate"])) == Decimal("590.00")
    assert Decimal(str(work["price"])) == Decimal("885.00")

    wrong_tariff = client.post(
        "/api/admin/crm/orders/wizard", headers=headers,
        json={"works": [{
            "service_code": "written_translation", "source_language": "Русский",
            "target_language": "Немецкий", "tariff_ids": [english["id"]], "character_count": 1800,
        }]},
    )
    assert wrong_tariff.status_code == 422


def test_exact_2026_translation_pricing_rules(client, create_user):
    headers = setup(client, create_user)
    service = client.post(
        "/api/admin/crm/services", headers=headers,
        json={"code": "written_translation", "name": "Письменный перевод", "billing_mode": "CONDITIONAL_PAGE"},
    )
    assert service.status_code == 201, service.text

    def tariff(source, target, direction, amount):
        response = client.post(
            "/api/admin/crm/tariffs", headers=headers,
            json={
                "service_code": "written_translation", "source_language": source,
                "target_language": target, "direction": direction, "unit": "CONDITIONAL_PAGE",
                "amount": str(amount), "min_quantity": "1", "urgency_multiplier": "1.5",
                "native_multiplier": "1", "active": True,
            },
        )
        assert response.status_code == 201, response.text
        return response.json()

    en_to_ru = tariff("Английский", "Русский", "TO_RUSSIAN", 540)
    ru_to_en = tariff("Русский", "Английский", "FROM_RUSSIAN", 590)
    ru_to_de = tariff("Русский", "Немецкий", "FROM_RUSSIAN", 790)
    native_en = tariff("", "Английский", "NATIVE_SPEAKER", 2200)
    tariff("Азербайджанский", "Русский", "TO_RUSSIAN", 690)
    tariff("Русский", "Азербайджанский", "FROM_RUSSIAN", 790)

    for code, name, low, high, percent in [
        ("volume_discount_5", "5%", 20, 99, 5),
        ("volume_discount_10", "10%", 100, 499, 10),
        ("volume_discount_15", "15%", 500, None, 15),
    ]:
        response = client.post(
            "/api/admin/crm/pricing-rules", headers=headers,
            json={
                "code": code, "name": name, "rule_type": "VOLUME_DISCOUNT",
                "service_code": "written_translation", "threshold_from": low,
                "threshold_to": high, "percent": percent, "multiplier": 1, "active": True,
            },
        )
        assert response.status_code == 201, response.text

    # A conditional page is 1800 characters, rounded to hundredths, with a minimum of one page.
    small = client.post(
        "/api/admin/crm/pricing/quote", headers=headers,
        json={"service_code": "written_translation", "source_language": "Русский", "target_language": "Английский", "character_count": 900},
    )
    assert small.status_code == 200, small.text
    assert Decimal(str(small.json()["quantity"])) == Decimal("1")
    assert Decimal(str(small.json()["amount"])) == Decimal("590.00")

    # Urgency uses the documented base +50% multiplier from the tariff row.
    urgent = client.post(
        "/api/admin/crm/pricing/quote", headers=headers,
        json={"service_code": "written_translation", "source_language": "Английский", "target_language": "Русский", "character_count": 1800, "urgent": True},
    )
    assert urgent.status_code == 200, urgent.text
    assert urgent.json()["tariff_ids"] == [en_to_ru["id"]]
    assert Decimal(str(urgent.json()["amount"])) == Decimal("810.00")
    assert urgent.json()["formula"].startswith("540.00 ₽ × 1")

    # Foreign-to-foreign falls back to the sum of two directions through Russian.
    foreign = client.post(
        "/api/admin/crm/pricing/quote", headers=headers,
        json={"service_code": "written_translation", "source_language": "Английский", "target_language": "Немецкий", "character_count": 1800},
    )
    assert foreign.status_code == 200, foreign.text
    assert foreign.json()["resolution"] == "via_russian"
    assert set(foreign.json()["tariff_ids"]) == {en_to_ru["id"], ru_to_de["id"]}
    assert Decimal(str(foreign.json()["rate"])) == Decimal("1330.00")

    # Native-speaker mode selects the dedicated native tariff and never layers an invented coefficient over it.
    native = client.post(
        "/api/admin/crm/pricing/quote", headers=headers,
        json={"service_code": "written_translation", "source_language": "Русский", "target_language": "Английский", "character_count": 1800, "native_speaker": True},
    )
    assert native.status_code == 200, native.text
    assert native.json()["tariff_ids"] == [native_en["id"]]
    assert Decimal(str(native.json()["amount"])) == Decimal("2200.00")

    # Blank native-speaker cells in the authoritative sheet mean "no automatic native tariff".
    native_missing = client.post(
        "/api/admin/crm/pricing/quote", headers=headers,
        json={"service_code": "written_translation", "source_language": "Русский", "target_language": "Азербайджанский", "character_count": 1800, "native_speaker": True},
    )
    assert native_missing.status_code == 200, native_missing.text
    assert native_missing.json()["resolved"] is False

    # Volume discounts are applied automatically by conditional-page quantity.
    discounted = client.post(
        "/api/admin/crm/pricing/quote", headers=headers,
        json={"service_code": "written_translation", "source_language": "Русский", "target_language": "Английский", "character_count": 20 * 1800},
    )
    assert discounted.status_code == 200, discounted.text
    assert discounted.json()["tariff_ids"] == [ru_to_en["id"]]
    assert Decimal(str(discounted.json()["discount_percent"])) == Decimal("5")
    assert Decimal(str(discounted.json()["amount"])) == Decimal("11210.00")
