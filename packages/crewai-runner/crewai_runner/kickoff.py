from crewai_runner.adapter.ir_to_crew import build_crew_from_ir
from crewai_runner.eval import build_crew_eval
from crewai_runner.flow_runner import run_flow_kickoff


def _build_crew_steps(ir: dict, answer: str) -> list[dict]:
    steps: list[dict] = []
    for member in ir.get("members", []):
        name = member.get("name") or member.get("role") or "Agent"
        steps.append(
            {
                "nodeId": member.get("nodeId"),
                "role": member.get("role") or name,
                "name": name,
                "answer": answer,
            }
        )
    return steps


def run_kickoff(ir: dict) -> dict:
    if ir.get("irVersion") != 1:
        raise ValueError("E1044: unsupported IR version")

    if ir.get("crewParams", {}).get("crewaiProcess") == "consensual":
        raise ValueError("E1046: consensual process is not yet supported")

    if ir.get("crewParams", {}).get("crewaiFlowMode") == "flow" or ir.get("flowGraph"):
        return run_flow_kickoff(ir)

    crew = build_crew_from_ir(ir)
    result = crew.kickoff(inputs={"task": ir["inputTask"]})
    answer = str(result)
    crew_steps = _build_crew_steps(ir, answer)

    payload: dict = {
        "status": "success",
        "answer": answer,
        "crewSteps": crew_steps,
        "agentSteps": [],
    }

    crew_eval = build_crew_eval(ir, answer, crew_steps)
    if crew_eval:
        payload["crewEval"] = crew_eval

    return payload
