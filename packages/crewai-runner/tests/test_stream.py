from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from crewai_runner.main import app


def load_sequential_ir():
    import json
    from pathlib import Path

    fixture = Path(__file__).parent / "fixtures" / "sequential_ir.json"
    return json.loads(fixture.read_text(encoding="utf-8"))


def test_kickoff_stream_endpoint_emits_done():
    client = TestClient(app)
    ir = load_sequential_ir()

    with patch("crewai_runner.stream.run_kickoff") as mock_run:
        mock_run.return_value = {
            "status": "success",
            "answer": "stream answer",
            "crewSteps": [],
            "agentSteps": [],
        }

        with client.stream("POST", "/v1/kickoff/stream", json=ir) as response:
            assert response.status_code == 200
            body = "".join(response.iter_text())

    assert "event: agent_step" in body
    assert "event: done" in body
    assert "stream answer" in body
