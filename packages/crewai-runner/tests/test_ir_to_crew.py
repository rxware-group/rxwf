import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

FIXTURES = Path(__file__).parent / "fixtures"


def load_sequential_ir() -> dict:
    return json.loads((FIXTURES / "sequential_ir.json").read_text(encoding="utf-8"))


@patch("crewai_runner.adapter.ir_to_crew.LLM")
@patch("crewai_runner.adapter.ir_to_crew.Agent")
@patch("crewai_runner.adapter.ir_to_crew.Task")
@patch("crewai_runner.adapter.ir_to_crew.Crew")
def test_build_crew_from_ir_sequential_agent_count(
    mock_crew_cls,
    mock_task_cls,
    mock_agent_cls,
    mock_llm_cls,
):
    from crewai import Process
    from crewai_runner.adapter.ir_to_crew import build_crew_from_ir

    mock_llm_cls.return_value = MagicMock(name="llm")
    mock_agent_cls.side_effect = lambda **kwargs: MagicMock(**kwargs)
    mock_task_cls.side_effect = lambda **kwargs: MagicMock(**kwargs)
    mock_crew_cls.return_value = MagicMock(name="crew")

    ir = load_sequential_ir()
    crew = build_crew_from_ir(ir)

    assert mock_agent_cls.call_count == len(ir["members"])
    assert mock_task_cls.call_count == len(ir["members"])
    mock_crew_cls.assert_called_once()
    crew_kwargs = mock_crew_cls.call_args.kwargs
    assert crew_kwargs["process"] == Process.sequential
    assert len(crew_kwargs["agents"]) == 2
    assert len(crew_kwargs["tasks"]) == 2
    assert "manager_llm" not in crew_kwargs
    assert crew is mock_crew_cls.return_value


@patch("crewai_runner.adapter.ir_to_crew.LLM")
@patch("crewai_runner.adapter.ir_to_crew.Agent")
@patch("crewai_runner.adapter.ir_to_crew.Task")
@patch("crewai_runner.adapter.ir_to_crew.Crew")
def test_build_crew_from_ir_uses_ollama_llm(
    mock_crew_cls,
    mock_task_cls,
    mock_agent_cls,
    mock_llm_cls,
):
    from crewai_runner.adapter.ir_to_crew import build_crew_from_ir

    mock_llm_cls.return_value = MagicMock(name="llm")
    mock_agent_cls.side_effect = lambda **kwargs: MagicMock(**kwargs)
    mock_task_cls.side_effect = lambda **kwargs: MagicMock(**kwargs)
    mock_crew_cls.return_value = MagicMock(name="crew")

    ir = load_sequential_ir()
    build_crew_from_ir(ir)

    mock_llm_cls.assert_called_with(
        model="ollama/llama3",
        base_url="http://host.docker.internal:11434",
    )


@patch("crewai_runner.adapter.ir_to_crew.LLM")
@patch("crewai_runner.adapter.ir_to_crew.Agent")
@patch("crewai_runner.adapter.ir_to_crew.Task")
@patch("crewai_runner.adapter.ir_to_crew.Crew")
def test_build_crew_from_ir_hierarchical_sets_manager_llm(
    mock_crew_cls,
    mock_task_cls,
    mock_agent_cls,
    mock_llm_cls,
):
    from crewai import Process
    from crewai_runner.adapter.ir_to_crew import build_crew_from_ir

    mock_llm_cls.return_value = MagicMock(name="llm")
    mock_agent_cls.side_effect = lambda **kwargs: MagicMock(**kwargs)
    mock_task_cls.side_effect = lambda **kwargs: MagicMock(**kwargs)
    mock_crew_cls.return_value = MagicMock(name="crew")

    ir = load_sequential_ir()
    ir["process"] = "hierarchical"
    ir["crewParams"] = {"crewaiProcess": "hierarchical"}
    ir["manager"] = {
        "nodeId": "mgr",
        "name": "Manager",
        "role": "Manager",
        "model": {"provider": "ollama", "model": "llama3"},
        "tools": [],
    }

    build_crew_from_ir(ir)

    crew_kwargs = mock_crew_cls.call_args.kwargs
    assert crew_kwargs["process"] == Process.hierarchical
    assert "manager_llm" in crew_kwargs


def test_member_llm_openai_compatible_requires_api_key():
    from crewai_runner.adapter.ir_to_crew import member_llm

    with pytest.raises(ValueError, match="E1045"):
        member_llm({"model": {"provider": "openai-compatible", "model": "gpt-4"}}, {})


@patch("crewai_runner.adapter.ir_to_crew.LLM")
@patch("crewai_runner.adapter.ir_to_crew.resolve_openai_api_key")
def test_member_llm_openai_compatible_builds_llm(mock_resolve, mock_llm_cls):
    from crewai_runner.adapter.ir_to_crew import member_llm

    mock_resolve.return_value = "sk-test"
    execution = {"executionId": "ex-1"}

    member_llm(
        {
            "model": {
                "provider": "openai-compatible",
                "model": "gpt-4",
                "baseUrl": "https://api.example.com/v1",
                "credentialRef": "cred-1",
            }
        },
        execution,
    )

    mock_resolve.assert_called_once_with(execution, "cred-1")
    mock_llm_cls.assert_called_once_with(
        model="openai/gpt-4",
        api_key="sk-test",
        base_url="https://api.example.com/v1",
    )


@patch("crewai_runner.adapter.ir_to_crew.LLM")
@patch("crewai_runner.adapter.ir_to_crew.Agent")
@patch("crewai_runner.adapter.ir_to_crew.Task")
@patch("crewai_runner.adapter.ir_to_crew.Crew")
def test_build_crew_from_ir_supervisor_sets_manager_agent(
    mock_crew_cls,
    mock_task_cls,
    mock_agent_cls,
    mock_llm_cls,
):
    from crewai import Process
    from crewai_runner.adapter.ir_to_crew import build_crew_from_ir

    mock_llm_cls.return_value = MagicMock(name="llm")
    mock_agent_cls.side_effect = lambda **kwargs: MagicMock(**kwargs)
    mock_task_cls.side_effect = lambda **kwargs: MagicMock(**kwargs)
    mock_crew_cls.return_value = MagicMock(name="crew")

    ir = load_sequential_ir()
    ir["process"] = "supervisor"
    ir["crewParams"] = {"crewaiProcess": "hierarchical"}
    ir["manager"] = {
        "nodeId": "mgr",
        "name": "Supervisor",
        "role": "Supervisor",
        "goal": "Delegate work",
        "model": {"provider": "ollama", "model": "llama3"},
        "tools": [],
    }

    build_crew_from_ir(ir)

    crew_kwargs = mock_crew_cls.call_args.kwargs
    assert crew_kwargs["process"] == Process.hierarchical
    assert "manager_agent" in crew_kwargs
    assert "manager_llm" not in crew_kwargs


@patch("crewai_runner.adapter.ir_to_crew.LLM")
@patch("crewai_runner.adapter.ir_to_crew.Agent")
@patch("crewai_runner.adapter.ir_to_crew.Task")
@patch("crewai_runner.adapter.ir_to_crew.Crew")
def test_build_crew_from_ir_injects_memory_history_into_backstory(
    mock_crew_cls,
    mock_task_cls,
    mock_agent_cls,
    mock_llm_cls,
):
    from crewai_runner.adapter.ir_to_crew import build_crew_from_ir

    mock_llm_cls.return_value = MagicMock(name="llm")
    mock_agent_cls.side_effect = lambda **kwargs: MagicMock(**kwargs)
    mock_task_cls.side_effect = lambda **kwargs: MagicMock(**kwargs)
    mock_crew_cls.return_value = MagicMock(name="crew")

    ir = load_sequential_ir()
    ir["members"][0]["memory"] = {
        "sessionId": "sess-1",
        "maxTurns": 10,
        "history": [{"role": "user", "content": "hello"}],
    }

    build_crew_from_ir(ir)

    agent_kwargs = mock_agent_cls.call_args_list[0].kwargs
    assert "Prior conversation" in agent_kwargs["backstory"]
    assert "hello" in agent_kwargs["backstory"]


@patch("crewai_runner.adapter.ir_to_crew.LLM")
@patch("crewai_runner.adapter.ir_to_crew.Agent")
@patch("crewai_runner.adapter.ir_to_crew.Task")
@patch("crewai_runner.adapter.ir_to_crew.Crew")
@patch("crewai_runner.adapter.ir_to_crew.resolve_member_knowledge")
def test_build_crew_from_ir_attaches_knowledge_sources(
    mock_resolve,
    mock_crew_cls,
    mock_task_cls,
    mock_agent_cls,
    mock_llm_cls,
):
    from crewai_runner.adapter.ir_to_crew import build_crew_from_ir

    sentinel = object()
    mock_resolve.return_value = ([sentinel], "")
    mock_llm_cls.return_value = MagicMock(name="llm")
    mock_agent_cls.side_effect = lambda **kwargs: MagicMock(**kwargs)
    mock_task_cls.side_effect = lambda **kwargs: MagicMock(**kwargs)
    mock_crew_cls.return_value = MagicMock(name="crew")

    ir = load_sequential_ir()
    ir["crewParams"] = {"crewaiKnowledgeMode": "native"}
    ir["members"][0]["knowledge"] = {
        "knowledgeBaseIds": ["kb-1"],
        "chunks": [{"text": "chunk text"}],
    }

    build_crew_from_ir(ir)

    agent_kwargs = mock_agent_cls.call_args_list[0].kwargs
    assert agent_kwargs["knowledge_sources"] == [sentinel]


def test_awf_process_to_crewai():
    from crewai import Process
    from crewai_runner.adapter.process_map import awf_process_to_crewai

    assert awf_process_to_crewai({"process": "sequential"}) == Process.sequential
    assert (
        awf_process_to_crewai({"crewParams": {"crewaiProcess": "hierarchical"}})
        == Process.hierarchical
    )
    assert awf_process_to_crewai({"process": "supervisor"}) == Process.hierarchical
