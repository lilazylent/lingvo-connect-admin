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
    assert Decimal(str(priced.json()["amount"])) == Decimal("1080.00")

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
        "payment": {"amount_paid": "500", "payment_method": "cashless"},
    }
    created = client.post("/api/admin/crm/orders/wizard", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    order = created.json()
    assert order["number"] == "26-0001"
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




def test_wizard_order_number_uses_overall_execution_year(client, create_user):
    headers = setup(client, create_user)
    first_preview = client.get("/api/admin/crm/orders/number-preview?execution_year=2027").json()
    second_preview = client.get("/api/admin/crm/orders/number-preview?execution_year=2027").json()
    assert first_preview["number"] == "27-0001"
    assert second_preview["number"] == "27-0001"
    assert first_preview["reserved"] is False
    created = client.post(
        "/api/admin/crm/orders/wizard",
        headers=headers,
        json={
            "title": "Заказ на следующий год",
            "works": [
                {"deadline": "2027-01-12"}
            ],
        },
    )
    assert created.status_code == 201, created.text
    payload = created.json()
    assert payload["number"] == "27-0001"
    assert payload["created_at"]
    next_preview = client.get("/api/admin/crm/orders/number-preview?execution_year=2027").json()
    assert next_preview["number"] == "27-0002"

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
    assert order["title"] == order["number"]
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
            "title": "Устаревшее название должно игнорироваться",
            "client_id": company.json()["id"],
            "contact_id": None,
            "manager_id": manager_id,
            "notes": "Информация получена после первого звонка",
            "version": order["version"],
        },
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["title"] == order["number"]
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
                "amount": str(amount), "min_quantity": "1", "urgency_multiplier": "1",
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
    assert Decimal(str(auto["amount"])) == Decimal("590.00")

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
    assert Decimal(str(native_options.json()["options"][0]["amount"])) == Decimal("2200.00")

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
    assert Decimal(str(work["price"])) == Decimal("590.00")

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
                "amount": str(amount), "min_quantity": "1", "urgency_multiplier": "1",
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

    # Conditional pages are rounded upward to tenths; this tariff itself still enforces min_quantity=1.
    small = client.post(
        "/api/admin/crm/pricing/quote", headers=headers,
        json={"service_code": "written_translation", "source_language": "Русский", "target_language": "Английский", "character_count": 900},
    )
    assert small.status_code == 200, small.text
    assert Decimal(str(small.json()["quantity"])) == Decimal("1")
    assert Decimal(str(small.json()["amount"])) == Decimal("590.00")

    # Base urgency is x1; an uplift only applies when the work explicitly sets a coefficient.
    urgent = client.post(
        "/api/admin/crm/pricing/quote", headers=headers,
        json={"service_code": "written_translation", "source_language": "Английский", "target_language": "Русский", "character_count": 1800, "urgent": True},
    )
    assert urgent.status_code == 200, urgent.text
    assert urgent.json()["tariff_ids"] == [en_to_ru["id"]]
    assert Decimal(str(urgent.json()["amount"])) == Decimal("540.00")
    assert urgent.json()["formula"].startswith("540.00 ₽ × 1")

    explicit_urgent = client.post(
        "/api/admin/crm/pricing/quote", headers=headers,
        json={
            "service_code": "written_translation",
            "source_language": "Английский",
            "target_language": "Русский",
            "character_count": 1800,
            "urgent": True,
            "urgency_multiplier": "1.5",
        },
    )
    assert explicit_urgent.status_code == 200, explicit_urgent.text
    assert Decimal(str(explicit_urgent.json()["amount"])) == Decimal("810.00")

    direct_to_russian = client.post(
        "/api/admin/crm/pricing/quote", headers=headers,
        json={"service_code": "written_translation", "source_language": "Английский", "target_language": "Русский", "character_count": 1800},
    )
    assert direct_to_russian.status_code == 200, direct_to_russian.text
    assert Decimal(str(direct_to_russian.json()["rate"])) == Decimal("540.00")
    assert Decimal(str(direct_to_russian.json()["amount"])) == Decimal("540.00")

    urgent_from_russian = client.post(
        "/api/admin/crm/pricing/quote", headers=headers,
        json={"service_code": "written_translation", "source_language": "Русский", "target_language": "Английский", "character_count": 1800, "urgent": True},
    )
    assert urgent_from_russian.status_code == 200, urgent_from_russian.text
    assert Decimal(str(urgent_from_russian.json()["amount"])) == Decimal("590.00")

    # Foreign-to-foreign falls back to the sum of two directions through Russian.
    foreign = client.post(
        "/api/admin/crm/pricing/quote", headers=headers,
        json={"service_code": "written_translation", "source_language": "Английский", "target_language": "Немецкий", "character_count": 1800},
    )
    assert foreign.status_code == 200, foreign.text
    assert foreign.json()["resolution"] == "via_russian"
    assert set(foreign.json()["tariff_ids"]) == {en_to_ru["id"], ru_to_de["id"]}
    assert Decimal(str(foreign.json()["rate"])) == Decimal("1330.00")
    assert [Decimal(str(component["rate"])) for component in foreign.json()["components"]] == [Decimal("540.00"), Decimal("790.00")]

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
    assert native_missing.json()["resolution"] == "native_not_available"
    assert "Тариф носителя" in native_missing.json()["message"]

    request_only = client.post(
        "/api/admin/crm/pricing/quote", headers=headers,
        json={"service_code": "written_translation", "source_language": "Русский", "target_language": "Клингонский", "character_count": 1800},
    )
    assert request_only.status_code == 200, request_only.text
    assert request_only.json()["resolved"] is False
    assert "Тариф по запросу" in request_only.json()["message"]

    # Volume discounts are applied automatically by conditional-page quantity.
    discounted = client.post(
        "/api/admin/crm/pricing/quote", headers=headers,
        json={"service_code": "written_translation", "source_language": "Русский", "target_language": "Английский", "character_count": 20 * 1800},
    )
    assert discounted.status_code == 200, discounted.text
    assert discounted.json()["tariff_ids"] == [ru_to_en["id"]]
    assert Decimal(str(discounted.json()["discount_percent"])) == Decimal("5")
    assert Decimal(str(discounted.json()["amount"])) == Decimal("11210.00")

    persisted = client.post(
        "/api/admin/crm/orders/wizard", headers=headers,
        json={"title": "Тариф сохраняется", "works": [{
            "service_code": "written_translation", "work_type": "written_translation",
            "source_language": "Русский", "target_language": "Английский",
            "tariff_ids": [ru_to_en["id"]], "character_count": 1800,
        }]},
    )
    assert persisted.status_code == 201, persisted.text
    persisted_id = persisted.json()["id"]
    reopened = client.get(f"/api/admin/crm/orders/{persisted_id}", headers=headers)
    assert reopened.status_code == 200, reopened.text
    assert reopened.json()["works"][0]["tariff_ids"] == ru_to_en["id"]
    assert Decimal(str(reopened.json()["works"][0]["client_rate"])) == Decimal("590.00")

    stale_tariff = client.post(
        "/api/admin/crm/orders/wizard", headers=headers,
        json={"works": [{
            "service_code": "written_translation", "work_type": "written_translation",
            "source_language": "Русский", "target_language": "Немецкий",
            "tariff_ids": [ru_to_en["id"]], "character_count": 1800,
        }]},
    )
    assert stale_tariff.status_code == 422


def test_per_work_urgency_manual_discount_and_split_executor_volume(client, create_user):
    """Client volume/pricing and executor slices must remain independent."""
    headers = setup(client, create_user)
    manager = client.get("/api/admin/auth/session").json()["user"]["id"]
    company = client.post(
        "/api/admin/companies", headers=headers, json={"name": "Клиент со сложным заказом"}
    ).json()
    first_executor = client.post(
        "/api/admin/executors", headers=headers, json={"name": "Исполнитель 1"}
    ).json()
    second_executor = client.post(
        "/api/admin/executors", headers=headers, json={"name": "Исполнитель 2"}
    ).json()
    created_service = client.post(
        "/api/admin/crm/services",
        headers=headers,
        json={
            "code": "written_translation",
            "name": "Письменный перевод",
            "billing_mode": "CONDITIONAL_PAGE",
        },
    )
    assert created_service.status_code == 201, created_service.text

    priced = client.post(
        "/api/admin/crm/pricing/calculate",
        headers=headers,
        json={
            "unit": "CONDITIONAL_PAGE",
            "rate": "100",
            "character_count": 3600,
            "urgent": True,
            "urgency_multiplier": "2",
        },
    )
    assert priced.status_code == 200, priced.text
    assert Decimal(str(priced.json()["quantity"])) == Decimal("2.00")
    assert Decimal(str(priced.json()["amount"])) == Decimal("400.00")

    created = client.post(
        "/api/admin/crm/orders/wizard",
        headers=headers,
        json={
            "title": "Срочный перевод с двумя исполнителями",
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
                    "client_rate": "100",
                    "urgent": True,
                    "urgency_multiplier": "2",
                    "discount_percent": "10",
                    "executor_assignments": [
                        {
                            "executor_id": first_executor["id"],
                            "character_count": 1800,
                            "billing_unit": "CONDITIONAL_PAGE",
                            "rate": "30",
                            "deadline": "2026-09-15",
                        },
                        {
                            "executor_id": second_executor["id"],
                            "character_count": 1800,
                            "billing_unit": "CONDITIONAL_PAGE",
                            "rate": "40",
                            "deadline": "2026-09-15",
                        },
                    ],
                }
            ],
        },
    )
    assert created.status_code == 201, created.text
    order = created.json()
    work = order["works"][0]

    # 2 client conditional pages * 100 * urgency 2 = 400; manual 10% = 360.
    assert Decimal(str(work["page_count"])) == Decimal("2.00")
    assert Decimal(str(work["urgency_multiplier"])) == Decimal("2.0000")
    assert Decimal(str(work["discount_percent"])) == Decimal("10.0000")
    assert work["discount_overridden"] is True
    assert Decimal(str(work["auto_price"])) == Decimal("360.00")
    assert Decimal(str(work["price"])) == Decimal("360.00")

    assignments = work["executor_assignments"]
    assert len(assignments) == 2
    assert {row["executor_name"] for row in assignments} == {"Исполнитель 1", "Исполнитель 2"}
    assert all(Decimal(str(row["page_count"])) == Decimal("1.00") for row in assignments)
    assert sum(Decimal(str(row["cost"])) for row in assignments) == Decimal("70.00")

    # Executor split must not alter the client volume/revenue.
    assert Decimal(str(order["financial"]["revenue"])) == Decimal("360.00")
    assert Decimal(str(order["financial"]["executor_cost"])) == Decimal("70.00")
    assert Decimal(str(order["financial"]["profit"])) == Decimal("290.00")

    detail = client.get(f"/api/admin/crm/orders/{order['id']}")
    assert detail.status_code == 200, detail.text
    detail_work = detail.json()["works"][0]
    assert len(detail_work["executor_assignments"]) == 2
    assert Decimal(str(detail_work["page_count"])) == Decimal("2.00")


def test_phase6_canonical_catalogs_and_executor_default_rate(client, create_user):
    headers = setup(client, create_user)

    service_response = client.post(
        "/api/admin/crm/services",
        headers=headers,
        json={
            "code": "written_translation",
            "name": "Письменный перевод",
            "billing_mode": "CONDITIONAL_PAGE",
            "notes": "Единый код для заказов и исполнителей",
        },
    )
    assert service_response.status_code == 201, service_response.text
    service = service_response.json()
    assert service["notes"] == "Единый код для заказов и исполнителей"

    created_languages = []
    for sort_order, name in enumerate(["Русский", "Японский", "Английский"], start=1):
        response = client.post(
            "/api/admin/crm/languages",
            headers=headers,
            json={"name": name, "active": True, "sort_order": sort_order * 10},
        )
        assert response.status_code == 201, response.text
        created_languages.append(response.json())

    executor_response = client.post(
        "/api/admin/executors",
        headers=headers,
        json={
            "name": "Дмитрий",
            "directions": [
                {
                    "source_language": "Японский",
                    "target_language": "Русский",
                    "work_type": "written_translation",
                    "default_rate": "720.50",
                    "rate_unit": "CONDITIONAL_PAGE",
                }
            ],
        },
    )
    assert executor_response.status_code == 201, executor_response.text
    direction = executor_response.json()["directions"][0]
    assert direction["service_name"] == "Письменный перевод"
    assert direction["canonical_service"] is True
    assert Decimal(str(direction["default_rate"])) == Decimal("720.50")
    assert direction["rate_unit"] == "CONDITIONAL_PAGE"

    rename_language = client.patch(
        f"/api/admin/crm/languages/{created_languages[1]['id']}",
        headers=headers,
        json={"name": "Японский язык", "active": True, "sort_order": 20},
    )
    assert rename_language.status_code == 409, rename_language.text

    rename_service_code = client.patch(
        f"/api/admin/crm/services/{service['id']}",
        headers=headers,
        json={
            "code": "written_translation_v2",
            "name": "Письменный перевод",
            "billing_mode": "CONDITIONAL_PAGE",
            "active": True,
            "sort_order": 100,
            "notes": service["notes"],
        },
    )
    assert rename_service_code.status_code == 409, rename_service_code.text


def test_cancelled_order_moves_to_archive_and_archive_reasons_are_configurable(client, create_user):
    headers = setup(client, create_user)
    created = client.post(
        "/api/admin/crm/orders/wizard",
        headers=headers,
        json={"title": "Архивный заказ"},
    )
    assert created.status_code == 201, created.text
    order = created.json()

    archived = client.post(
        f"/api/admin/crm/orders/{order['id']}/archive",
        headers=headers,
        json={"archived": True},
    )
    assert archived.status_code == 200, archived.text
    assert archived.json()["archived"] is True
    assert archived.json()["status"] == "CANCELLED"
    assert client.get("/api/admin/crm/orders?archived=false").json()["total"] == 0
    archive_list = client.get("/api/admin/crm/orders?archived=true").json()
    assert archive_list["total"] == 1
    assert archive_list["items"][0]["status"] == "CANCELLED"

    reason = client.post(
        "/api/admin/crm/order-statuses",
        headers=headers,
        json={
            "name": "Отложен",
            "color": "violet",
            "board": "ARCHIVE",
            "active": True,
            "sort_order": 120,
        },
    )
    assert reason.status_code == 201, reason.text
    reason_code = reason.json()["code"]

    moved = client.patch(
        f"/api/admin/crm/orders/{order['id']}/status",
        headers=headers,
        json={"status": reason_code},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["archived"] is True
    assert moved.json()["status"] == reason_code

    restored = client.post(
        f"/api/admin/crm/orders/{order['id']}/archive",
        headers=headers,
        json={"archived": False},
    )
    assert restored.status_code == 200, restored.text
    assert restored.json()["archived"] is False
    assert restored.json()["status"] == "NEW"


def test_phase10_wizard_persists_two_stage_russian_route_metadata(client, create_user):
    headers = setup(client, create_user)
    service = client.post(
        "/api/admin/crm/services",
        headers=headers,
        json={"code": "written_translation", "name": "Письменный перевод", "billing_mode": "CONDITIONAL_PAGE"},
    )
    assert service.status_code == 201, service.text
    for index, name in enumerate(["Русский", "Японский", "Английский"], start=1):
        response = client.post(
            "/api/admin/crm/languages",
            headers=headers,
            json={"name": name, "active": True, "sort_order": index * 10},
        )
        assert response.status_code == 201, response.text

    def executor(name, source, target, rate):
        created = client.post(
            "/api/admin/executors",
            headers=headers,
            json={
                "name": name,
                "directions": [{
                    "source_language": source,
                    "target_language": target,
                    "work_type": "written_translation",
                    "default_rate": rate,
                    "rate_unit": "CONDITIONAL_PAGE",
                }],
            },
        )
        assert created.status_code == 201, created.text
        row = created.json()
        available = client.post(
            f"/api/admin/executors/{row['id']}/availability",
            headers=headers,
            json={"state": "FREE", "start_date": "2026-09-20", "end_date": "2026-09-30", "notes": "meeting demo"},
        )
        assert available.status_code == 201, available.text
        return row

    jp_ru = executor("Stage JP RU", "Русский", "Японский", "720")
    ru_en = executor("Stage RU EN", "Русский", "Английский", "620")
    payload = {
        "title": "JA to EN routed order",
        "status": "NEW",
        "works": [{
            "service_code": "written_translation",
            "work_type": "written_translation",
            "source_language": "Японский",
            "target_language": "Английский",
            "character_count": 3600,
            "billing_unit": "CONDITIONAL_PAGE",
            "client_rate": "2000",
            "deadline": "2026-09-25",
            "executor_assignments": [
                {
                    "executor_id": jp_ru["id"],
                    "character_count": 4500,
                    "billing_unit": "CONDITIONAL_PAGE",
                    "rate": "850",
                    "deadline": "2026-09-25",
                    "route_stage_index": 1,
                    "route_source_language": "Японский",
                    "route_target_language": "Русский",
                },
                {
                    "executor_id": ru_en["id"],
                    "character_count": 2700,
                    "billing_unit": "CONDITIONAL_PAGE",
                    "rate": "610",
                    "deadline": "2026-09-25",
                    "route_stage_index": 2,
                    "route_source_language": "Русский",
                    "route_target_language": "Английский",
                },
            ],
        }],
    }
    created = client.post("/api/admin/crm/orders/wizard", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    assignments = created.json()["works"][0]["executor_assignments"]
    assert [item["route_stage_index"] for item in assignments] == [1, 2]
    assert [(item["route_source_language"], item["route_target_language"]) for item in assignments] == [
        ("Японский", "Русский"),
        ("Русский", "Английский"),
    ]
    assert [item["character_count"] for item in assignments] == [4500, 2700]
    assert [item["rate"] for item in assignments] == [850.0, 610.0]
    assert [item["auto_cost"] for item in assignments] == [2125.0, 915.0]
    assert [item["cost"] for item in assignments] == [2125.0, 915.0]
    financial = created.json()["financial"]
    assert Decimal(str(financial["revenue"])) == Decimal("4000.00")
    assert Decimal(str(financial["executor_cost"])) == Decimal("3040.00")
    assert Decimal(str(financial["profit"])) == Decimal("960.00")
    assert Decimal(str(financial["margin_percent"])) == Decimal("24.00")
    assert financial["executor_assignment_count"] == 2
    breakdown = financial["executor_breakdown"]
    assert len(breakdown) == 1
    assert Decimal(str(breakdown[0]["executor_cost"])) == Decimal("3040.00")
    assert [row["route_stage_index"] for row in breakdown[0]["assignments"]] == [1, 2]
    assert [Decimal(str(row["cost"])) for row in breakdown[0]["assignments"]] == [Decimal("2125.00"), Decimal("915.00")]
    assert client.get(f"/api/admin/executors/{jp_ru['id']}").json()["directions"][0]["default_rate"] == 720.0
    assert client.get(f"/api/admin/executors/{ru_en['id']}").json()["directions"][0]["default_rate"] == 620.0


def test_phase11_conditional_pages_round_up_and_assignment_rate_persists(client, create_user):
    """Client-review regression: page rounding + persisted executor rate/calculator."""
    headers = setup(client, create_user)
    service = client.post(
        "/api/admin/crm/services",
        headers=headers,
        json={"code": "written_translation", "name": "Письменный перевод", "billing_mode": "CONDITIONAL_PAGE"},
    )
    assert service.status_code == 201, service.text

    priced = client.post(
        "/api/admin/crm/pricing/calculate",
        headers=headers,
        json={"unit": "CONDITIONAL_PAGE", "rate": "1000", "character_count": 1801},
    )
    assert priced.status_code == 200, priced.text
    assert Decimal(str(priced.json()["quantity"])) == Decimal("1.1")
    assert Decimal(str(priced.json()["amount"])) == Decimal("1100.00")

    priced_3601 = client.post(
        "/api/admin/crm/pricing/calculate",
        headers=headers,
        json={"unit": "CONDITIONAL_PAGE", "rate": "1000", "character_count": 3601},
    )
    assert priced_3601.status_code == 200, priced_3601.text
    assert Decimal(str(priced_3601.json()["quantity"])) == Decimal("2.1")

    executor = client.post(
        "/api/admin/executors",
        headers=headers,
        json={
            "name": "Исполнитель со ставкой",
            "directions": [{
                "source_language": "Русский",
                "target_language": "Английский",
                "work_type": "written_translation",
                "default_rate": "700",
                "rate_unit": "CONDITIONAL_PAGE",
            }],
        },
    )
    assert executor.status_code == 201, executor.text
    executor_row = executor.json()

    created = client.post(
        "/api/admin/crm/orders/wizard",
        headers=headers,
        json={
            "title": "Phase 11 persistence",
            "status": "NEW",
            "works": [{
                "service_code": "written_translation",
                "work_type": "written_translation",
                "source_language": "Русский",
                "target_language": "Английский",
                "character_count": 1801,
                "billing_unit": "CONDITIONAL_PAGE",
                "client_rate": "1000",
                "executor_assignments": [{
                    "executor_id": executor_row["id"],
                    "character_count": 1801,
                    "billing_unit": "CONDITIONAL_PAGE",
                    "rate": "850",
                    "status": "NEW",
                }],
            }],
        },
    )
    assert created.status_code == 201, created.text
    order = created.json()
    work = order["works"][0]
    assignment = work["executor_assignments"][0]
    assert Decimal(str(work["page_count"])) == Decimal("1.1")
    assert Decimal(str(assignment["page_count"])) == Decimal("1.1")
    assert Decimal(str(assignment["rate"])) == Decimal("850.0")
    assert Decimal(str(assignment["auto_cost"])) == Decimal("935.0")
    assert Decimal(str(order["financial"]["executor_cost"])) == Decimal("935.0")

    # Re-fetch from persisted storage: the selected executor/rate and calculator
    # result must survive closing/reopening the order rather than living in UI state.
    reloaded = client.get(f"/api/admin/crm/orders/{order['id']}", headers=headers)
    assert reloaded.status_code == 200, reloaded.text
    persisted = reloaded.json()["works"][0]["executor_assignments"][0]
    assert persisted["executor_id"] == executor_row["id"]
    assert Decimal(str(persisted["rate"])) == Decimal("850.0")
    assert Decimal(str(persisted["page_count"])) == Decimal("1.1")
    assert Decimal(str(persisted["cost"])) == Decimal("935.0")
    assert Decimal(str(reloaded.json()["financial"]["executor_cost"])) == Decimal("935.0")

    direction = client.get(f"/api/admin/executors/{executor_row['id']}", headers=headers).json()["directions"][0]
    assert Decimal(str(direction["default_rate"])) == Decimal("700.0")


def test_phase12_routed_unknown_availability_manual_rates_persist_and_calculate(client, create_user):
    """Regression for owner review: selected route stages with UNKNOWN availability must persist and calculate."""
    headers = setup(client, create_user)
    service = client.post(
        "/api/admin/crm/services",
        headers=headers,
        json={"code": "written_translation", "name": "Письменный перевод", "billing_mode": "CONDITIONAL_PAGE"},
    )
    assert service.status_code == 201, service.text
    for index, name in enumerate(["Русский", "Японский", "Английский"], start=1):
        response = client.post(
            "/api/admin/crm/languages",
            headers=headers,
            json={"name": name, "active": True, "sort_order": index * 10},
        )
        assert response.status_code == 201, response.text

    def executor(name: str, source: str, target: str):
        created = client.post(
            "/api/admin/executors",
            headers=headers,
            json={
                "name": name,
                "directions": [{
                    "source_language": source,
                    "target_language": target,
                    "work_type": "written_translation",
                    "default_rate": "0",
                    "rate_unit": "CONDITIONAL_PAGE",
                }],
            },
        )
        assert created.status_code == 201, created.text
        return created.json()

    # Intentionally no availability periods: both candidates are UNKNOWN, not FREE.
    jp_ru = executor("UNKNOWN JP RU", "Русский", "Японский")
    ru_en = executor("UNKNOWN RU EN", "Русский", "Английский")

    created = client.post(
        "/api/admin/crm/orders/wizard",
        headers=headers,
        json={
            "title": "UNKNOWN route manual rates",
            "status": "NEW",
            "works": [{
                "service_code": "written_translation",
                "work_type": "written_translation",
                "source_language": "Японский",
                "target_language": "Английский",
                "character_count": 14534,
                "billing_unit": "CONDITIONAL_PAGE",
                "client_rate": "1000",
                "deadline": "2026-09-25",
                "executor_assignments": [
                    {
                        "executor_id": jp_ru["id"],
                        "character_count": 14534,
                        "billing_unit": "CONDITIONAL_PAGE",
                        "rate": "500",
                        "deadline": "2026-09-25",
                        "route_stage_index": 1,
                        "route_source_language": "Японский",
                        "route_target_language": "Русский",
                    },
                    {
                        "executor_id": ru_en["id"],
                        "character_count": 14534,
                        "billing_unit": "CONDITIONAL_PAGE",
                        "rate": "250",
                        "deadline": "2026-09-25",
                        "route_stage_index": 2,
                        "route_source_language": "Русский",
                        "route_target_language": "Английский",
                    },
                ],
            }],
        },
    )
    assert created.status_code == 201, created.text
    order = created.json()
    assignments = order["works"][0]["executor_assignments"]
    assert [Decimal(str(item["rate"])) for item in assignments] == [Decimal("500.0"), Decimal("250.0")]
    assert [Decimal(str(item["page_count"])) for item in assignments] == [Decimal("8.1"), Decimal("8.1")]
    assert [Decimal(str(item["cost"])) for item in assignments] == [Decimal("4050.0"), Decimal("2025.0")]
    assert Decimal(str(order["financial"]["executor_cost"])) == Decimal("6075.0")

    reloaded = client.get(f"/api/admin/crm/orders/{order['id']}", headers=headers)
    assert reloaded.status_code == 200, reloaded.text
    persisted = reloaded.json()["works"][0]["executor_assignments"]
    assert [Decimal(str(item["rate"])) for item in persisted] == [Decimal("500.0"), Decimal("250.0")]
    assert Decimal(str(reloaded.json()["financial"]["executor_cost"])) == Decimal("6075.0")


def test_internal_work_excluded_from_client_revenue_but_kept_in_executor_cost(client, create_user):
    headers = setup(client, create_user)
    executor = client.post(
        "/api/admin/executors", headers=headers,
        json={"name": "Внутренний исполнитель", "email": "internal@example.com"},
    ).json()
    services = client.get("/api/admin/crm/services?active=true").json()
    if not any(item["code"] == "written_translation" for item in services):
        assert client.post(
            "/api/admin/crm/services", headers=headers,
            json={"code": "written_translation", "name": "Письменный перевод", "billing_mode": "CONDITIONAL_PAGE"},
        ).status_code == 201

    payload = {
        "works": [
            {
                "service_code": "written_translation",
                "work_type": "written_translation",
                "source_language": "Русский",
                "target_language": "Английский",
                "character_count": 1800,
                "billing_unit": "CONDITIONAL_PAGE",
                "client_rate": "1000",
                "client_billable": True,
            },
            {
                "service_code": "written_translation",
                "work_type": "written_translation",
                "source_language": "Английский",
                "target_language": "Русский",
                "character_count": 1800,
                "billing_unit": "CONDITIONAL_PAGE",
                "client_rate": "800",
                "client_billable": False,
                "executor_assignments": [{
                    "executor_id": executor["id"],
                    "character_count": 1800,
                    "billing_unit": "CONDITIONAL_PAGE",
                    "rate": "300",
                }],
            },
        ]
    }
    created = client.post("/api/admin/crm/orders/wizard", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    body = created.json()
    assert Decimal(str(body["financial"]["revenue"])) == Decimal("1000.00")
    assert Decimal(str(body["financial"]["executor_cost"])) == Decimal("300.00")
    assert Decimal(str(body["financial"]["profit"])) == Decimal("700.00")
    assert Decimal(str(body["payment"]["amount_due"])) == Decimal("1000.00")
    assert body["works"][1]["client_billable"] is False
    assert body["financial"]["executor_breakdown"][1]["client_billable"] is False
    assert Decimal(str(body["financial"]["executor_breakdown"][1]["client_price"])) == Decimal("0.00")


def test_phase14_service_driven_fields_units_and_matching(client, create_user):
    """Oleg matrix regression: each service owns its fields, unit, and matching mode."""
    headers = setup(client, create_user)

    services = [
        ("written_translation", "Письменный перевод", "CONDITIONAL_PAGE"),
        ("company_certification", 'Заверение печатью "Лингво Коннект"', "PER_DOCUMENT"),
        ("delivery", "Доставка", "FIXED"),
        ("audio_listening", "Аудирование", "PER_SECOND"),
        ("transcription", "Транскрибация", "CONDITIONAL_PAGE"),
        ("consecutive_interpreting", "Последовательный перевод", "HOURLY"),
    ]
    for code, name, billing_mode in services:
        response = client.post(
            "/api/admin/crm/services",
            headers=headers,
            json={"code": code, "name": name, "billing_mode": billing_mode},
        )
        assert response.status_code == 201, response.text

    catalog = client.get("/api/admin/crm/services?active=true", headers=headers)
    assert catalog.status_code == 200, catalog.text
    by_code = {item["code"]: item for item in catalog.json()}
    assert by_code["company_certification"]["definition"]["default_variant"] == "BOUND"
    assert by_code["company_certification"]["definition"]["variants"]["PER_PAGE"]["billing_unit"] == "PER_PAGE"
    assert by_code["delivery"]["definition"]["fields"] == [
        "start_date", "start_time", "deadline", "deadline_time", "status", "notes"
    ]
    assert by_code["audio_listening"]["definition"]["billing_unit"] == "PER_SECOND"
    assert by_code["transcription"]["definition"]["page_from_characters"] is True
    assert by_code["consecutive_interpreting"]["definition"]["matching_mode"] == "LANGUAGE_PAIR"

    created = client.post(
        "/api/admin/crm/orders/wizard",
        headers=headers,
        json={
            "title": "Phase 14 matrix",
            "works": [
                {
                    "service_code": "company_certification",
                    "work_type": "company_certification",
                    "certification_mode": "BOUND",
                    "document_count": 2,
                    "page_count": 99,
                    "billing_unit": "CUSTOM",
                    "client_rate": "100",
                },
                {
                    "service_code": "company_certification",
                    "work_type": "company_certification",
                    "certification_mode": "PER_PAGE",
                    "document_count": 99,
                    "page_count": 3,
                    "billing_unit": "CUSTOM",
                    "client_rate": "50",
                },
                {
                    "service_code": "audio_listening",
                    "work_type": "audio_listening",
                    "duration_seconds": 40,
                    "billing_unit": "CUSTOM",
                    "client_rate": "3",
                },
                {
                    "service_code": "transcription",
                    "work_type": "transcription",
                    "character_count": 900,
                    "billing_unit": "CUSTOM",
                    "client_rate": "100",
                },
                {
                    "service_code": "consecutive_interpreting",
                    "work_type": "consecutive_interpreting",
                    "source_language": "Русский",
                    "target_language": "Английский",
                    "hour_count": "2.5",
                    "topic": "Переговоры",
                    "start_date": "2026-09-25",
                    "start_time": "10:00",
                    "deadline": "2026-09-25",
                    "deadline_time": "12:30",
                    "billing_unit": "CUSTOM",
                    "client_rate": "1000",
                },
                {
                    "service_code": "delivery",
                    "work_type": "delivery",
                    "source_language": "Русский",
                    "target_language": "Английский",
                    "character_count": 9999,
                    "page_count": 5,
                    "start_date": "2026-09-26",
                    "start_time": "09:00",
                    "deadline": "2026-09-26",
                    "deadline_time": "13:00",
                    "billing_unit": "CUSTOM",
                    "client_rate": "500",
                },
            ],
        },
    )
    assert created.status_code == 201, created.text
    works = created.json()["works"]

    bound, per_page, audio, transcription, interpreting, delivery = works
    assert bound["billing_unit"] == "PER_DOCUMENT"
    assert bound["document_count"] == 2
    assert bound["page_count"] is None
    assert Decimal(str(bound["price"])) == Decimal("200.00")

    assert per_page["billing_unit"] == "PER_PAGE"
    assert per_page["document_count"] is None
    assert Decimal(str(per_page["page_count"])) == Decimal("3")
    assert Decimal(str(per_page["price"])) == Decimal("150.00")

    assert audio["billing_unit"] == "PER_SECOND"
    assert audio["duration_seconds"] == 40
    assert Decimal(str(audio["price"])) == Decimal("120.00")

    assert transcription["billing_unit"] == "CONDITIONAL_PAGE"
    assert Decimal(str(transcription["page_count"])) == Decimal("1")
    assert Decimal(str(transcription["price"])) == Decimal("100.00")

    assert interpreting["billing_unit"] == "HOURLY"
    assert Decimal(str(interpreting["hour_count"])) == Decimal("2.5")
    assert Decimal(str(interpreting["price"])) == Decimal("2500.00")
    assert interpreting["start_time"] == "10:00"

    assert delivery["billing_unit"] == "FIXED"
    assert Decimal(str(delivery["price"])) == Decimal("500.00")
    assert delivery["source_language"] == ""
    assert delivery["target_language"] == ""
    assert delivery["character_count"] is None
    assert delivery["page_count"] is None
    assert delivery["start_date"] == "2026-09-26"

    courier = client.post(
        "/api/admin/executors",
        headers=headers,
        json={
            "name": "Курьер Phase 14",
            "directions": [{
                "source_language": "",
                "target_language": "",
                "work_type": "delivery",
                "default_rate": "400",
                "rate_unit": "FIXED",
            }],
        },
    )
    assert courier.status_code == 201, courier.text
    preview = client.post(
        "/api/admin/orders/executor-candidates/preview",
        headers=headers,
        json={
            "service_code": "delivery",
            "work_type": "delivery",
            "source_language": "",
            "target_language": "",
            "deadline": "2026-09-26",
        },
    )
    assert preview.status_code == 200, preview.text
    body = preview.json()
    assert body["matching_mode"] == "SERVICE_ONLY"
    assert body["matchable"] is True
    assert body["routed_match"]["eligible"] is False
    assert [item["executor_name"] for item in body["candidates"]] == ["Курьер Phase 14"]


def test_phase15_client_deposit_topup_and_order_auto_debit(client, create_user):
    headers = setup(client, create_user)
    manager = client.get("/api/admin/auth/session").json()["user"]["id"]
    company = client.post(
        "/api/admin/companies", headers=headers, json={"name": "Депозитный клиент"}
    ).json()

    topup = client.post(
        f"/api/admin/companies/{company['id']}/deposit",
        headers=headers,
        json={"mode": "TOP_UP", "amount": "10000", "note": "Стартовый депозит"},
    )
    assert topup.status_code == 200, topup.text
    assert Decimal(str(topup.json()["balance"])) == Decimal("10000.00")

    set_balance = client.post(
        f"/api/admin/companies/{company['id']}/deposit",
        headers=headers,
        json={"mode": "SET_BALANCE", "amount": "12000", "note": "Корректировка"},
    )
    assert set_balance.status_code == 200, set_balance.text
    assert Decimal(str(set_balance.json()["balance"])) == Decimal("12000.00")
    service = client.post(
        "/api/admin/crm/services", headers=headers,
        json={"code": "custom_service", "name": "Дополнительная услуга", "billing_mode": "FIXED"},
    )
    assert service.status_code == 201, service.text

    created = client.post(
        "/api/admin/crm/orders/wizard",
        headers=headers,
        json={
            "title": "Заказ из депозита",
            "client_id": company["id"],
            "manager_id": manager,
            "status": "NEW",
            "works": [
                {
                    "service_code": "custom_service",
                    "work_type": "custom_service",
                    "billing_unit": "FIXED",
                    "client_rate": "5000",
                    "price": "5000",
                }
            ],
            "payment": {"amount_paid": "0"},
        },
    )
    assert created.status_code == 201, created.text
    payload = created.json()
    assert Decimal(str(payload["financial"]["revenue"])) == Decimal("5000.00")
    assert Decimal(str(payload["financial"]["client_paid"])) == Decimal("5000.00")
    assert Decimal(str(payload["financial"]["client_debt"])) == Decimal("0.00")

    deposit = client.get(f"/api/admin/companies/{company['id']}/deposit")
    assert deposit.status_code == 200, deposit.text
    body = deposit.json()
    assert Decimal(str(body["balance"])) == Decimal("7000.00")
    assert body["transactions"][0]["kind"] == "ORDER_DEBIT"
    assert Decimal(str(body["transactions"][0]["amount"])) == Decimal("-5000.00")
    assert body["transactions"][0]["order_id"] == payload["id"]


def test_phase15_deposit_only_covers_available_balance(client, create_user):
    headers = setup(client, create_user)
    company = client.post(
        "/api/admin/companies", headers=headers, json={"name": "Малый депозит"}
    ).json()
    assert client.post(
        f"/api/admin/companies/{company['id']}/deposit",
        headers=headers,
        json={"mode": "SET_BALANCE", "amount": "1000"},
    ).status_code == 200
    service = client.post(
        "/api/admin/crm/services", headers=headers,
        json={"code": "custom_service_2", "name": "Дополнительная услуга 2", "billing_mode": "FIXED"},
    )
    assert service.status_code == 201, service.text

    created = client.post(
        "/api/admin/crm/orders/wizard",
        headers=headers,
        json={
            "title": "Заказ дороже депозита",
            "client_id": company["id"],
            "works": [{"service_code": "custom_service_2", "work_type": "custom_service_2", "billing_unit": "FIXED", "client_rate": "2500", "price": "2500"}],
        },
    )
    assert created.status_code == 201, created.text
    financial = created.json()["financial"]
    assert Decimal(str(financial["client_paid"])) == Decimal("1000.00")
    assert Decimal(str(financial["client_debt"])) == Decimal("1500.00")
    deposit = client.get(f"/api/admin/companies/{company['id']}/deposit").json()
    assert Decimal(str(deposit["balance"])) == Decimal("0.00")
