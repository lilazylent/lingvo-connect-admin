from concurrent.futures import ThreadPoolExecutor

from tests.conftest import csrf_headers
from tests.test_auth import login


def test_parallel_setup_returns_one_stable_key(client, create_user):
    create_user("owner@example.com")
    assert login(client).status_code == 200
    assert (
        client.post(
            "/api/admin/auth/change-password",
            headers=csrf_headers(client),
            json={"new_password": "PermanentPass456!"},
        ).status_code
        == 200
    )
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(pool.map(lambda _: client.get("/api/admin/auth/2fa/setup"), range(8)))
    assert all(r.status_code == 200 for r in responses)
    assert len({r.json()["manual_key"] for r in responses}) == 1
