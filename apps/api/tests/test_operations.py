from app.db import SessionLocal
from app.models import Role
from app.operations_models import OrderCounter
from tests.conftest import csrf_headers
from tests.test_applications import manual_payload
from tests.test_auth import complete_first_login


def setup(client, create_user, role=Role.ADMIN):
    complete_first_login(client, create_user, role=role)
    with SessionLocal() as db:
        db.add(OrderCounter(id=1, value=0))
        db.commit()
    return csrf_headers(client)


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
    assert order["number"] == "LC-O-000001"
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
