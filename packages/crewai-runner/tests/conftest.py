import sys
from types import ModuleType
from unittest.mock import MagicMock, patch

import pytest


def _ensure_crewai_mock() -> None:
    if "crewai" in sys.modules:
        return

    crewai = ModuleType("crewai")
    crewai.__version__ = "0.86.0-mock"

    class Process:
        sequential = "sequential"
        hierarchical = "hierarchical"

    crewai.Process = Process
    crewai.Agent = MagicMock(name="Agent")
    crewai.Task = MagicMock(name="Task")
    crewai.Crew = MagicMock(name="Crew")
    crewai.LLM = MagicMock(name="LLM")

    tools_mod = ModuleType("crewai.tools")

    class BaseTool:
        name: str = ""
        description: str = ""

        def __init__(self, **kwargs: object) -> None:
            for key, value in kwargs.items():
                setattr(self, key, value)

        def _run(self, **kwargs: object) -> str:
            raise NotImplementedError

    tools_mod.BaseTool = BaseTool
    sys.modules["crewai.tools"] = tools_mod
    crewai.tools = tools_mod

    sys.modules["crewai"] = crewai


_ensure_crewai_mock()


@pytest.fixture(autouse=True)
def _mock_builtin_tools():
    with patch(
        "crewai_runner.adapter.ir_to_crew.build_builtin_tools_for_member",
        return_value=[],
    ):
        yield
