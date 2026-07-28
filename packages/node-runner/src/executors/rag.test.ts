import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { AwfError } from '@rxwf/shared';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { createRagExecutors } from './rag.js';
import { registerPlusExecutors } from './register-plus.js';
import type { PlusExecutorDeps } from './register-plus.js';
import type { AiRuntime } from '@rxwf/ai-runtime-stub';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const ragRetrieveAuditRowPath = join(repoRoot, 'docs/test/node-audit-rows/ragRetrieve.md');
const ragAnswerAuditRowPath = join(repoRoot, 'docs/test/node-audit-rows/ragAnswer.md');

function mockChunk() {
  return {
    id: 'c1',
    knowledgeBaseId: 'kb1',
    documentId: 'd1',
    documentName: 'doc.md',
    chunkIndex: 0,
    text: 'hello world',
    score: 0.9,
    metadata: {},
  };
}

function mockAi(overrides: Partial<AiRuntime> = {}): AiRuntime {
  return {
    async *chat() {},
    async runAgent() {
      return { items: [] };
    },
    async runGroupChat() {
      throw new Error('not used');
    },
    ...overrides,
  };
}

function mockRagAnswerDeps() {
  const queryMany = vi.fn(async () => [mockChunk()]);
  const chat = vi.fn(async function* () {
    yield 'rag-answer-ok';
  });
  const knowledge = { queryMany };
  const ai = mockAi({ chat, runAgent: vi.fn() });
  const resolveOllamaModelRef = vi.fn(async () => ({
    provider: 'ollama' as const,
    model: 'llama3',
  }));
  return {
    deps: { knowledge, ai, resolveOllamaModelRef } satisfies PlusExecutorDeps,
    queryMany,
    chat,
    resolveOllamaModelRef,
  };
}

function getRagRetrieveExecutor(deps: PlusExecutorDeps) {
  const executors = createRagExecutors(deps);
  const ex = executors.find((e) => e.type === 'ragRetrieve');
  if (!ex) throw new Error('ragRetrieve executor missing');
  return ex;
}

function getRagAnswerExecutor(deps: PlusExecutorDeps) {
  const executors = createRagExecutors(deps);
  const ex = executors.find((e) => e.type === 'ragAnswer');
  if (!ex) throw new Error('ragAnswer executor missing');
  return ex;
}

describe('ragRetrieve registry', () => {
  it('throws E2003 when ragRetrieve executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('ragRetrieve', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered via registerPlusExecutors', () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('ragRetrieve')).toBe(true);
  });
});

describe('ragRetrieve M-3 audit row', () => {
  it('documents panel, validation, executor, and error_codes with ok status', () => {
    expect(existsSync(ragRetrieveAuditRowPath)).toBe(true);
    const content = readFileSync(ragRetrieveAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-ragRetrieve');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | ok |');
    expect(content).toContain('E2E-N-ragRetrieve');
  });
});

describe('createRagExecutors ragRetrieve', () => {
  it('returns chunks as output items', async () => {
    const queryMany = vi.fn(async () => [mockChunk()]);
    const ex = getRagRetrieveExecutor({ knowledge: { queryMany } } as PlusExecutorDeps);
    const result = await ex.execute({
      nodeId: 'n1',
      config: { knowledgeBaseIds: ['kb1'], query: 'hi' },
      inputItems: [],
    });
    expect(result.status).toBe('success');
    expect(queryMany).toHaveBeenCalledWith(['kb1'], 'hi');
    const items = result.outputItems?.[0];
    expect(items?.[0]?.json.text).toBe('hello world');
    expect(items?.[0]?.json.score).toBe(0.9);
    expect(items?.[0]?.json.knowledgeBaseId).toBe('kb1');
  });

  it('resolves query from first input item when config query is empty', async () => {
    const queryMany = vi.fn(async () => [mockChunk()]);
    const ex = getRagRetrieveExecutor({ knowledge: { queryMany } } as PlusExecutorDeps);

    await ex.execute({
      nodeId: 'n1',
      config: { knowledgeBaseIds: ['kb1'] },
      inputItems: [{ json: { question: 'from-input' } }],
    });

    expect(queryMany).toHaveBeenCalledWith(['kb1'], 'from-input');
  });

  it('throws E1004 when knowledgeBaseIds is missing', async () => {
    const ex = getRagRetrieveExecutor({
      knowledge: { queryMany: vi.fn() },
    } as PlusExecutorDeps);

    await expect(
      ex.execute({
        nodeId: 'n1',
        config: { query: 'hi' },
        inputItems: [],
      }),
    ).rejects.toMatchObject({ code: 'E1004' });
  });

  it('throws E1004 when query is missing', async () => {
    const ex = getRagRetrieveExecutor({
      knowledge: { queryMany: vi.fn() },
    } as PlusExecutorDeps);

    await expect(
      ex.execute({
        nodeId: 'n1',
        config: { knowledgeBaseIds: ['kb1'] },
        inputItems: [],
      }),
    ).rejects.toMatchObject({ code: 'E1004' });
  });

  it('throws E3001 when knowledge runtime is not configured', async () => {
    const ex = getRagRetrieveExecutor({});

    await expect(
      ex.execute({
        nodeId: 'n1',
        config: { knowledgeBaseIds: ['kb1'], query: 'hi' },
        inputItems: [],
      }),
    ).rejects.toMatchObject({ code: 'E3001' });
  });

  it('propagates E3003 from queryMany', async () => {
    const queryMany = vi.fn(async () => {
      throw new AwfError('E3003', 'RAG miss');
    });
    const ex = getRagRetrieveExecutor({ knowledge: { queryMany } } as PlusExecutorDeps);

    await expect(
      ex.execute({
        nodeId: 'n1',
        config: { knowledgeBaseIds: ['kb1'], query: 'unknown' },
        inputItems: [],
      }),
    ).rejects.toMatchObject({ code: 'E3003' });
  });
});

describe('ragAnswer registry', () => {
  it('throws E2003 when ragAnswer executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('ragAnswer', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered via registerPlusExecutors', () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('ragAnswer')).toBe(true);
  });
});

describe('ragAnswer M-3 audit row', () => {
  it('documents panel, validation, executor, and error_codes with ok status', () => {
    expect(existsSync(ragAnswerAuditRowPath)).toBe(true);
    const content = readFileSync(ragAnswerAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-ragAnswer');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | ok |');
    expect(content).toContain('E2E-N-ragAnswer');
  });
});

describe('createRagExecutors ragAnswer', () => {
  it('uses platform RAG model when node model is empty and usePlatformRagModel is true', async () => {
    const { deps, queryMany, chat } = mockRagAnswerDeps();
    const resolvePlatformRagModelRef = vi.fn(async () => ({
      provider: 'ollama' as const,
      model: 'platform-rag',
    }));
    const ex = getRagAnswerExecutor({
      ...deps,
      resolvePlatformRagModelRef,
    });

    const result = await ex.execute({
      nodeId: 'n1',
      config: {
        knowledgeBaseIds: ['kb1'],
        query: 'What is hello?',
      },
      inputItems: [],
    });

    expect(result.status).toBe('success');
    expect(resolvePlatformRagModelRef).toHaveBeenCalled();
    expect(deps.resolveOllamaModelRef).not.toHaveBeenCalled();
    expect(queryMany).toHaveBeenCalled();
    expect(chat).toHaveBeenCalled();
  });

  it('returns answer and citations when retrieval succeeds', async () => {
    const { deps, queryMany, chat } = mockRagAnswerDeps();
    const ex = getRagAnswerExecutor(deps);

    const result = await ex.execute({
      nodeId: 'n1',
      config: {
        knowledgeBaseIds: ['kb1'],
        query: 'What is hello?',
        ragTemplate: 'support',
      },
      inputItems: [],
    });

    expect(result.status).toBe('success');
    expect(queryMany).toHaveBeenCalledWith(['kb1'], 'What is hello?');
    expect(chat).toHaveBeenCalled();
    const json = result.outputItems?.[0]?.[0]?.json;
    expect(json?.answer).toBe('rag-answer-ok');
    expect(json?.ragMiss).toBe(false);
    expect(Array.isArray(json?.citations)).toBe(true);
    expect(json?.citations).toHaveLength(1);
  });

  it('resolves query from first input item when config query is empty', async () => {
    const { deps, queryMany } = mockRagAnswerDeps();
    const ex = getRagAnswerExecutor(deps);

    await ex.execute({
      nodeId: 'n1',
      config: { knowledgeBaseIds: ['kb1'] },
      inputItems: [{ json: { question: 'from-input' } }],
    });

    expect(queryMany).toHaveBeenCalledWith(['kb1'], 'from-input');
  });

  it('throws E1004 when knowledgeBaseIds is missing', async () => {
    const { deps } = mockRagAnswerDeps();
    const ex = getRagAnswerExecutor(deps);

    await expect(
      ex.execute({
        nodeId: 'n1',
        config: { query: 'hi' },
        inputItems: [],
      }),
    ).rejects.toMatchObject({ code: 'E1004' });
  });

  it('throws E1004 when query is missing', async () => {
    const { deps } = mockRagAnswerDeps();
    const ex = getRagAnswerExecutor(deps);

    await expect(
      ex.execute({
        nodeId: 'n1',
        config: { knowledgeBaseIds: ['kb1'] },
        inputItems: [],
      }),
    ).rejects.toMatchObject({ code: 'E1004' });
  });

  it('throws E3001 when knowledge or AI runtime is not configured', async () => {
    const ex = getRagAnswerExecutor({});

    await expect(
      ex.execute({
        nodeId: 'n1',
        config: { knowledgeBaseIds: ['kb1'], query: 'hi' },
        inputItems: [],
      }),
    ).rejects.toMatchObject({ code: 'E3001' });
  });

  it('falls back to plain chat on E3003 when fallbackToChat is true', async () => {
    const queryMany = vi.fn(async () => {
      throw new AwfError('E3003', 'RAG miss');
    });
    const chat = vi.fn(async function* () {
      yield 'fallback-chat';
    });
    const ex = getRagAnswerExecutor({
      knowledge: { queryMany },
      ai: mockAi({ chat, runAgent: vi.fn() }),
    });

    const result = await ex.execute({
      nodeId: 'n1',
      config: {
        knowledgeBaseIds: ['kb1'],
        query: 'unknown topic',
        fallbackToChat: true,
      },
      inputItems: [],
    });

    expect(result.status).toBe('success');
    const json = result.outputItems?.[0]?.[0]?.json;
    expect(json?.answer).toBe('fallback-chat');
    expect(json?.ragMiss).toBe(true);
    expect(json?.citations).toEqual([]);
  });

  it('falls back to plain chat on E3003 when fallbackToChat is "true"', async () => {
    const queryMany = vi.fn(async () => {
      throw new AwfError('E3003', 'RAG miss');
    });
    const chat = vi.fn(async function* () {
      yield 'fallback-string';
    });
    const ex = getRagAnswerExecutor({
      knowledge: { queryMany },
      ai: mockAi({ chat, runAgent: vi.fn() }),
    });

    const result = await ex.execute({
      nodeId: 'n1',
      config: {
        knowledgeBaseIds: ['kb1'],
        query: 'unknown',
        fallbackToChat: 'true',
      },
      inputItems: [],
    });

    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.[0]?.json.answer).toBe('fallback-string');
  });

  it('rethrows E3003 when fallbackToChat is false', async () => {
    const queryMany = vi.fn(async () => {
      throw new AwfError('E3003', 'RAG miss');
    });
    const ex = getRagAnswerExecutor({
      knowledge: { queryMany },
      ai: mockAi({ chat: vi.fn(), runAgent: vi.fn() }),
    });

    await expect(
      ex.execute({
        nodeId: 'n1',
        config: {
          knowledgeBaseIds: ['kb1'],
          query: 'unknown',
          fallbackToChat: false,
        },
        inputItems: [],
      }),
    ).rejects.toMatchObject({ code: 'E3003' });
  });

  it('does not fallback on non-E3003 errors even when fallbackToChat is true', async () => {
    const queryMany = vi.fn(async () => {
      throw new AwfError('E3001', 'Knowledge unavailable');
    });
    const chat = vi.fn(async function* () {
      yield 'should-not-run';
    });
    const ex = getRagAnswerExecutor({
      knowledge: { queryMany },
      ai: mockAi({ chat, runAgent: vi.fn() }),
    });

    await expect(
      ex.execute({
        nodeId: 'n1',
        config: {
          knowledgeBaseIds: ['kb1'],
          query: 'hi',
          fallbackToChat: 'true',
        },
        inputItems: [],
      }),
    ).rejects.toMatchObject({ code: 'E3001' });
    expect(chat).not.toHaveBeenCalled();
  });
});
