from fastapi.testclient import TestClient

from crewai_runner.health import health_payload
from crewai_runner.main import app


def test_health_payload():
    payload = health_payload()
    assert payload["status"] == "ok"
    assert isinstance(payload["crewaiVersion"], str)
    assert payload["crewaiVersion"]
    assert payload["supportedIrVersions"] == [1]


def test_health_endpoint():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert isinstance(data["crewaiVersion"], str)
    assert data["supportedIrVersions"] == [1]
