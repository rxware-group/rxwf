from crewai import Agent, Crew, LLM, Process, Task

from crewai_runner.adapter.knowledge_adapter import resolve_member_knowledge
from crewai_runner.adapter.process_map import awf_process_to_crewai
from crewai_runner.credentials.resolver import resolve_openai_api_key
from crewai_runner.tools.bridge_tool import build_bridge_tools_for_member
from crewai_runner.tools.builtin_tool import build_builtin_tools_for_member

DEFAULT_OLLAMA_BASE_URL = "http://host.docker.internal:11434"


def member_llm(member: dict, execution: dict | None = None) -> LLM:
    model_cfg = member["model"]
    provider = model_cfg.get("provider", "ollama")
    execution = execution or {}

    if provider == "ollama":
        base_url = model_cfg.get("baseUrl") or DEFAULT_OLLAMA_BASE_URL
        return LLM(model=f"ollama/{model_cfg['model']}", base_url=base_url)

    if provider == "openai-compatible":
        api_key = resolve_openai_api_key(execution, model_cfg.get("credentialRef"))
        if not api_key:
            raise ValueError(
                "E1045: openai-compatible requires credentialRef or OPENAI_API_KEY"
            )
        llm_kwargs: dict = {
            "model": f"openai/{model_cfg['model']}",
            "api_key": api_key,
        }
        base_url = model_cfg.get("baseUrl")
        if base_url:
            llm_kwargs["base_url"] = str(base_url)
        return LLM(**llm_kwargs)

    raise ValueError(f"unsupported provider {provider}")

def _memory_backstory(member: dict) -> str:
    backstory = str(member.get("backstory") or "")
    memory = member.get("memory") or {}
    history = memory.get("history") or []
    if not history:
        return backstory
    lines = [f"{item.get('role', 'user')}: {item.get('content', '')}" for item in history]
    prefix = "Prior conversation:\n" + "\n".join(lines)
    return f"{backstory}\n\n{prefix}".strip() if backstory else prefix


def _build_agent(member: dict, execution: dict, crew_params: dict) -> Agent:
    llm = member_llm(member, execution)
    tools = build_bridge_tools_for_member(member, execution)
    tools.extend(build_builtin_tools_for_member(member, crew_params))

    knowledge_sources, knowledge_backstory = resolve_member_knowledge(member, crew_params)
    backstory = _memory_backstory(member)
    if knowledge_backstory:
        backstory = f"{backstory}\n\n{knowledge_backstory}".strip() if backstory else knowledge_backstory

    agent_kwargs: dict = {
        "role": member.get("role") or member.get("name", "Agent"),
        "goal": member.get("goal") or "Complete assigned tasks",
        "backstory": backstory,
        "llm": llm,
        "tools": tools,
        "verbose": False,
    }
    if knowledge_sources:
        agent_kwargs["knowledge_sources"] = knowledge_sources

    return Agent(**agent_kwargs)


def _task_description(ir: dict, member: dict) -> str:
    member_task = member.get("task") or {}
    if member_task.get("description"):
        return str(member_task["description"])
    return str(ir.get("inputTask", ""))


def _build_task(ir: dict, member: dict, agent: Agent) -> Task:
    task_kwargs: dict = {
        "description": _task_description(ir, member),
        "agent": agent,
    }
    member_task = member.get("task") or {}
    if member_task.get("expectedOutput"):
        task_kwargs["expected_output"] = str(member_task["expectedOutput"])
    if member_task.get("asyncExecution") is not None:
        task_kwargs["async_execution"] = bool(member_task["asyncExecution"])
    return Task(**task_kwargs)


def build_crew_from_ir(ir: dict) -> Crew:
    process = awf_process_to_crewai(ir)
    awf_process = ir.get("process")
    execution = ir.get("execution") or {}
    crew_params = ir.get("crewParams") or {}
    agents: list[Agent] = []
    tasks: list[Task] = []

    for member in ir.get("members", []):
        agent = _build_agent(member, execution, crew_params)
        agents.append(agent)
        tasks.append(_build_task(ir, member, agent))

    crew_kwargs: dict = {
        "agents": agents,
        "tasks": tasks,
        "process": process,
        "verbose": False,
    }

    if process == Process.hierarchical:
        manager = ir.get("manager")
        if manager:
            if awf_process == "supervisor":
                crew_kwargs["manager_agent"] = _build_agent(manager, execution, crew_params)
            else:
                crew_kwargs["manager_llm"] = member_llm(manager, execution)
    return Crew(**crew_kwargs)
