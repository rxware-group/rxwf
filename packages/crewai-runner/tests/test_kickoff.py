from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from crewai_runner.main import app


def load_sequential_ir():
    import json
    from pathlib import Path

    fixture = Path(__file__).parent / "fixtures" / "sequential_ir.json"
    return json.loads(fixture.read_text(encoding="utf-8"))


@patch("crewai_runner.kickoff.build_crew_from_ir")
def test_run_kickoff_success(mock_build_crew):
    from crewai_runner.kickoff import run_kickoff

    mock_crew = MagicMock()
    mock_crew.kickoff.return_value = "crew result"
    mock_build_crew.return_value = mock_crew

    ir = load_sequential_ir()
    result = run_kickoff(ir)

    assert result["status"] == "success"
    assert result["answer"] == "crew result"
    assert len(result["crewSteps"]) == len(ir["members"])
    assert result["agentSteps"] == []
    mock_crew.kickoff.assert_called_once_with(inputs={"task": ir["inputTask"]})


def test_run_kickoff_rejects_unsupported_ir_version():
    from crewai_runner.kickoff import run_kickoff

    ir = load_sequential_ir()
    ir["irVersion"] = 2

    try:
        run_kickoff(ir)
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "E1044" in str(exc)


def test_kickoff_endpoint_success():
    client = TestClient(app)
    ir = load_sequential_ir()

    with patch("crewai_runner.kickoff.build_crew_from_ir") as mock_build_crew:
        mock_crew = MagicMock()
        mock_crew.kickoff.return_value = "endpoint answer"
        mock_build_crew.return_value = mock_crew

        response = client.post("/v1/kickoff", json=ir)

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["answer"] == "endpoint answer"


def test_run_kickoff_rejects_consensual_process():
    from crewai_runner.kickoff import run_kickoff

    ir = load_sequential_ir()
    ir["crewParams"] = {"crewaiProcess": "consensual"}

    try:
        run_kickoff(ir)
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "E1046" in str(exc)


def test_kickoff_endpoint_bad_ir_version():
    client = TestClient(app)
    ir = load_sequential_ir()
    ir["irVersion"] = 99

    response = client.post("/v1/kickoff", json=ir)

    assert response.status_code == 400
    assert "E1044" in response.json()["detail"]
