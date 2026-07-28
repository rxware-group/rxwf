from unittest.mock import MagicMock, patch

import httpx
import pytest

from crewai_runner.credentials.resolver import (
    credential_bridge_id,
    resolve_openai_api_key,
)


def test_credential_bridge_id_prefix():
    assert credential_bridge_id("cred-1") == "credential:cred-1"


def test_resolve_openai_api_key_uses_env_without_ref(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "env-key")
    assert resolve_openai_api_key({}, None) == "env-key"


@patch("crewai_runner.credentials.resolver.httpx.post")
def test_resolve_openai_api_key_calls_credential_bridge(mock_post, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    mock_response = MagicMock()
    mock_response.json.return_value = {"apiKey": "bridge-key"}
    mock_post.return_value = mock_response

    execution = {
        "executionId": "ex-1",
        "toolBridgeBaseUrl": "http://127.0.0.1:8787",
        "toolBridgeTokens": {"credential:cred-1": "tok"},
    }
    key = resolve_openai_api_key(execution, "cred-1")

    assert key == "bridge-key"
    mock_post.assert_called_once()
    call_kwargs = mock_post.call_args.kwargs
    assert call_kwargs["headers"]["Authorization"] == "Bearer tok"
    assert call_kwargs["headers"]["X-Awf-Execution-Id"] == "ex-1"
    assert mock_post.call_args.args[0].endswith("/internal/crew-credential/cred-1")


@patch("crewai_runner.credentials.resolver.httpx.post")
def test_resolve_openai_api_key_falls_back_to_env_on_http_error(mock_post, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "env-fallback")
    mock_post.side_effect = httpx.HTTPError("boom")

    execution = {
        "executionId": "ex-1",
        "toolBridgeBaseUrl": "http://127.0.0.1:8787",
        "toolBridgeTokens": {"credential:cred-1": "tok"},
    }

    with pytest.raises(httpx.HTTPError):
        resolve_openai_api_key(execution, "cred-1")
