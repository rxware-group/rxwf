"""P4-D3: execute AwfCrewFlowGraphIr subset via Crew kickoff."""

from __future__ import annotations

from crewai_runner.adapter.ir_to_crew import build_crew_from_ir
from crewai_runner.eval import build_crew_eval
from crewai_runner.router import resolve_router_next


def _node_map(flow: dict) -> dict[str, dict]:
    return {node["id"]: node for node in flow.get("nodes", [])}


def _outgoing(flow: dict, node_id: str) -> list[str]:
    return [edge["to"] for edge in flow.get("edges", []) if edge.get("from") == node_id]


def linearize_flow(flow: dict, input_task: str = "") -> list[dict]:
    """Walk flow from entry; router nodes evaluate branch conditions against input_task."""
    nodes = _node_map(flow)
    entry = flow.get("entryNodeId")
    if not entry or entry not in nodes:
        raise ValueError("E1047: flowGraph missing valid entryNodeId")

    path: list[dict] = []
    visited: set[str] = set()
    current = entry

    while current:
        if current in visited:
            raise ValueError("E1047: flowGraph contains a cycle")
        visited.add(current)

        node = nodes.get(current)
        if not node:
            raise ValueError(f"E1047: unknown flow node {current}")

        node_type = node.get("type")
        if node_type == "end":
            break
        if node_type == "task":
            path.append(node)

        if node_type == "router":
            router = node.get("router") or {}
            current = resolve_router_next(router, input_task)
            continue

        next_nodes = _outgoing(flow, current)
        if not next_nodes:
            break
        if len(next_nodes) > 1:
            raise ValueError("E1047: flowGraph branch requires router node in P4-D3 MVP")
        current = next_nodes[0]

    return path


def _member_by_node_id(ir: dict, member_node_id: str) -> dict | None:
    for member in ir.get("members", []):
        if member.get("nodeId") == member_node_id:
            return member
    return None


def run_flow_kickoff(ir: dict) -> dict:
    flow = ir.get("flowGraph")
    if not flow:
        raise ValueError("E1047: flowGraph required for flow mode kickoff")

    task_nodes = linearize_flow(flow, str(ir.get("inputTask", "")))
    crew = build_crew_from_ir(ir)
    result = crew.kickoff(inputs={"task": ir["inputTask"]})
    answer = str(result)

    crew_steps: list[dict] = []
    agent_steps: list[dict] = []
    for task_node in task_nodes:
        member_node_id = task_node.get("memberNodeId")
        member = _member_by_node_id(ir, str(member_node_id or ""))
        if not member:
            continue
        name = member.get("name") or member.get("role") or "Agent"
        crew_steps.append(
            {
                "nodeId": member.get("nodeId"),
                "role": member.get("role") or name,
                "name": name,
                "answer": answer,
                "flowNodeId": task_node.get("id"),
            }
        )
        agent_steps.append({"crewMember": name, "status": "success", "task": "flow task"})

    payload: dict = {
        "status": "success",
        "answer": answer,
        "crewSteps": crew_steps,
        "agentSteps": agent_steps,
        "flowMode": True,
    }

    crew_eval = build_crew_eval(ir, answer, crew_steps)
    if crew_eval:
        payload["crewEval"] = crew_eval

    return payload
