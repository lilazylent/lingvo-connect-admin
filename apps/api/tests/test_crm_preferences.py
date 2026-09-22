from app.crm_models import OrderStatusOption
from app.db import SessionLocal
from app.models import Role
from tests.conftest import csrf_headers
from tests.test_auth import complete_first_login


def test_theme_preference_is_personal_and_persistent(client, create_user):
    complete_first_login(client, create_user, role=Role.MANAGER)
    assert client.get("/api/admin/users/me/preferences").json() == {
        "interface_theme": "system"
    }
    updated = client.patch(
        "/api/admin/users/me/preferences",
        headers=csrf_headers(client),
        json={"interface_theme": "dark"},
    )
    assert updated.status_code == 200
    assert updated.json() == {"interface_theme": "dark"}
    assert client.get("/api/admin/users/me/preferences").json()["interface_theme"] == "dark"


def test_admin_can_edit_status(client, create_user):
    complete_first_login(client, create_user, role=Role.ADMIN)
    with SessionLocal() as db:
        db.add(OrderStatusOption(code="NEW", name="Новый", color="blue", sort_order=10))
        db.commit()
    response = client.patch(
        "/api/admin/crm/order-statuses/NEW",
        headers=csrf_headers(client),
        json={"name": "Новая заявка", "color": "violet", "active": True, "sort_order": 20},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Новая заявка"
    assert response.json()["color"] == "violet"


def test_admin_can_create_archive_status(client, create_user):
    complete_first_login(client, create_user, role=Role.ADMIN)
    response = client.post(
        "/api/admin/crm/order-statuses",
        headers=csrf_headers(client),
        json={
            "name": "Перенесён",
            "color": "amber",
            "board": "ARCHIVE",
            "active": True,
            "sort_order": 120,
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["name"] == "Перенесён"
    assert response.json()["board"] == "ARCHIVE"
    assert response.json()["code"].startswith("CUSTOM_")


def test_builtin_status_cannot_move_between_boards(client, create_user):
    complete_first_login(client, create_user, role=Role.ADMIN)
    with SessionLocal() as db:
        db.add(OrderStatusOption(code="CANCELLED", name="Отменён", color="rose", board="ARCHIVE", sort_order=90))
        db.commit()
    response = client.patch(
        "/api/admin/crm/order-statuses/CANCELLED",
        headers=csrf_headers(client),
        json={"name": "Отменён", "color": "rose", "board": "MAIN", "active": True, "sort_order": 90},
    )
    assert response.status_code == 409, response.text
