import { describe, expect, it } from 'vitest';
import { resolveOllamaModelField } from './resolve-ollama-model-field.js';
import type { ParamField } from './node-param-schemas.js';

const modelField: ParamField = { key: 'model', label: 'Model', type: 'text' };

describe('resolveOllamaModelField', () => {
  it('uses node baseUrl for llm node with live fetch on focus', () => {
    const ctx = resolveOllamaModelField(
      {
        id: 'n1',
        type: 'llm',
        name: 'Ollama',
        position: { x: 0, y: 0 },
        parameters: { baseUrl: 'http://192.168.1.5:11434' },
      },
      modelField,
    );
    expect(ctx).toEqual({
      baseUrl: 'http://192.168.1.5:11434',
      liveOnly: true,
      fetchOnFocus: true,
    });
  });

  it('defaults llm baseUrl when missing', () => {
    const ctx = resolveOllamaModelField(
      {
        id: 'n1',
        type: 'llm',
        name: 'Ollama',
        position: { x: 0, y: 0 },
        parameters: { provider: 'ollama' },
      },
      modelField,
    );
    expect(ctx?.baseUrl).toBe('http://127.0.0.1:11434');
  });

  it('uses direct config for llmStream when provider is ollama', () => {
    const ctx = resolveOllamaModelField(
      {
        id: 'n1',
        type: 'llmStream',
        name: 'LLM',
        position: { x: 0, y: 0 },
        parameters: {
          provider: 'ollama',
          baseUrl: 'http://10.0.0.2:11434',
        },
      },
      modelField,
    );
    expect(ctx).toEqual({
      baseUrl: 'http://10.0.0.2:11434',
      liveOnly: true,
      fetchOnFocus: true,
    });
  });

  it('defaults aiChatModel baseUrl when missing', () => {
    const ctx = resolveOllamaModelField(
      {
        id: 'n1',
        type: 'aiChatModel',
        name: 'Chat Model',
        position: { x: 0, y: 0 },
        parameters: { provider: 'ollama' },
      },
      modelField,
    );
    expect(ctx?.baseUrl).toBe('http://127.0.0.1:11434');
  });

  it('keeps settings fallback for ragAnswer', () => {
    const ctx = resolveOllamaModelField(
      {
        id: 'n1',
        type: 'ragAnswer',
        name: 'RAG',
        position: { x: 0, y: 0 },
        parameters: {},
      },
      modelField,
    );
    expect(ctx).toEqual({});
  });
});
