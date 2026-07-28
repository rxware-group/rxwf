from crewai_runner.adapter.knowledge_adapter import (
    _format_chunks_backstory,
    build_knowledge_sources,
    resolve_member_knowledge,
)


def test_format_chunks_backstory_includes_text_and_score():
    text = _format_chunks_backstory(
        [{"text": "AWF docs", "documentName": "guide.pdf", "score": 0.88}]
    )
    assert "AWF docs" in text
    assert "guide.pdf" in text
    assert "0.880" in text


def test_build_knowledge_sources_empty_without_text():
    assert build_knowledge_sources([{"text": "  "}, {}]) == []


def test_resolve_member_knowledge_inject_mode_ignores_chunks():
    member = {"knowledge": {"chunks": [{"text": "x"}]}}
    sources, suffix = resolve_member_knowledge(member, {"crewaiKnowledgeMode": "inject"})
    assert sources == []
    assert suffix == ""


def test_resolve_member_knowledge_native_fallback_when_import_missing(monkeypatch):
    member = {"knowledge": {"chunks": [{"text": "fallback chunk", "documentName": "d"}]}}
    monkeypatch.setattr(
        "crewai_runner.adapter.knowledge_adapter.build_knowledge_sources",
        lambda _chunks: [],
    )
    sources, suffix = resolve_member_knowledge(member, {"crewaiKnowledgeMode": "native"})
    assert sources == []
    assert "fallback chunk" in suffix


def test_resolve_member_knowledge_native_returns_sources(monkeypatch):
    sentinel = object()
    member = {"knowledge": {"chunks": [{"text": "native chunk"}]}}
    monkeypatch.setattr(
        "crewai_runner.adapter.knowledge_adapter.build_knowledge_sources",
        lambda _chunks: [sentinel],
    )
    sources, suffix = resolve_member_knowledge(member, {"crewaiKnowledgeMode": "native"})
    assert sources == [sentinel]
    assert suffix == ""
