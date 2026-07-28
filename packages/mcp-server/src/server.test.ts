import { describe, it, expect, vi } from 'vitest';
import { createMcpToolHandler } from './server.js';
import type { McpDeps } from './types.js';

const manualDef = {
  schemaVersion: 1 as const,
  name: 'MCP',
  nodes: [
    {
      id: 't1',
      type: 'manualTrigger',
      name: 'T',
      position: { x: 0, y: 0 },
      parameters: {},
    },
  ],
  connections: [],
};

function createDeps(): McpDeps {
  const store = new Map<string, { id: string; definition: typeof manualDef; status: string }>();
  return {
    listWorkflows: vi.fn(async () =>
      [...store.values()].map((w) => ({
        id: w.id,
        name: w.definition.name,
        status: w.status,
        version: 1,
      })),
    ),
    getWorkflow: vi.fn(async (id) => store.get(id) ?? null),
    createWorkflow: vi.fn(async (name, definition) => {
      const id = crypto.randomUUID();
      store.set(id, { id, definition: { ...definition, name }, status: 'draft' });
      return { id };
    }),
    updateWorkflow: vi.fn(async (id, definition) => {
      const row = store.get(id);
      if (!row) throw new Error('missing');
      row.definition = definition;
    }),
    validate: vi.fn(async (definition: (typeof manualDef) & { connections: { from: string; to: string }[] }) => {
      const conns = definition.connections;
      const hasCycle =
        conns.length >= 2 &&
        conns.some((c: { from: string; to: string }) =>
          conns.some((x: { from: string; to: string }) => x.from === c.to && x.to === c.from),
        );
      return hasCycle
        ? { ok: false, errors: [{ code: 'E1003', message: 'cycle' }] }
        : { ok: true, errors: [] };
    }),
    executeWorkflow: vi.fn(async (id) => ({
      executionId: 'ex-1',
      status: 'success',
    })),
    getExecution: vi.fn(async () => ({
      id: 'ex-1',
      status: 'success',
      nodeRuns: [{ nodeId: 't1', status: 'success' }],
    })),
    listExecutions: vi.fn(async () => [{ id: 'ex-1', status: 'success' }]),
    listRunners: vi.fn(async () => [
      {
        id: 'agent-1',
        name: 'win-agent',
        kind: 'agent',
        platform: { os: 'windows', arch: 'x64' },
        status: 'online',
        labels: ['ci'],
        agentVersion: '1.0.0',
        lastHeartbeatAt: new Date().toISOString(),
      },
    ]),
    createRunnerRegistrationToken: vi.fn(async () => ({
      registrationToken: 'tok-abc',
      expiresAt: new Date().toISOString(),
    })),
  };
}

describe('MCP tools AC-13/14', () => {
  it('workflow_create + workflow_execute + execution_get', async () => {
    const deps = createDeps();
    const handler = createMcpToolHandler(deps);
    const created = await handler.callTool({
      name: 'workflow_create',
      arguments: { name: 'IDE', definition: manualDef },
    });
    expect(created.isError).toBeFalsy();
    const { id } = JSON.parse(created.content[0]!.text) as { id: string };
    const executed = await handler.callTool({
      name: 'workflow_execute',
      arguments: { workflowId: id },
    });
    expect(JSON.parse(executed.content[0]!.text)).toMatchObject({ status: 'success' });
    const got = await handler.callTool({
      name: 'execution_get',
      arguments: { executionId: 'ex-1' },
    });
    expect(JSON.parse(got.content[0]!.text).status).toBe('success');
  });

  it('workflow_validate rejects cycle (AC-14)', async () => {
    const deps = createDeps();
    const handler = createMcpToolHandler(deps);
    const result = await handler.callTool({
      name: 'workflow_validate',
      arguments: {
        definition: {
          ...manualDef,
          nodes: [
            ...manualDef.nodes,
            { id: 'b', type: 'set', name: 'b', position: { x: 1, y: 0 }, parameters: {} },
          ],
          connections: [
            { from: 't1', to: 'b' },
            { from: 'b', to: 't1' },
          ],
        },
      },
    });
    const body = JSON.parse(result.content[0]!.text) as { ok: boolean };
    expect(body.ok).toBe(false);
  });

  it('runner_list returns runners', async () => {
    const deps = createDeps();
    const handler = createMcpToolHandler(deps);
    const result = await handler.callTool({ name: 'runner_list', arguments: {} });
    const list = JSON.parse(result.content[0]!.text) as Array<{ id: string }>;
    expect(list[0]?.id).toBe('agent-1');
    expect(deps.listRunners).toHaveBeenCalled();
  });

  it('runner_create_registration_token returns token', async () => {
    const deps = createDeps();
    const handler = createMcpToolHandler(deps);
    const result = await handler.callTool({
      name: 'runner_create_registration_token',
      arguments: { expiresInHours: 12, labels: ['ci'] },
    });
    expect(JSON.parse(result.content[0]!.text)).toMatchObject({
      registrationToken: 'tok-abc',
    });
    expect(deps.createRunnerRegistrationToken).toHaveBeenCalledWith({
      expiresInHours: 12,
      labels: ['ci'],
    });
  });
});
