"""IR-to-CrewAI adapter."""

from crewai_runner.adapter.ir_to_crew import build_crew_from_ir
from crewai_runner.adapter.process_map import awf_process_to_crewai

__all__ = ["awf_process_to_crewai", "build_crew_from_ir"]
