import pytest

from crewai_runner.router import match_flow_condition, resolve_router_next


def test_match_contains():
    assert match_flow_condition("contains:urgent", "This is URGENT work")
    assert not match_flow_condition("contains:missing", "hello")


def test_match_equals():
    assert match_flow_condition("equals:done", "done")
    assert match_flow_condition("equals:done", "done ")
    assert not match_flow_condition("equals:done", "not-done")


def test_match_json_field():
    assert match_flow_condition('json.mode:review', '{"mode":"review","topic":"x"}')
    assert not match_flow_condition('json.mode:write', '{"mode":"review"}')


def test_resolve_router_next_first_match():
    router = {
        "defaultNext": "flow_task_default",
        "branches": [
            {"label": "a", "condition": "contains:alpha", "next": "flow_task_a"},
            {"label": "b", "condition": "contains:beta", "next": "flow_task_b"},
        ],
    }
    assert resolve_router_next(router, "go beta") == "flow_task_b"


def test_resolve_router_next_falls_back_to_default():
    router = {
        "defaultNext": "flow_task_default",
        "branches": [{"label": "a", "condition": "contains:nope", "next": "flow_task_a"}],
    }
    assert resolve_router_next(router, "hello") == "flow_task_default"
