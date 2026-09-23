import io

import openpyxl
import xlwt

from app.client_models import Company
from app.db import SessionLocal
from app.models import Role
from tests.test_operations import setup


def test_xls_contacts_executors_orders(client, create_user):
    headers = setup(client, create_user)
    company = client.post(
        "/api/admin/companies", headers=headers, json={"name": "Компания для импорта"}
    ).json()
    fixtures = [
        ("contacts", [["Имя", "ID клиента"], ["Контакт", company["id"]]]),
        ("executors", [["Имя", "Email"], ["Исполнитель", "translator@example.com"]]),
        ("orders", [["ID клиента"], [company["id"]]]),
    ]
    for entity, rows in fixtures:
        book = xlwt.Workbook()
        sheet = book.add_sheet("Данные")
        for i, row in enumerate(rows):
            for j, value in enumerate(row):
                sheet.write(i, j, value)
        stream = io.BytesIO()
        book.save(stream)
        result = client.post(
            "/api/admin/imports/preview",
            headers=headers,
            data={"entity": entity},
            files={"upload": ("legacy.xls", stream.getvalue())},
        )
        assert result.status_code == 201, result.text
        preview = result.json()
        assert preview["valid"] == 1, preview
        done = client.post(
            f"/api/admin/imports/{preview['id']}/confirm", headers=headers, json={"valid_rows": 1}
        )
        assert done.status_code == 200, done.text
        assert done.json()["report"]["count"] == 1


def table(rows):
    book = openpyxl.Workbook()
    for row in rows:
        book.active.append(row)
    stream = io.BytesIO()
    book.save(stream)
    return stream.getvalue()


def test_preview_confirmation_duplicates_and_invalid_rows(client, create_user):
    headers = setup(client, create_user)
    content = table(
        [
            ["Название", "Email"],
            ["Альфа", "alpha@example.com"],
            ["Бета", "invalid"],
            ["Альфа", "alpha@example.com"],
        ]
    )
    response = client.post(
        "/api/admin/imports/preview",
        headers=headers,
        data={"entity": "clients"},
        files={"upload": ("clients.xlsx", content)},
    )
    assert response.status_code == 201, response.text
    preview = response.json()
    assert preview["total"] == 3 and preview["valid"] == 1 and preview["invalid"] == 2
    with SessionLocal() as db:
        assert db.query(Company).count() == 0
    path = f"/api/admin/imports/{preview['id']}/confirm"
    assert client.post(path, headers=headers, json={"valid_rows": 9}).status_code == 409
    first = client.post(path, headers=headers, json={"valid_rows": 1})
    assert first.status_code == 200, first.text
    assert first.json()["report"]["count"] == 1
    assert client.post(path, headers=headers, json={"valid_rows": 1}).json() == first.json()
    with SessionLocal() as db:
        assert db.query(Company).count() == 1


def test_import_mapping_and_formulas(client, create_user):
    headers = setup(client, create_user)
    content = table([["Контрагент"], ["Клиент"]])
    assert (
        client.post(
            "/api/admin/imports/preview",
            headers=headers,
            data={"entity": "clients"},
            files={"upload": ("c.xlsx", content)},
        ).status_code
        == 422
    )
    result = client.post(
        "/api/admin/imports/preview",
        headers=headers,
        data={"entity": "clients", "mapping": '{"Контрагент":"name"}'},
        files={"upload": ("c.xlsx", content)},
    )
    assert result.status_code == 201 and result.json()["valid"] == 1
    assert (
        client.post(
            "/api/admin/imports/preview",
            headers=headers,
            data={"entity": "clients"},
            files={"upload": ("c.xlsx", table([["Имя"], ["=1+2"]]))},
        ).status_code
        == 422
    )


def test_manager_cannot_import(client, create_user):
    headers = setup(client, create_user, Role.MANAGER)
    assert (
        client.post(
            "/api/admin/imports/preview",
            headers=headers,
            data={"entity": "clients"},
            files={"upload": ("c.xlsx", table([["Имя"], ["Имя"]]))},
        ).status_code
        == 403
    )
