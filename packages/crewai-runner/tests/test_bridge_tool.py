from unittest.mock import MagicMock, patch

from crewai_runner.tools.bridge_tool import BridgeTool, build_bridge_tools_for_member


def test_bridge_tool_posts_to_internal_route():
    mock_response = MagicMock()
    mock_response.json.return_value = {"result": "ok"}
    mock_response.raise_for_status = MagicMock()

    with patch("crewai_runner.tools.bridge_tool.httpx.post", return_value=mock_response) as mock_post:
        tool = BridgeTool(
            name="my_tool",
            description="desc",
            bridge_id="bridge_a1_0",
            base_url="http://127.0.0.1:8787",
            token="tok",
            execution_id="ex-1",
        )
        result = tool._run(query="hello")

    mock_post.assert_called_once_with(
        "http://127.0.0.1:8787/internal/crew-tool/bridge_a1_0",
        json={"query": "hello"},
        headers={
            "Authorization": "Bearer tok",
            "X-Awf-Execution-Id": "ex-1",
        },
        timeout=120.0,
    )
    assert result == "ok"


def test_build_bridge_tools_for_member_skips_builtin():
    member = {
        "tools": [
            {"type": "crewai-builtin", "name": "search"},
            {
                "type": "http",
                "bridgeId": "bridge_a1_0",
                "method": "GET",
                "url": "https://example.com",
                "description": "Example HTTP tool",
            },
        ]
    }
    execution = {
        "executionId": "ex-1",
        "toolBridgeBaseUrl": "http://127.0.0.1:8787",
        "toolBridgeTokens": {"bridge_a1_0": "token-a1"},
    }

    tools = build_bridge_tools_for_member(member, execution)

    assert len(tools) == 1
    assert tools[0].bridge_id == "bridge_a1_0"
    assert tools[0].token == "token-a1"
