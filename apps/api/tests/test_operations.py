from datetime import UTC, date, datetime
from io import BytesIO

import openpyxl

from app.db import SessionLocal
from app.models import Role
from app.operations_models import OrderCounter
from app.order_numbering import next_order_number, peek_next_order_number
from tests.conftest import csrf_headers
from tests.test_applications import manual_payload
from tests.test_auth import complete_first_login


def setup(client, create_user, role=Role.ADMIN):
    complete_first_login(client, create_user, role=role)
    with SessionLocal() as db:
        db.add(OrderCounter(id=1, value=0))
        db.commit()
    return csrf_headers(client)




def test_order_numbering_resets_each_year_and_is_stable_format():
    with SessionLocal() as db:
        assert peek_next_order_number(db, execution_year=2026) == "26-0001"
        assert peek_next_order_number(db, execution_year=2026) == "26-0001"
        assert next_order_number(db, execution_year=2026) == "26-0001"
        assert next_order_number(db, execution_year=2026) == "26-0002"
        assert next_order_number(db, execution_year=2027) == "27-0001"
        assert next_order_number(db, now=datetime(2028, 1, 2, tzinfo=UTC)) == "28-0001"

def test_request_order_work_lifecycle(client, create_user):
    headers = setup(client, create_user)
    manager = client.get("/api/admin/auth/session").json()["user"]["id"]
    company = client.post(
        "/api/admin/companies",
        headers=headers,
        json={"name": "Альфа", "email": "alpha@example.com"},
    ).json()
    contact = client.post(
        f"/api/admin/companies/{company['id']}/representatives",
        headers=headers,
        json={"name": "Анна"},
    ).json()
    executor = client.post(
        "/api/admin/executors",
        headers=headers,
        json={
            "name": "Переводчик",
            "directions": [
                {
                    "source_language": "Русский",
                    "target_language": "Английский",
                    "work_type": "written_translation",
                }
            ],
        },
    ).json()
    lead = client.post("/api/admin/applications", headers=headers, json=manual_payload()).json()
    payload = {
        "title": "Перевод договора",
        "client_id": company["id"],
        "contact_id": contact["id"],
        "manager_id": manager,
        "application_id": lead["id"],
    }
    result = client.post("/api/admin/orders", headers=headers, json=payload)
    assert result.status_code == 201, result.text
    order = result.json()
    assert order["number"] == "26-0001"
    assert order["created_at"]
    assert client.post("/api/admin/orders", headers=headers, json=payload).status_code == 409
    assert client.get(f"/api/admin/applications/{lead['id']}").status_code == 200
    work_path = f"/api/admin/orders/{order['id']}/works"
    work = client.post(
        work_path,
        headers=headers,
        json={
            "work_type": "written_translation",
            "executor_id": executor["id"],
            "price": "1200.50",
        },
    ).json()
    edited = client.patch(
        f"{work_path}/{work['id']}",
        headers=headers,
        json={
            "version": 1,
            "work_type": "written_translation",
            "executor_id": executor["id"],
            "status": "COMPLETED",
            "price": "1200.50",
        },
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["status"] == "COMPLETED"
    assert client.get(f"/api/admin/orders/{order['id']}").json()["status"] == "NEW"
    assert client.get(f"/api/admin/executors/{executor['id']}/works").json()["total"] == 1
    assert client.get(f"/api/admin/orders/{order['id']}/activity").json()["total"] == 3
    assert client.get(f"/api/admin/companies/{company['id']}/applications").json()["total"] == 1
    file_path = f"/api/admin/orders/{order['id']}/files"
    uploaded = client.post(
        file_path, headers=headers, files={"upload": ("brief.txt", b"order brief", "text/plain")}
    )
    assert uploaded.status_code == 201, uploaded.text
    file_id = uploaded.json()["id"]
    assert client.get(f"{file_path}/{file_id}/download").content == b"order brief"

    application_file = client.post(
        f"/api/admin/applications/{lead['id']}/files",
        headers=headers,
        files={"upload": ("source.txt", b"application source", "text/plain")},
    )
    assert application_file.status_code == 201, application_file.text

    registry = client.get("/api/admin/files").json()
    assert registry["total"] == 2
    assert {item["source"] for item in registry["items"]} == {"order", "application"}
    assert client.get("/api/admin/files?source=order").json()["total"] == 1
    assert client.get("/api/admin/files?q=brief").json()["items"][0]["id"] == file_id

    csv_export = client.get("/api/admin/files/export.csv")
    assert csv_export.status_code == 200
    assert csv_export.content.startswith(b"\xef\xbb\xbf")
    assert "brief.txt" in csv_export.content.decode("utf-8-sig")

    xlsx_export = client.get("/api/admin/files/export.xlsx")
    assert xlsx_export.status_code == 200
    assert xlsx_export.content.startswith(b"PK")
    workbook = openpyxl.load_workbook(BytesIO(xlsx_export.content), read_only=True, data_only=True)
    try:
        sheet = workbook["Файлы"]
        rows = list(sheet.iter_rows(values_only=True))
        assert rows[0][0] == "Файл"
        assert {row[0] for row in rows[1:]} == {"brief.txt", "source.txt"}
    finally:
        workbook.close()
    assert (
        client.post(
            file_path, headers=headers, files={"upload": ("bad.pdf", b"not a pdf")}
        ).status_code
        == 422
    )
    assert client.post(file_path, files={"upload": ("x.txt", b"x")}).status_code == 403
    other = client.post("/api/admin/companies", headers=headers, json={"name": "Другая"}).json()
    assert (
        client.post(
            f"/api/admin/applications/{lead['id']}/client",
            headers=headers,
            json={"client_id": other["id"]},
        ).status_code
        == 409
    )


def test_manager_and_validation(client, create_user):
    headers = setup(client, create_user, Role.MANAGER)
    executor = client.post(
        "/api/admin/executors", headers=headers, json={"name": "Редактор"}
    ).json()
    path = f"/api/admin/executors/{executor['id']}"
    assert (
        client.patch(path, headers=headers, json={"name": "Новое имя", "version": 9}).status_code
        == 409
    )
    assert (
        client.post(
            f"{path}/archive", headers=headers, json={"version": 1, "archived": True}
        ).status_code
        == 200
    )
    assert (
        client.patch(path, headers=headers, json={"name": "Новое имя", "version": 2}).status_code
        == 409
    )
    assert client.get("/api/admin/executors").json()["total"] == 0
    assert client.get("/api/admin/executors?archived=true").json()["total"] == 1
    assert (
        client.post(
            "/api/admin/companies", headers=headers, json={"name": " ", "email": "bad"}
        ).status_code
        == 422
    )


def test_operations_require_full_auth_and_csrf(client):
    for endpoint in ["companies", "executors", "orders"]:
        assert client.get(f"/api/admin/{endpoint}").status_code == 401
        assert client.post(f"/api/admin/{endpoint}", json={}).status_code == 401


def test_executor_availability_calendar_crud_and_overlap_guard(client, create_user):
    headers = setup(client, create_user)
    executor = client.post(
        "/api/admin/executors", headers=headers, json={"name": "Календарный исполнитель"}
    ).json()
    base = f"/api/admin/executors/{executor['id']}/availability"

    created = client.post(
        base,
        headers=headers,
        json={
            "state": "BUSY",
            "start_date": "2026-09-20",
            "end_date": "2026-09-22",
            "notes": "Проект LC-O-000001",
        },
    )
    assert created.status_code == 201, created.text
    row = created.json()
    assert row["state"] == "BUSY"
    assert row["version"] == 1

    overlap = client.post(
        base,
        headers=headers,
        json={
            "state": "VACATION",
            "start_date": "2026-09-22",
            "end_date": "2026-09-25",
        },
    )
    assert overlap.status_code == 409

    free = client.post(
        base,
        headers=headers,
        json={
            "state": "FREE",
            "start_date": "2026-09-23",
            "end_date": "2026-09-25",
        },
    )
    assert free.status_code == 201, free.text

    listing = client.get(base)
    assert listing.status_code == 200
    assert [item["state"] for item in listing.json()["items"]] == ["BUSY", "FREE"]

    edited = client.patch(
        f"{base}/{row['id']}",
        headers=headers,
        json={
            "version": 1,
            "state": "UNAVAILABLE",
            "start_date": "2026-09-19",
            "end_date": "2026-09-22",
            "notes": "Недоступен по личным причинам",
        },
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["state"] == "UNAVAILABLE"
    assert edited.json()["version"] == 2

    deleted = client.delete(f"{base}/{row['id']}?version=2", headers=headers)
    assert deleted.status_code == 200, deleted.text
    remaining = client.get(base).json()["items"]
    assert len(remaining) == 1
    assert remaining[0]["state"] == "FREE"


def test_phase10_2_direct_executor_matching_is_factual_and_bidirectional(client, create_user):
    headers = setup(client, create_user)

    for code, name in [
        ("written_translation", "Письменный перевод"),
        ("notarial_certification", "Заверение нотариальное"),
    ]:
        created = client.post(
            "/api/admin/crm/services",
            headers=headers,
            json={"code": code, "name": name, "billing_mode": "CONDITIONAL_PAGE"},
        )
        assert created.status_code == 201, created.text

    def add_executor(name, source, target, *, service="written_translation", rate="0"):
        response = client.post(
            "/api/admin/executors",
            headers=headers,
            json={
                "name": name,
                "directions": [
                    {
                        "source_language": source,
                        "target_language": target,
                        "work_type": service,
                        "default_rate": rate,
                        "rate_unit": "CONDITIONAL_PAGE",
                    }
                ],
            },
        )
        assert response.status_code == 201, response.text
        return response.json()

    free = add_executor("Анна Свободна", "Русский", "Английский", rate="700")
    unknown = add_executor("Борис Без календаря", "Английский", "Русский", rate="650")
    busy = add_executor("Виктор Занят", "Русский", "Английский", rate="620")
    vacation = add_executor("Галина В отпуске", "Английский", "Русский", rate="610")
    foreign = add_executor("Джон JP EN", "Японский", "Английский", rate="900")
    wrong_pair = add_executor("Елена RU DE", "Русский", "Немецкий", rate="500")
    wrong_service = add_executor(
        "Жанна Нотариат",
        "Русский",
        "Английский",
        service="notarial_certification",
        rate="400",
    )
    archived = add_executor("Зоя Архив", "Русский", "Английский", rate="300")
    archived_result = client.post(
        f"/api/admin/executors/{archived['id']}/archive",
        headers=headers,
        json={"version": archived["version"], "archived": True},
    )
    assert archived_result.status_code == 200, archived_result.text

    for executor, state in [(free, "FREE"), (busy, "BUSY"), (vacation, "VACATION")]:
        availability = client.post(
            f"/api/admin/executors/{executor['id']}/availability",
            headers=headers,
            json={
                "state": state,
                "start_date": "2026-09-20",
                "end_date": "2026-09-30",
                "notes": f"{state} evidence",
            },
        )
        assert availability.status_code == 201, availability.text

    order = client.post(
        "/api/admin/orders",
        headers=headers,
        json={"title": "Direct matching", "deadline": "2026-09-30"},
    )
    assert order.status_code == 201, order.text
    order = order.json()

    work = client.post(
        f"/api/admin/orders/{order['id']}/works",
        headers=headers,
        json={
            "work_type": "written_translation",
            "source_language": "Русский",
            "target_language": "Английский",
            "deadline": "2026-09-25",
        },
    )
    assert work.status_code == 201, work.text
    work = work.json()

    result = client.get(
        f"/api/admin/orders/{order['id']}/works/{work['id']}/executor-candidates"
    )
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["match_type"] == "DIRECT"
    assert body["matchable"] is True
    assert body["missing_fields"] == []
    assert body["work"]["service_name"] == "Письменный перевод"
    assert body["required_date"] == "2026-09-25"
    assert body["required_date_source"] == "work_deadline"
    assert body["counts"] == {"available": 1, "unknown": 1, "unavailable": 2, "total": 4}

    candidates = body["candidates"]
    assert [item["candidate_state"] for item in candidates] == [
        "AVAILABLE",
        "UNKNOWN",
        "UNAVAILABLE",
        "UNAVAILABLE",
    ]
    by_name = {item["executor_name"]: item for item in candidates}
    assert set(by_name) == {
        "Анна Свободна",
        "Борис Без календаря",
        "Виктор Занят",
        "Галина В отпуске",
    }
    assert by_name["Анна Свободна"]["deadline_compatible"] is True
    assert by_name["Анна Свободна"]["availability"]["state"] == "FREE"
    assert by_name["Борис Без календаря"]["deadline_compatible"] is None
    assert by_name["Борис Без календаря"]["availability"]["state"] == "UNKNOWN"
    assert by_name["Виктор Занят"]["deadline_compatible"] is False
    assert by_name["Галина В отпуске"]["availability"]["state"] == "VACATION"
    assert by_name["Борис Без календаря"]["matched_pair"] == {
        "source_language": "Английский",
        "target_language": "Русский",
        "bidirectional": True,
    }
    assert str(by_name["Анна Свободна"]["default_rate"]) == "700.0"
    assert by_name["Анна Свободна"]["rate_unit"] == "CONDITIONAL_PAGE"
    assert wrong_pair["name"] not in by_name
    assert wrong_service["name"] not in by_name
    assert archived["name"] not in by_name
    assert foreign["name"] not in by_name

    # Internal executor deadline wins over the client/work deadline when saved.
    with SessionLocal() as db:
        from app.operations_models import OrderWork

        db_work = db.get(OrderWork, work["id"])
        db_work.executor_deadline = date(2026, 9, 24)
        db.commit()
    precedence = client.get(
        f"/api/admin/orders/{order['id']}/works/{work['id']}/executor-candidates"
    ).json()
    assert precedence["required_date"] == "2026-09-24"
    assert precedence["required_date_source"] == "executor_deadline"

    # A saved direct foreign-to-foreign capability is a valid direct match.
    foreign_work = client.post(
        f"/api/admin/orders/{order['id']}/works",
        headers=headers,
        json={
            "work_type": "written_translation",
            "source_language": "Английский",
            "target_language": "Японский",
        },
    ).json()
    foreign_match = client.get(
        f"/api/admin/orders/{order['id']}/works/{foreign_work['id']}/executor-candidates"
    ).json()
    assert foreign_match["required_date"] == "2026-09-30"
    assert foreign_match["required_date_source"] == "order_deadline"
    assert [item["executor_name"] for item in foreign_match["candidates"]] == ["Джон JP EN"]
    assert foreign_match["candidates"][0]["candidate_state"] == "UNKNOWN"

    incomplete = client.post(
        f"/api/admin/orders/{order['id']}/works",
        headers=headers,
        json={
            "work_type": "written_translation",
            "source_language": "",
            "target_language": "Английский",
        },
    ).json()
    incomplete_match = client.get(
        f"/api/admin/orders/{order['id']}/works/{incomplete['id']}/executor-candidates"
    )
    assert incomplete_match.status_code == 200
    assert incomplete_match.json()["matchable"] is False
    assert incomplete_match.json()["missing_fields"] == ["source_language"]
    assert incomplete_match.json()["candidates"] == []


def test_phase10_2_direct_matching_requires_authentication(client):
    response = client.get(
        "/api/admin/orders/00000000-0000-0000-0000-000000000000/works/"
        "00000000-0000-0000-0000-000000000001/executor-candidates"
    )
    assert response.status_code == 401


def test_phase10_4_routing_through_russian_is_factual_and_read_only(client, create_user):
    headers = setup(client, create_user)

    service = client.post(
        "/api/admin/crm/services",
        headers=headers,
        json={"code": "written_translation", "name": "Письменный перевод", "billing_mode": "CONDITIONAL_PAGE"},
    )
    assert service.status_code in {200, 201, 409}, service.text
    russian = client.post(
        "/api/admin/crm/languages",
        headers=headers,
        json={"name": "Русский", "active": True, "sort_order": 10},
    )
    assert russian.status_code in {201, 409}, russian.text
    for index, name in enumerate(["Японский", "Английский"], start=2):
        language = client.post(
            "/api/admin/crm/languages",
            headers=headers,
            json={"name": name, "active": True, "sort_order": index * 10},
        )
        assert language.status_code in {201, 409}, language.text

    def add_executor(name, source, target, rate):
        response = client.post(
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
        assert response.status_code == 201, response.text
        return response.json()

    jp_ru = add_executor("Дмитрий JP RU", "Русский", "Японский", "720")
    ru_en = add_executor("Василий RU EN", "Английский", "Русский", "620")
    blocked = add_executor("Олег JP RU отпуск", "Японский", "Русский", "500")

    for executor, state in [(jp_ru, "FREE"), (ru_en, "FREE"), (blocked, "VACATION")]:
        created = client.post(
            f"/api/admin/executors/{executor['id']}/availability",
            headers=headers,
            json={
                "state": state,
                "start_date": "2026-09-20",
                "end_date": "2026-09-30",
                "notes": state,
            },
        )
        assert created.status_code == 201, created.text

    order = client.post(
        "/api/admin/orders",
        headers=headers,
        json={"title": "Routed matching", "deadline": "2026-09-28"},
    ).json()
    work = client.post(
        f"/api/admin/orders/{order['id']}/works",
        headers=headers,
        json={
            "work_type": "written_translation",
            "source_language": "Японский",
            "target_language": "Английский",
            "deadline": "2026-09-25",
        },
    ).json()

    before = client.get(f"/api/admin/orders/{order['id']}/works", headers=headers).json()
    response = client.get(
        f"/api/admin/orders/{order['id']}/works/{work['id']}/executor-candidates",
        headers=headers,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    route = payload["routed_match"]
    assert route["eligible"] is True
    assert route["via_language"] == "Русский"
    assert route["complete"] is True
    assert len(route["stages"]) == 2

    first, second = route["stages"]
    assert (first["source_language"], first["target_language"]) == ("Японский", "Русский")
    assert (second["source_language"], second["target_language"]) == ("Русский", "Английский")
    assert [item["executor_name"] for item in first["candidates"]] == [
        "Дмитрий JP RU",
        "Олег JP RU отпуск",
    ]
    assert first["candidates"][0]["candidate_state"] == "AVAILABLE"
    assert first["candidates"][1]["candidate_state"] == "UNAVAILABLE"
    assert [item["executor_name"] for item in second["candidates"]] == ["Василий RU EN"]
    assert second["candidates"][0]["candidate_state"] == "AVAILABLE"

    # Phase 10.4 route discovery is read-only; no work/assignment mutation is allowed.
    after = client.get(f"/api/admin/orders/{order['id']}/works", headers=headers).json()
    assert after == before

    ru_work = client.post(
        f"/api/admin/orders/{order['id']}/works",
        headers=headers,
        json={
            "work_type": "written_translation",
            "source_language": "Русский",
            "target_language": "Английский",
        },
    ).json()
    ru_payload = client.get(
        f"/api/admin/orders/{order['id']}/works/{ru_work['id']}/executor-candidates",
        headers=headers,
    ).json()
    assert ru_payload["routed_match"]["eligible"] is False
    assert ru_payload["routed_match"]["reason"] == "RUSSIAN_IS_ENDPOINT"


def test_phase10_priority_preview_matching_ranking_route_and_direct_priority(client, create_user):
    headers = setup(client, create_user)
    service = client.post(
        "/api/admin/crm/services",
        headers=headers,
        json={"code": "written_translation", "name": "Письменный перевод", "billing_mode": "CONDITIONAL_PAGE"},
    )
    assert service.status_code == 201, service.text
    for index, name in enumerate(["Русский", "Английский", "Японский", "Немецкий", "Французский"], start=1):
        created = client.post(
            "/api/admin/crm/languages",
            headers=headers,
            json={"name": name, "active": True, "sort_order": index * 10},
        )
        assert created.status_code == 201, created.text

    def add_executor(name, source, target, rate):
        response = client.post(
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
        assert response.status_code == 201, response.text
        return response.json()

    ru_en_700 = add_executor("RU EN 700", "Русский", "Английский", "700")
    ru_en_650 = add_executor("RU EN 650", "Английский", "Русский", "650")
    jp_ru = add_executor("JP RU", "Японский", "Русский", "720")

    availability_rows = {}
    for executor in [ru_en_700, ru_en_650, jp_ru]:
        row = client.post(
            f"/api/admin/executors/{executor['id']}/availability",
            headers=headers,
            json={"state": "FREE", "start_date": "2026-09-20", "end_date": "2026-09-30", "notes": "demo"},
        )
        assert row.status_code == 201, row.text
        availability_rows[executor["id"]] = row.json()

    def preview(source, target):
        response = client.post(
            "/api/admin/orders/executor-candidates/preview",
            headers=headers,
            json={
                "service_code": "written_translation",
                "work_type": "written_translation",
                "source_language": source,
                "target_language": target,
                "deadline": "2026-09-25",
            },
        )
        assert response.status_code == 200, response.text
        return response.json()

    # TEST 1 + TEST 7: direct RU -> EN and deterministic rate-based order among equally available candidates.
    ru_en = preview("Русский", "Английский")
    assert ru_en["direct_viable"] is True
    assert [item["executor_name"] for item in ru_en["candidates"][:2]] == ["RU EN 650", "RU EN 700"]

    # TEST 2: the exact same saved capability works in reverse.
    en_ru = preview("Английский", "Русский")
    assert en_ru["direct_viable"] is True
    assert {item["executor_name"] for item in en_ru["candidates"]} == {"RU EN 650", "RU EN 700"}

    # TEST 3: with no direct JA <-> EN executor, build JA -> RU -> EN.
    routed = preview("Японский", "Английский")
    assert routed["direct_viable"] is False
    assert routed["routed_match"]["eligible"] is True
    assert routed["routed_match"]["complete"] is True
    first, second = routed["routed_match"]["stages"]
    assert (first["source_language"], first["target_language"]) == ("Японский", "Русский")
    assert (second["source_language"], second["target_language"]) == ("Русский", "Английский")
    assert first["candidates"][0]["executor_id"] == jp_ru["id"]
    assert second["candidates"][0]["executor_id"] == ru_en_650["id"]

    # TEST 4: if stage 1 becomes busy, that route is no longer complete/available.
    current = availability_rows[jp_ru["id"]]
    busy = client.patch(
        f"/api/admin/executors/{jp_ru['id']}/availability/{current['id']}",
        headers=headers,
        json={
            "version": current["version"],
            "state": "BUSY",
            "start_date": "2026-09-20",
            "end_date": "2026-09-30",
            "notes": "busy",
        },
    )
    assert busy.status_code == 200, busy.text
    busy_route = preview("Японский", "Английский")
    assert busy_route["routed_match"]["complete"] is False
    assert busy_route["routed_match"]["stages"][0]["candidates"][0]["candidate_state"] == "UNAVAILABLE"

    # Restore stage 1, then TEST 5: a direct JA <-> EN candidate suppresses the fallback route.
    restored = client.patch(
        f"/api/admin/executors/{jp_ru['id']}/availability/{busy.json()['id']}",
        headers=headers,
        json={
            "version": busy.json()["version"],
            "state": "FREE",
            "start_date": "2026-09-20",
            "end_date": "2026-09-30",
            "notes": "free again",
        },
    )
    assert restored.status_code == 200, restored.text
    direct_jp_en = add_executor("JP EN direct", "Японский", "Английский", "900")
    direct_availability = client.post(
        f"/api/admin/executors/{direct_jp_en['id']}/availability",
        headers=headers,
        json={"state": "FREE", "start_date": "2026-09-20", "end_date": "2026-09-30", "notes": "direct"},
    )
    assert direct_availability.status_code == 201, direct_availability.text
    direct_priority = preview("Японский", "Английский")
    assert direct_priority["direct_viable"] is True
    assert direct_priority["candidates"][0]["executor_id"] == direct_jp_en["id"]
    assert direct_priority["routed_match"]["eligible"] is False
    assert direct_priority["routed_match"]["reason"] == "DIRECT_MATCH_AVAILABLE"

    # TEST 6: no direct and no complete RU route stays an explicit no-match state.
    missing = preview("Немецкий", "Французский")
    assert missing["direct_viable"] is False
    assert missing["candidates"] == []
    assert missing["routed_match"]["eligible"] is True
    assert missing["routed_match"]["complete"] is False
