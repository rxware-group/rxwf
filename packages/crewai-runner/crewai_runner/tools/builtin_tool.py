"""CrewAI built-in tool registry (whitelist names from IR crewParams / member.tools)."""

from __future__ import annotations

BUILTIN_TOOL_NAMES = frozenset(
    {
        "SerperDevTool",
        "WebsiteSearchTool",
        "ScrapeWebsiteTool",
        "FileReadTool",
        "DirectoryReadTool",
    }
)


def build_crewai_builtin_tool(name: str):
    if name not in BUILTIN_TOOL_NAMES:
        raise ValueError(f"E1041: CrewAI builtin tool not allowed: {name}")

    if name == "SerperDevTool":
        from crewai_tools import SerperDevTool

        return SerperDevTool()
    if name == "WebsiteSearchTool":
        from crewai_tools import WebsiteSearchTool

        return WebsiteSearchTool()
    if name == "ScrapeWebsiteTool":
        from crewai_tools import ScrapeWebsiteTool

        return ScrapeWebsiteTool()
    if name == "FileReadTool":
        from crewai_tools import FileReadTool

        return FileReadTool()
    if name == "DirectoryReadTool":
        from crewai_tools import DirectoryReadTool

        return DirectoryReadTool()

    raise ValueError(f"E1041: CrewAI builtin tool not allowed: {name}")


def collect_builtin_tool_names(member: dict, crew_params: dict | None = None) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()

    for tool in member.get("tools") or []:
        if tool.get("type") != "crewai-builtin":
            continue
        tool_name = str(tool.get("name", "")).strip()
        if tool_name and tool_name not in seen:
            seen.add(tool_name)
            names.append(tool_name)

    params = crew_params or {}
    for tool_name in params.get("enableBuiltinTools") or []:
        name = str(tool_name).strip()
        if name and name not in seen:
            seen.add(name)
            names.append(name)

    return names


def build_builtin_tools_for_member(member: dict, crew_params: dict | None = None) -> list:
    tools = []
    for name in collect_builtin_tool_names(member, crew_params):
        tools.append(build_crewai_builtin_tool(name))
    return tools
