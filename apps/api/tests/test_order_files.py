"""An order keeps every attachment: uploads append, deletes remove exactly one file."""

from app.config import get_settings
from app.storage import storage_from_settings
from tests.test_crm import setup

ANALYZE = "/api/admin/crm/orders/{order}/files/analyze"  # order card / wizard upload
UPLOAD = "/api/admin/orders/{order}/files"  # global Files section upload


def _upload(client, headers, path, order_id, name, content):
    return client.post(
        path.format(order=order_id), headers=headers, files={"upload": (name, content, "text/plain")}
    )


def _names(client, order_id):
    detail = client.get(f"/api/admin/crm/orders/{order_id}").json()
    return sorted(item["original_name"] for item in detail["files"]), detail["files"]


def test_order_attachments_append_and_delete_individually(client, create_user):
    headers = setup(client, create_user)
    order = client.post("/api/admin/crm/orders/wizard", headers=headers, json={}).json()
    order_id = order["id"]

    # Order with File A, then File B uploaded later: both remain.
    assert _upload(client, headers, ANALYZE, order_id, "A.txt", b"file a").status_code == 201
    assert _upload(client, headers, ANALYZE, order_id, "B.txt", b"file b").status_code == 201
    assert _names(client, order_id)[0] == ["A.txt", "B.txt"]

    # C + D + E selected together are sent one by one by the UI; all are attached.
    for name in ("C.txt", "D.txt", "E.txt"):
        assert _upload(client, headers, UPLOAD, order_id, name, f"file {name}".encode()).status_code == 201
    names, files = _names(client, order_id)
    assert names == ["A.txt", "B.txt", "C.txt", "D.txt", "E.txt"]
    listed = client.get(f"/api/admin/orders/{order_id}/files").json()
    assert listed["total"] == 5

    # A failed file in the batch does not touch the files that already exist.
    failed = client.post(
        UPLOAD.format(order=order_id), headers=headers, files={"upload": ("broken.pdf", b"not a pdf")}
    )
    assert failed.status_code == 422
    assert _names(client, order_id)[0] == ["A.txt", "B.txt", "C.txt", "D.txt", "E.txt"]

    # Deleting D removes only D (row and stored blob).
    file_d = next(item for item in files if item["original_name"] == "D.txt")
    storage = storage_from_settings(get_settings().application_storage_path, get_settings().application_file_max_bytes)
    assert storage.resolve(file_d["storage_key"]).is_file()
    deleted = client.delete(f"/api/admin/orders/{order_id}/files/{file_d['id']}", headers=headers)
    assert deleted.status_code == 200, deleted.text
    assert _names(client, order_id)[0] == ["A.txt", "B.txt", "C.txt", "E.txt"]
    assert not storage.resolve(file_d["storage_key"]).exists()
    assert client.get(f"/api/admin/orders/{order_id}/files/{file_d['id']}/download").status_code == 404
    for item in files:
        if item["original_name"] != "D.txt":
            assert client.get(f"/api/admin/orders/{order_id}/files/{item['id']}/download").status_code == 200

    # A file id from another order cannot be deleted through this order.
    other = client.post("/api/admin/crm/orders/wizard", headers=headers, json={}).json()
    file_a = next(item for item in files if item["original_name"] == "A.txt")
    assert client.delete(f"/api/admin/orders/{other['id']}/files/{file_a['id']}", headers=headers).status_code == 404
    assert "A.txt" in _names(client, order_id)[0]


def test_duplicate_filenames_do_not_overwrite_each_other(client, create_user):
    headers = setup(client, create_user)
    order_id = client.post("/api/admin/crm/orders/wizard", headers=headers, json={}).json()["id"]
    first = _upload(client, headers, ANALYZE, order_id, "scan.txt", b"first version").json()
    second = _upload(client, headers, ANALYZE, order_id, "scan.txt", b"second version").json()
    assert first["storage_key"] != second["storage_key"]
    names, _ = _names(client, order_id)
    assert names == ["scan.txt", "scan.txt"]
    for item, content in ((first, b"first version"), (second, b"second version")):
        body = client.get(f"/api/admin/orders/{order_id}/files/{item['id']}/download").content
        assert body == content
