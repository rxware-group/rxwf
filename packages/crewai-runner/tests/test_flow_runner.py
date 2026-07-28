from unittest.mock import MagicMock, patch

from crewai_runner.eval import build_crew_eval
from crewai_runner.flow_runner import linearize_flow, run_flow_kickoff


def test_build_crew_eval_when_disabled():
    ir = {"crewParams": {}, "members": [{"nodeId": "a1"}]}
    assert build_crew_eval(ir, "answer", []) is None


def test_build_crew_eval_returns_scores():
    ir = {"crewParams": {"enableEval": True}, "members": [{"nodeId": "a1"}, {"nodeId": "a2"}]}
    result = build_crew_eval(ir, "a" * 100, [{"nodeId": "a1"}, {"nodeId": "a2"}])
    assert result is not None
    assert result["overallScore"] >= 0
    assert len(result["criteria"]) == 2


def test_linearize_flow_linear_graph():
    flow = {
        "entryNodeId": "start",
        "nodes": [
            {"id": "start", "type": "start"},
            {"id": "t1", "type": "task", "memberNodeId": "a1"},
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"from": "start", "to": "t1"},
            {"from": "t1", "to": "end"},
        ],
    }
    tasks = linearize_flow(flow)
    assert len(tasks) == 1
    assert tasks[0]["memberNodeId"] == "a1"


def test_linearize_flow_with_router_branch():
    flow = {
        "entryNodeId": "start",
        "nodes": [
            {"id": "start", "type": "start"},
            {"id": "t1", "type": "task", "memberNodeId": "a1"},
            {
                "id": "router",
                "type": "router",
                "router": {
                    "defaultNext": "t2",
                    "branches": [
                        {"label": "edit", "condition": "contains:edit", "next": "t3"},
                    ],
                },
            },
            {"id": "t2", "type": "task", "memberNodeId": "a2"},
            {"id": "t3", "type": "task", "memberNodeId": "a3"},
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"from": "start", "to": "t1"},
            {"from": "t1", "to": "router"},
            {"from": "t2", "to": "end"},
            {"from": "t3", "to": "end"},
        ],
    }

    tasks = linearize_flow(flow, "please edit this")
    assert len(tasks) == 2
    assert tasks[0]["memberNodeId"] == "a1"
    assert tasks[1]["memberNodeId"] == "a3"


@patch("crewai_runner.flow_runner.build_crew_from_ir")
def test_run_flow_kickoff(mock_build_crew):
    mock_crew = MagicMock()
    mock_crew.kickoff.return_value = "flow answer"
    mock_build_crew.return_value = mock_crew

    ir = {
        "inputTask": "task",
        "members": [
            {"nodeId": "a1", "name": "Writer", "role": "Writer"},
        ],
        "flowGraph": {
            "entryNodeId": "start",
            "nodes": [
                {"id": "start", "type": "start"},
                {"id": "t1", "type": "task", "memberNodeId": "a1"},
                {"id": "end", "type": "end"},
            ],
            "edges": [
                {"from": "start", "to": "t1"},
                {"from": "t1", "to": "end"},
            ],
        },
        "crewParams": {"enableEval": True},
    }

    result = run_flow_kickoff(ir)
    assert result["answer"] == "flow answer"
    assert result["flowMode"] is True
    assert len(result["crewSteps"]) == 1
    assert result["crewEval"]["overallScore"] >= 0
