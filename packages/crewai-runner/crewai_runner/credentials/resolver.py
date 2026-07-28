from __future__ import annotations

import os

import httpx

CREDENTIAL_BRIDGE_PREFIX = "credential:"


def credential_bridge_id(credential_ref: str) -> str:
    return f"{CREDENTIAL_BRIDGE_PREFIX}{credential_ref}"


def _bridge_token(execution: dict, bridge_id: str) -> str:
    tokens = execution.get("toolBridgeTokens")
    if isinstance(tokens, dict) and bridge_id in tokens:
        return str(tokens[bridge_id])
    return str(execution.get("toolBridgeToken", ""))


def resolve_openai_api_key(execution: dict, credential_ref: str | None) -> str:
    env_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not credential_ref:
        return env_key

    base_url = str(execution.get("toolBridgeBaseUrl", "")).rstrip("/")
    execution_id = str(execution.get("executionId", ""))
    bridge_id = credential_bridge_id(credential_ref)
    token = _bridge_token(execution, bridge_id)

    if not base_url or not execution_id or not token:
        return env_key

    url = f"{base_url}/internal/crew-credential/{credential_ref}"
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Awf-Execution-Id": execution_id,
    }
    response = httpx.post(url, headers=headers, timeout=30.0)
    response.raise_for_status()
    payload = response.json()
    api_key = str(payload.get("apiKey") or "").strip()
    return api_key or env_key
