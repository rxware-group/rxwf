"""P4-D3: lightweight post-kickoff evaluation summary (MVP heuristic)."""

from __future__ import annotations


def build_crew_eval(ir: dict, answer: str, crew_steps: list[dict]) -> dict | None:
    if not ir.get("crewParams", {}).get("enableEval"):
        return None

    member_count = max(1, len(ir.get("members", [])))
    executed = len(crew_steps)
    coverage = min(1.0, executed / member_count)
    completeness = min(1.0, len(answer.strip()) / 80) if answer.strip() else 0.0
    overall = round((coverage * 0.4 + completeness * 0.6) * 100) / 100

    return {
        "overallScore": overall,
        "criteria": [
            {
                "name": "coverage",
                "score": round(coverage * 100) / 100,
                "notes": f"{executed}/{member_count} flow tasks",
            },
            {
                "name": "completeness",
                "score": round(completeness * 100) / 100,
                "notes": f"{len(answer.strip())} chars in answer",
            },
        ],
    }
