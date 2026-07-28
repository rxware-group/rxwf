import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { AiRuntime } from '@rxwf/ai-runtime-stub';
import type { WorkflowDefinition } from '@rxwf/workflow';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { registerSkillExecutors } from './register-skill.js';

function mockAi(answer = 'skill done'): AiRuntime {
  return {
    async *chat() {
      yield answer;
    },
    async runAgent() {
      return { items: [{ json: { answer } }] };
    },
    async runGroupChat() {
      throw new Error('not used');
    },
  };
}

function withChatModel(definition: WorkflowDefinition, skillNodeId: string): WorkflowDefinition {
  return {
    ...definition,
    nodes: [
      ...definition.nodes,
      {
        id: 'model-1',
        type: 'aiChatModel',
        name: 'Chat Model',
        position: { x: 0, y: 80 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
    ],
    connections: [
      ...definition.connections,
      { from: 'model-1', to: skillNodeId, toInput: 'ai_languageModel' },
    ],
  };
}

function withToolSatellite(
  definition: WorkflowDefinition,
  hubNodeId: string,
  tool: WorkflowDefinition['nodes'][number],
): WorkflowDefinition {
  return {
    ...definition,
    nodes: [...definition.nodes, tool],
    connections: [
      ...definition.connections,
      { from: tool.id, to: hubNodeId, toInput: 'ai_tool' },
    ],
  };
}

describe('skillRun executor', () => {
  it('loads .rxwf/skills and returns answer', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rxwf-skill-run-'));
    const pkg = join(root, '.rxwf', 'skills', 'demo');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, 'SKILL.md'),
      '---\nname: demo\npermissions:\n  - filesystem:read\n---\n\nDo the task.\n',
    );

    const registry = createExecutorRegistry();
    registerSkillExecutors(registry, { ai: mockAi('ok-from-skill') });

    const definition = withChatModel(
      {
        schemaVersion: 1,
        name: 't',
        nodes: [
          {
            id: 'skill-1',
            type: 'skillRun',
            name: 'Skill',
            position: { x: 0, y: 0 },
            parameters: {
              skillSource: 'path',
              skillPath: 'demo',
              workspaceRoot: root,
              prompt: 'run skill',
            },
          },
        ],
        connections: [],
      },
      'skill-1',
    );

    const result = await registry.execute('skillRun', {
      config: definition.nodes[0]!.parameters,
      inputItems: [{ json: {} }],
      workflowDefinition: definition,
      nodeId: 'skill-1',
      executionId: 'ex-1',
      workflowId: 'wf-1',
    });

    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.[0]?.json.answer).toBe('ok-from-skill');
  });

  it('passes upstream JSON when prompt is empty', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rxwf-skill-run-'));
    const pkg = join(root, '.rxwf', 'skills', 'demo');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, 'SKILL.md'),
      '---\nname: demo\n---\n\nDo the task.\n',
    );

    const runAgent = vi.fn(async () => ({
      items: [{ json: { answer: 'ok' } }],
    }));
    const ai = { chat: async function* () {}, runAgent } as unknown as AiRuntime;

    const registry = createExecutorRegistry();
    registerSkillExecutors(registry, { ai });

    const definition = withChatModel(
      {
        schemaVersion: 1,
        name: 't',
        nodes: [
          {
            id: 'skill-1',
            type: 'skillRun',
            name: 'Skill',
            position: { x: 0, y: 0 },
            parameters: {
              skillSource: 'path',
              skillPath: 'demo',
              workspaceRoot: root,
            },
          },
        ],
        connections: [],
      },
      'skill-1',
    );

    await registry.execute('skillRun', {
      config: definition.nodes[0]!.parameters,
      inputItems: [{ json: { q: 'hello' } }],
      workflowDefinition: definition,
      nodeId: 'skill-1',
    });

    expect(runAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: JSON.stringify({ q: 'hello' }),
        timeoutMs: 120_000,
        maxIterations: 10,
      }),
      expect.any(Object),
    );
  });

  it('rejects .cursor/skills via loader', async () => {
    const registry = createExecutorRegistry();
    registerSkillExecutors(registry, { ai: mockAi() });

    const definition = withChatModel(
      {
        schemaVersion: 1,
        name: 't',
        nodes: [
          {
            id: 'skill-1',
            type: 'skillRun',
            name: 'Skill',
            position: { x: 0, y: 0 },
            parameters: {
              skillSource: 'path',
              skillPath: '.cursor/skills/foo',
            },
          },
        ],
        connections: [],
      },
      'skill-1',
    );

    await expect(
      registry.execute('skillRun', {
        config: definition.nodes[0]!.parameters,
        inputItems: [{ json: {} }],
        workflowDefinition: definition,
        nodeId: 'skill-1',
      }),
    ).rejects.toMatchObject({ code: 'E1066' });
  });

  it('throws E1043 without aiChatModel satellite', async () => {
    const registry = createExecutorRegistry();
    registerSkillExecutors(registry, { ai: mockAi() });

    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 't',
      nodes: [
        {
          id: 'skill-1',
          type: 'skillRun',
          name: 'Skill',
          position: { x: 0, y: 0 },
          parameters: {
            skillSource: 'path',
            skillPath: '.rxwf/skills/demo',
            workspaceRoot: '/tmp',
          },
        },
      ],
      connections: [],
    };

    await expect(
      registry.execute('skillRun', {
        config: definition.nodes[0]!.parameters,
        inputItems: [{ json: {} }],
        workflowDefinition: definition,
        nodeId: 'skill-1',
      }),
    ).rejects.toMatchObject({ code: 'E1043' });
  });

  it('loads skill from registry via loadSkillFromRegistry', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rxwf-skill-run-'));
    const registry = createExecutorRegistry();
    const skillMd =
      '---\nname: reg-demo\npermissions:\n  - filesystem:read\n---\n\nRegistry skill.\n';
    registerSkillExecutors(registry, {
      ai: mockAi('from-registry'),
      loadSkillFromRegistry: vi.fn(async () => ({
        skillRelPath: 'reg-demo',
        skillMd,
      })),
      getRxwfWorkspaceRoot: vi.fn(async () => root),
    });

    const definition = withChatModel(
      {
        schemaVersion: 1,
        name: 't',
        nodes: [
          {
            id: 'skill-1',
            type: 'skillRun',
            name: 'Skill',
            position: { x: 0, y: 0 },
            parameters: {
              skillSource: 'registry',
              skillId: 'skill-uuid-1',
            },
          },
        ],
        connections: [],
      },
      'skill-1',
    );

    const result = await registry.execute('skillRun', {
      config: definition.nodes[0]!.parameters,
      inputItems: [{ json: {} }],
      workflowDefinition: definition,
      nodeId: 'skill-1',
    });

    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.[0]?.json.answer).toBe('from-registry');
  });

  it('invokes write satellite tool end-to-end and writes file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rxwf-skill-run-write-'));
    try {
      const pkg = join(root, '.rxwf', 'skills', 'demo');
      mkdirSync(pkg, { recursive: true });
      writeFileSync(
        join(pkg, 'SKILL.md'),
        '---\nname: demo\npermissions:\n  - filesystem:read\n---\n\nWrite output.\n',
      );

      const target = join(root, 'out.txt');
      const runAgent = vi.fn(async (opts: {
        tools: Array<{ name: string }>;
        invokeTool: (
          def: { name: string },
          args: Record<string, unknown>,
        ) => Promise<unknown>;
      }) => {
        const writeDef = opts.tools.find((t) => t.name === 'write_file');
        expect(writeDef).toBeDefined();
        await opts.invokeTool(writeDef!, { path: target, content: 'written-by-skill' });
        return { items: [{ json: { answer: 'ok' } }] };
      });
      const ai = { chat: async function* () {}, runAgent } as unknown as AiRuntime;

      const registry = createExecutorRegistry();
      registerSkillExecutors(registry, { ai });

      let definition = withChatModel(
        {
          schemaVersion: 1,
          name: 't',
          nodes: [
            {
              id: 'skill-1',
              type: 'skillRun',
              name: 'Skill',
              position: { x: 0, y: 0 },
              parameters: {
                skillSource: 'path',
                skillPath: 'demo',
                workspaceRoot: root,
                prompt: 'write file',
              },
            },
          ],
          connections: [],
        },
        'skill-1',
      );
      definition = withToolSatellite(definition, 'skill-1', {
        id: 'write-1',
        type: 'toolWrite',
        name: 'write_file',
        position: { x: 0, y: 120 },
        parameters: {},
      });

      const result = await registry.execute('skillRun', {
        config: definition.nodes[0]!.parameters,
        inputItems: [{ json: {} }],
        workflowDefinition: definition,
        nodeId: 'skill-1',
        executionId: 'ex-write',
        workflowId: 'wf-write',
      });

      expect(result.status).toBe('success');
      expect(runAgent).toHaveBeenCalledOnce();
      await expect(readFile(target, 'utf8')).resolves.toBe('written-by-skill');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('invokes grep satellite tool end-to-end and returns matches', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rxwf-skill-run-grep-'));
    try {
      const pkg = join(root, '.rxwf', 'skills', 'demo');
      mkdirSync(pkg, { recursive: true });
      writeFileSync(
        join(pkg, 'SKILL.md'),
        '---\nname: demo\npermissions:\n  - filesystem:read\n---\n\nGrep files.\n',
      );
      writeFileSync(join(root, 'needle.txt'), 'find the needle here\n');

      const runAgent = vi.fn(async (opts: {
        tools: Array<{ name: string }>;
        invokeTool: (
          def: { name: string },
          args: Record<string, unknown>,
        ) => Promise<unknown>;
      }) => {
        const grepDef = opts.tools.find((t) => t.name === 'grep_tool');
        expect(grepDef).toBeDefined();
        const out = await opts.invokeTool(grepDef!, {
          pattern: 'needle',
          path: root,
        });
        const serialized = typeof out === 'string' ? out : JSON.stringify(out);
        expect(serialized).toContain('needle');
        return { items: [{ json: { answer: 'grep-ok' } }] };
      });
      const ai = { chat: async function* () {}, runAgent } as unknown as AiRuntime;

      const registry = createExecutorRegistry();
      registerSkillExecutors(registry, { ai });

      let definition = withChatModel(
        {
          schemaVersion: 1,
          name: 't',
          nodes: [
            {
              id: 'skill-1',
              type: 'skillRun',
              name: 'Skill',
              position: { x: 0, y: 0 },
              parameters: {
                skillSource: 'path',
                skillPath: 'demo',
                workspaceRoot: root,
              },
            },
          ],
          connections: [],
        },
        'skill-1',
      );
      definition = withToolSatellite(definition, 'skill-1', {
        id: 'grep-1',
        type: 'toolGrep',
        name: 'grep_tool',
        position: { x: 0, y: 120 },
        parameters: {},
      });

      const result = await registry.execute('skillRun', {
        config: definition.nodes[0]!.parameters,
        inputItems: [{ json: {} }],
        workflowDefinition: definition,
        nodeId: 'skill-1',
      });

      expect(result.status).toBe('success');
      expect(result.outputItems?.[0]?.[0]?.json.answer).toBe('grep-ok');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('invokes web_search satellite tool end-to-end with mock provider', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rxwf-skill-run-ws-'));
    try {
      const pkg = join(root, '.rxwf', 'skills', 'demo');
      mkdirSync(pkg, { recursive: true });
      writeFileSync(
        join(pkg, 'SKILL.md'),
        '---\nname: demo\npermissions:\n  - network\n---\n\nSearch web.\n',
      );

      const webSearch = {
        search: vi.fn(async () => ({
          summary: 'search summary',
          results: [{ title: 'Hit', url: 'https://example.com', snippet: 'snippet' }],
        })),
      };

      const runAgent = vi.fn(async (opts: {
        tools: Array<{ name: string }>;
        invokeTool: (
          def: { name: string },
          args: Record<string, unknown>,
        ) => Promise<unknown>;
      }) => {
        const wsDef = opts.tools.find((t) => t.name === 'web_search');
        expect(wsDef).toBeDefined();
        const out = await opts.invokeTool(wsDef!, { query: 'latest news' });
        expect(out).toBe('search summary');
        return { items: [{ json: { answer: 'ws-ok' } }] };
      });
      const ai = { chat: async function* () {}, runAgent } as unknown as AiRuntime;

      const registry = createExecutorRegistry();
      registerSkillExecutors(registry, { ai, webSearch });

      let definition = withChatModel(
        {
          schemaVersion: 1,
          name: 't',
          nodes: [
            {
              id: 'skill-1',
              type: 'skillRun',
              name: 'Skill',
              position: { x: 0, y: 0 },
              parameters: {
                skillSource: 'path',
                skillPath: 'demo',
                workspaceRoot: root,
              },
            },
          ],
          connections: [],
        },
        'skill-1',
      );
      definition = withToolSatellite(definition, 'skill-1', {
        id: 'ws-1',
        type: 'toolWebSearch',
        name: 'web_search',
        position: { x: 0, y: 120 },
        parameters: {},
      });

      const result = await registry.execute('skillRun', {
        config: definition.nodes[0]!.parameters,
        inputItems: [{ json: {} }],
        workflowDefinition: definition,
        nodeId: 'skill-1',
      });

      expect(result.status).toBe('success');
      expect(result.outputItems?.[0]?.[0]?.json.answer).toBe('ws-ok');
      expect(webSearch.search).toHaveBeenCalledOnce();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('processes each input item in a loop with templated prompt', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rxwf-skill-run-multi-'));
    const pkg = join(root, '.rxwf', 'skills', 'demo');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, 'SKILL.md'),
      '---\nname: demo\n---\n\nDo the task.\n',
    );

    const runAgent = vi.fn(async (opts: { userMessage: string }) => ({
      items: [{ json: { answer: `ans:${opts.userMessage}` } }],
    }));
    const ai = { chat: async function* () {}, runAgent } as unknown as AiRuntime;

    const registry = createExecutorRegistry();
    registerSkillExecutors(registry, { ai });

    const definition = withChatModel(
      {
        schemaVersion: 1,
        name: 't',
        nodes: [
          {
            id: 'skill-1',
            type: 'skillRun',
            name: 'Skill',
            position: { x: 0, y: 0 },
            parameters: {
              skillSource: 'path',
              skillPath: 'demo',
              workspaceRoot: root,
              prompt: '{{ $json.text }}',
            },
          },
        ],
        connections: [],
      },
      'skill-1',
    );

    const result = await registry.execute('skillRun', {
      config: definition.nodes[0]!.parameters,
      inputItems: [{ json: { text: 'first' } }, { json: { text: 'second' } }],
      workflowDefinition: definition,
      nodeId: 'skill-1',
    });

    expect(runAgent).toHaveBeenCalledTimes(2);
    expect(runAgent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ userMessage: 'first' }),
      expect.any(Object),
    );
    expect(runAgent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ userMessage: 'second' }),
      expect.any(Object),
    );
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]).toHaveLength(2);
    expect(result.outputItems?.[0]?.[0]?.json.answer).toBe('ans:first');
    expect(result.outputItems?.[0]?.[1]?.json.answer).toBe('ans:second');
  });

  it('throws E1040 when registry source has no configured workspace', async () => {
    const registry = createExecutorRegistry();
    registerSkillExecutors(registry, {
      ai: mockAi(),
      loadSkillFromRegistry: vi.fn(async () => ({
        skillRelPath: 'reg-demo',
        skillMd: '---\nname: reg-demo\n---\n\nRegistry skill.\n',
      })),
      getRxwfWorkspaceRoot: vi.fn(async () => ''),
    });

    const definition = withChatModel(
      {
        schemaVersion: 1,
        name: 't',
        nodes: [
          {
            id: 'skill-1',
            type: 'skillRun',
            name: 'Skill',
            position: { x: 0, y: 0 },
            parameters: {
              skillSource: 'registry',
              skillId: 'skill-uuid-1',
            },
          },
        ],
        connections: [],
      },
      'skill-1',
    );

    await expect(
      registry.execute('skillRun', {
        config: definition.nodes[0]!.parameters,
        inputItems: [{ json: {} }],
        workflowDefinition: definition,
        nodeId: 'skill-1',
      }),
    ).rejects.toMatchObject({ code: 'E1040', message: 'RxWF workspace not configured' });
  });
});
