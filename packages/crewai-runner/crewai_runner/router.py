"""Evaluate AwfCrewFlowGraphIr router branch conditions."""

from __future__ import annotations

import json
import re


def _parse_input_json(input_task: str) -> dict | None:
    text = input_task.strip()
    if not text.startswith("{"):
        return None
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        return None


def match_flow_condition(condition: str, input_task: str) -> bool:
    raw = (condition or "").strip()
    if not raw or raw.lower() == "default":
        return False

    if raw.lower().startswith("contains:"):
        needle = raw.split(":", 1)[1]
        return needle.lower() in input_task.lower()

    if raw.lower().startswith("equals:"):
        expected = raw.split(":", 1)[1].strip()
        return input_task.strip() == expected

    if raw.lower().startswith("regex:"):
        pattern = raw.split(":", 1)[1]
        return re.search(pattern, input_task, re.IGNORECASE) is not None

    if raw.lower().startswith("json."):
        payload = _parse_input_json(input_task)
        if not payload:
            return False
        path_and_value = raw[5:]
        if ":" not in path_and_value:
            return False
        field, expected = path_and_value.split(":", 1)
        actual = payload.get(field.strip())
        return str(actual) == expected.strip()

    return False


def resolve_router_next(router: dict, input_task: str) -> str:
    for branch in router.get("branches") or []:
        condition = str(branch.get("condition") or "").strip()
        if condition and match_flow_condition(condition, input_task):
            nxt = branch.get("next")
            if nxt:
                return str(nxt)

    default_next = router.get("defaultNext")
    if not default_next:
        raise ValueError("E1047: flow router missing defaultNext")
    return str(default_next)
