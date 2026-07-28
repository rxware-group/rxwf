"""Map CrewAI / Sidecar events to AWF agentSteps shape."""


def member_running_step(crew_member: str, task: str | None = None) -> dict:
    step: dict = {"crewMember": crew_member, "status": "running"}
    if task:
        step["task"] = task
    return step


def member_success_step(crew_member: str, output: str | None = None) -> dict:
    step: dict = {"crewMember": crew_member, "status": "success"}
    if output:
        step["message"] = output
    return step


def tool_step(tool: str, status: str, duration_ms: int | None = None) -> dict:
    step: dict = {"tool": tool, "status": status}
    if duration_ms is not None:
        step["durationMs"] = duration_ms
    return step
