import re

import httpx
from crewai.tools import BaseTool


def _sanitize_tool_name(name: str, fallback: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_]", "_", name.strip()) or fallback
    return cleaned[:64]


def _bridge_token(execution: dict, bridge_id: str) -> str:
    tokens = execution.get("toolBridgeTokens")
    if isinstance(tokens, dict) and bridge_id in tokens:
        return str(tokens[bridge_id])
    return str(execution.get("toolBridgeToken", ""))


def _tool_name(tool: dict) -> str:
    tool_type = tool.get("type")
    if tool_type == "mcp":
        return _sanitize_tool_name(str(tool.get("toolName") or ""), str(tool.get("bridgeId", "mcp_tool")))
    if tool_type == "http":
        return _sanitize_tool_name(str(tool.get("description") or tool.get("url") or ""), "http_tool")
    if tool_type == "workflow":
        return _sanitize_tool_name(str(tool.get("description") or ""), "workflow_tool")
    return _sanitize_tool_name(str(tool.get("bridgeId", "")), "bridge_tool")


class BridgeTool(BaseTool):
    name: str
    description: str
    bridge_id: str
    base_url: str
    token: str
    execution_id: str

    def _run(self, **kwargs: object) -> str:
        url = f"{self.base_url.rstrip('/')}/internal/crew-tool/{self.bridge_id}"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "X-Awf-Execution-Id": self.execution_id,
        }
        response = httpx.post(url, json=kwargs, headers=headers, timeout=120.0)
        response.raise_for_status()
        payload = response.json()
        result = payload.get("result", "")
        if isinstance(result, str):
            return result
        return str(result)


def build_bridge_tools_for_member(member: dict, execution: dict) -> list[BridgeTool]:
    base_url = str(execution.get("toolBridgeBaseUrl", "")).rstrip("/")
    execution_id = str(execution.get("executionId", ""))
    tools: list[BridgeTool] = []

    for tool in member.get("tools") or []:
        tool_type = tool.get("type")
        if tool_type not in ("mcp", "http", "workflow"):
            continue

        bridge_id = str(tool.get("bridgeId", ""))
        if not bridge_id or not base_url or not execution_id:
            continue

        description = str(tool.get("description") or bridge_id)
        tools.append(
            BridgeTool(
                name=_tool_name(tool),
                description=description,
                bridge_id=bridge_id,
                base_url=base_url,
                token=_bridge_token(execution, bridge_id),
                execution_id=execution_id,
            )
        )

    return tools
