from __future__ import annotations


async def test_unknown_route_returns_404(client):
    response = await client.get("/api/v1/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {"success": False, "message": "Not found."}


async def test_wrong_method_returns_405(client):
    response = await client.put("/health")

    assert response.status_code == 405
    assert response.json() == {"success": False, "message": "Method not allowed."}
