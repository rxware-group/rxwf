"""Map AWF knowledge chunks to CrewAI knowledge sources."""

from __future__ import annotations


def _format_chunks_backstory(chunks: list[dict]) -> str:
    if not chunks:
        return ""
    lines = []
    for index, chunk in enumerate(chunks, start=1):
        text = str(chunk.get("text") or "").strip()
        if not text:
            continue
        name = chunk.get("documentName") or "document"
        score = chunk.get("score")
        score_suffix = f", score={score:.3f}" if isinstance(score, (int, float)) else ""
        lines.append(f"[{index}] ({name}{score_suffix})\n{text}")
    if not lines:
        return ""
    return "Knowledge context:\n\n" + "\n\n".join(lines)


def build_knowledge_sources(chunks: list[dict]) -> list:
    texts = [str(c.get("text") or "").strip() for c in chunks if str(c.get("text") or "").strip()]
    if not texts:
        return []

    try:
        from crewai.knowledge.source.string_knowledge_source import StringKnowledgeSource
    except ImportError:
        return []

    combined = "\n\n".join(texts)
    return [StringKnowledgeSource(content=combined)]


def resolve_member_knowledge(member: dict, crew_params: dict) -> tuple[list, str]:
    """
    Returns (knowledge_sources, backstory_suffix).
    inject mode: node-runner already wrote backstory; Sidecar adds nothing.
    native mode: attach CrewAI sources, or fallback suffix when API unavailable.
    """
    mode = crew_params.get("crewaiKnowledgeMode", "inject")
    if mode != "native":
        return [], ""

    knowledge = member.get("knowledge") or {}
    chunks = knowledge.get("chunks") or []
    if not chunks:
        return [], ""

    sources = build_knowledge_sources(chunks)
    if sources:
        return sources, ""

    return [], _format_chunks_backstory(chunks)
