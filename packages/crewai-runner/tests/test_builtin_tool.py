import pytest

from crewai_runner.tools.builtin_tool import (
    BUILTIN_TOOL_NAMES,
    build_crewai_builtin_tool,
    collect_builtin_tool_names,
)


def test_collect_builtin_tool_names_from_member_tools():
    member = {
        "tools": [
            {"type": "crewai-builtin", "name": "SerperDevTool"},
            {"type": "mcp", "bridgeId": "b1"},
        ],
    }
    assert collect_builtin_tool_names(member) == ["SerperDevTool"]


def test_collect_builtin_tool_names_merges_crew_params():
    member = {"tools": []}
    crew_params = {"enableBuiltinTools": ["WebsiteSearchTool"]}
    assert collect_builtin_tool_names(member, crew_params) == ["WebsiteSearchTool"]


def test_build_crewai_builtin_tool_rejects_unknown():
    with pytest.raises(ValueError, match="E1041"):
        build_crewai_builtin_tool("EvilTool")


def test_builtin_tool_names_include_serper():
    assert "SerperDevTool" in BUILTIN_TOOL_NAMES
