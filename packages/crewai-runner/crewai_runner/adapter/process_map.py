from crewai import Process


def awf_process_to_crewai(ir: dict) -> Process:
    proc = ir.get("crewParams", {}).get("crewaiProcess") or ir.get("process")
    if proc == "consensual":
        raise ValueError("E1046: consensual process is not yet supported")
    if proc in ("hierarchical", "supervisor"):
        return Process.hierarchical
    return Process.sequential
