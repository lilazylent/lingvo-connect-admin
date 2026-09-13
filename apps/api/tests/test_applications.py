import io
import json

import pytest

from app.db import SessionLocal
from app.models import (
    Application,
    ApplicationActivity,
    ApplicationComment,
    ApplicationFile,
    Role,
)
from app.routers.applications import public_rate_limiter
from tests.conftest import csrf_headers
from tests.test_auth import complete_first_login


@pytest.fixture(autouse=True)
def reset_public_rate_limiter():
    public_rate_limiter.reset()


def public_payload() -> dict:
    return {
        "name": "Анна Петрова",
        "contact_method": "email",
        "contact": "Anna@Example.com",
        "requested_service": "written_translation",
        "message": "Нужен перевод юридического договора на английский язык.",
        "consent_accepted": True,
        "consent_version": "2026-08-draft-v1",
        "source_identifier": "request_page",
        "utm_source": "phase2-test",
    }


def manual_payload(manager_id: str | None = None) -> dict:
    return {
        "name": "Иван Соколов",
        "contact_method": "phone",
        "contact": "+7 999 123-45-67",
        "company": "Контекст",
        "requested_service": "localization",
        "source_language": "Русский",
        "target_language": "Английский",
        "message": "Заявка получена по телефону.",
        "responsible_user_id": manager_id,
    }


def test_public_application_is_validated_persisted_and_idempotent(client):
    headers = {"Idempotency-Key": "83f0bc8c-39aa-489c-b9fd-09b9703c02c9"}
    first = client.post("/api/public/leads", json=public_payload(), headers=headers)
    second = client.post("/api/public/leads", json=public_payload(), headers=headers)

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["number"] == "LC-A-000001"
    assert first.json()["id"] == second.json()["id"]
    with SessionLocal() as db:
        item = db.query(Application).one()
        assert item.email == "anna@example.com"
        assert item.source == "website"
        assert item.source_identifier == "request_page"
        assert (
            db.query(ApplicationActivity).filter_by(event_type="application_created").count() == 1
        )


def test_public_application_attachment_is_available_in_authenticated_card(client, create_user):
    headers = {"Idempotency-Key": "93f0bc8c-39aa-489c-b9fd-09b9703c02c9"}
    request = {
        "data": {"payload": json.dumps(public_payload())},
        "files": {
            "upload": (
                "client-brief.pdf",
                io.BytesIO(b"%PDF-1.4\npublic application\n%%EOF"),
                "application/pdf",
            )
        },
        "headers": headers,
    }
    first = client.post("/api/public/leads/with-attachment", **request)
    request["files"]["upload"] = (
        "client-brief.pdf",
        io.BytesIO(b"%PDF-1.4\npublic application\n%%EOF"),
        "application/pdf",
    )
    second = client.post("/api/public/leads/with-attachment", **request)

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    application_id = first.json()["id"]
    with SessionLocal() as db:
        assert db.query(ApplicationFile).count() == 1
        stored = db.query(ApplicationFile).one()
        assert stored.uploaded_by is None
        assert (
            db.query(ApplicationActivity).filter_by(event_type="public_file_attached").count() == 1
        )

    assert (
        client.get(
            f"/api/admin/applications/{application_id}/files/{stored.id}/download"
        ).status_code
        == 401
    )
    complete_first_login(client, create_user)
    detail = client.get(f"/api/admin/applications/{application_id}")
    assert detail.status_code == 200
    assert detail.json()["files"][0]["uploader"] is None
    download = client.get(f"/api/admin/applications/{application_id}/files/{stored.id}/download")
    assert download.status_code == 200
    assert download.content.startswith(b"%PDF-")


def test_public_application_rejects_unsafe_attachment(client):
    response = client.post(
        "/api/public/leads/with-attachment",
        data={"payload": json.dumps(public_payload())},
        files={"upload": ("danger.exe", b"MZ", "application/octet-stream")},
        headers={"Idempotency-Key": "a3f0bc8c-39aa-489c-b9fd-09b9703c02c9"},
    )
    assert response.status_code == 422
    with SessionLocal() as db:
        assert db.query(Application).count() == 0


def test_public_validation_honeypot_and_payload_limit(client):
    invalid = public_payload()
    invalid["consent_accepted"] = False
    assert (
        client.post(
            "/api/public/leads",
            json=invalid,
            headers={"Idempotency-Key": "49a40bcf-5c9c-4c60-a9c0-89925d4886aa"},
        ).status_code
        == 422
    )

    spam = public_payload()
    spam["website"] = "https://spam.example"
    response = client.post(
        "/api/public/leads",
        json=spam,
        headers={"Idempotency-Key": "59a40bcf-5c9c-4c60-a9c0-89925d4886bb"},
    )
    assert response.status_code == 201
    with SessionLocal() as db:
        assert db.query(Application).count() == 0

    oversized = client.post(
        "/api/public/leads",
        content=b"{}",
        headers={"Content-Length": "70000", "Content-Type": "application/json"},
    )
    assert oversized.status_code == 413


def test_public_rate_limit(client):
    for index in range(5):
        response = client.post(
            "/api/public/leads",
            json={**public_payload(), "message": f"Проверка заявки номер {index} для rate limit."},
            headers={"Idempotency-Key": f"00000000-0000-4000-8000-{index:012d}"},
        )
        assert response.status_code == 201
    limited = client.post(
        "/api/public/leads",
        json=public_payload(),
        headers={"Idempotency-Key": "00000000-0000-4000-8000-999999999999"},
    )
    assert limited.status_code == 429


def test_unauthenticated_admin_access_is_rejected(client):
    assert client.get("/api/admin/applications").status_code == 401
    assert client.post("/api/admin/applications", json=manual_payload()).status_code == 401


def test_manual_create_list_search_filter_sort_and_detail(client, create_user):
    complete_first_login(client, create_user)
    manager = create_user("manager@example.com", role=Role.MANAGER)
    created = client.post(
        "/api/admin/applications",
        json={**manual_payload(manager.id), "desired_date": "2026-10-15"},
        headers=csrf_headers(client),
    )
    assert created.status_code == 201
    item = created.json()
    assert item["number"] == "LC-A-000001"
    assert item["source"] == "manual"
    assert item["responsible_manager"]["id"] == manager.id

    search = client.get("/api/admin/applications?search=Контекст&sort=number&order=asc")
    assert search.status_code == 200
    assert search.json()["total"] == 1
    filtered = client.get(
        "/api/admin/applications?status_code=NEW&source=manual&language=Англ"
        "&deadline_from=2026-10-01&deadline_to=2026-10-31&manager_id=" + manager.id
    )
    assert filtered.json()["total"] == 1
    sorted_by_deadline = client.get("/api/admin/applications?sort=desired_date&order=asc")
    assert sorted_by_deadline.status_code == 200
    assert sorted_by_deadline.json()["items"][0]["desired_date"] == "2026-10-15"
    assert client.get(f"/api/admin/applications/{item['id']}").status_code == 200


def test_status_manager_comments_files_and_activity(client, create_user):
    complete_first_login(client, create_user)
    manager = create_user("manager@example.com", role=Role.MANAGER)
    created = client.post(
        "/api/admin/applications",
        json=manual_payload(),
        headers=csrf_headers(client),
    ).json()
    application_id = created["id"]

    updated = client.patch(
        f"/api/admin/applications/{application_id}",
        json={
            "responsible_user_id": manager.id,
            "internal_summary": "Связаться после 15:00",
            "version": created["version"],
        },
        headers=csrf_headers(client),
    )
    assert updated.status_code == 200
    assert updated.json()["responsible_manager"]["id"] == manager.id

    changed = client.post(
        f"/api/admin/applications/{application_id}/status",
        json={"status_code": "IN_PROGRESS"},
        headers=csrf_headers(client),
    )
    assert changed.status_code == 200
    assert changed.json()["status_code"] == "IN_PROGRESS"

    comment = client.post(
        f"/api/admin/applications/{application_id}/comments",
        json={"body": "Клиент подтвердил языковую пару."},
        headers=csrf_headers(client),
    )
    assert comment.status_code == 201
    assert (
        client.patch(
            f"/api/admin/applications/{application_id}/comments/{comment.json()['id']}",
            json={"body": "Клиент подтвердил языковую пару и срок."},
            headers=csrf_headers(client),
        ).status_code
        == 200
    )

    uploaded = client.post(
        f"/api/admin/applications/{application_id}/files",
        files={"upload": ("brief.pdf", io.BytesIO(b"%PDF-1.4\nphase2\n%%EOF"), "application/pdf")},
        headers=csrf_headers(client),
    )
    assert uploaded.status_code == 201
    file_id = uploaded.json()["id"]
    download = client.get(f"/api/admin/applications/{application_id}/files/{file_id}/download")
    assert download.status_code == 200
    assert download.content.startswith(b"%PDF-")
    assert (
        client.post(
            f"/api/admin/applications/{application_id}/files",
            files={"upload": ("danger.exe", b"MZ", "application/octet-stream")},
            headers=csrf_headers(client),
        ).status_code
        == 422
    )

    activity = client.get(f"/api/admin/applications/{application_id}/activity")
    assert activity.status_code == 200
    event_types = {event["event_type"] for event in activity.json()}
    assert {
        "application_created",
        "manager_assigned",
        "application_updated",
        "status_changed",
        "comment_created",
        "comment_edited",
        "file_uploaded",
    }.issubset(event_types)
    with SessionLocal() as db:
        assert db.query(ApplicationComment).count() == 1
        assert db.query(ApplicationFile).count() == 1


def test_optimistic_conflict_is_reported(client, create_user):
    complete_first_login(client, create_user)
    created = client.post(
        "/api/admin/applications",
        json=manual_payload(),
        headers=csrf_headers(client),
    ).json()
    first = client.patch(
        f"/api/admin/applications/{created['id']}",
        json={"internal_summary": "Первая версия", "version": created["version"]},
        headers=csrf_headers(client),
    )
    assert first.status_code == 200
    conflict = client.patch(
        f"/api/admin/applications/{created['id']}",
        json={"internal_summary": "Устаревшая версия", "version": created["version"]},
        headers=csrf_headers(client),
    )
    assert conflict.status_code == 409


def test_manager_can_operate_applications_but_not_admin_apis(client, create_user):
    complete_first_login(client, create_user, email="manager@example.com", role=Role.MANAGER)
    created = client.post(
        "/api/admin/applications",
        json=manual_payload(),
        headers=csrf_headers(client),
    )
    assert created.status_code == 201
    assert client.get("/api/admin/applications").status_code == 200
    assert (
        client.post(
            f"/api/admin/applications/{created.json()['id']}/status",
            json={"status_code": "IN_PROGRESS"},
            headers=csrf_headers(client),
        ).status_code
        == 200
    )
    assert client.get("/api/admin/users").status_code == 403
    assert client.get("/api/admin/settings").status_code == 403
    assert client.get("/api/admin/tariffs").status_code == 403


def test_dashboard_uses_real_application_values(client, create_user):
    complete_first_login(client, create_user)
    client.post(
        "/api/admin/applications",
        json=manual_payload(),
        headers=csrf_headers(client),
    )
    summary = client.get("/api/admin/dashboard/summary")
    assert summary.status_code == 200
    assert summary.json()["new"] == 1
    assert summary.json()["total"] == 1
    assert len(summary.json()["recent"]) == 1
