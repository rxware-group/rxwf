import json
from collections.abc import AsyncIterator

from crewai_runner.events.to_agent_steps import member_running_step, member_success_step
from crewai_runner.kickoff import run_kickoff


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def stream_kickoff_events(ir: dict) -> AsyncIterator[str]:
    try:
        members = ir.get("members", [])
        for member in members:
            name = member.get("name") or member.get("role") or "Agent"
            task = (member.get("task") or {}).get("description")
            yield _sse("agent_step", member_running_step(name, task))

        result = run_kickoff(ir)

        for member in members:
            name = member.get("name") or member.get("role") or "Agent"
            yield _sse("agent_step", member_success_step(name))

        yield _sse(
            "done",
            {
                "answer": result.get("answer", ""),
                "crewSteps": result.get("crewSteps", []),
                "agentSteps": result.get("agentSteps", []),
                **({"crewEval": result["crewEval"]} if result.get("crewEval") else {}),
            },
        )
    except ValueError as exc:
        yield _sse("error", {"code": "E1042", "message": str(exc)})
    except Exception as exc:
        yield _sse("error", {"code": "E1042", "message": str(exc)})
