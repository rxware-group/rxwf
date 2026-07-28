import { describe, expect, it, vi } from 'vitest';
import { createMcpToolHandler } from './server.js';
import type { McpDeps } from './types.js';

function baseDeps(extra: Partial<McpDeps>): McpDeps {
  return {
    listWorkflows: vi.fn(async () => []),
    getWorkflow: vi.fn(async () => null),
    createWorkflow: vi.fn(async () => ({ id: 'w1' })),
    updateWorkflow: vi.fn(async () => undefined),
    validate: vi.fn(async () => ({ ok: true, errors: [] })),
    executeWorkflow: vi.fn(async () => ({ executionId: 'e1', status: 'success' })),
    getExecution: vi.fn(async () => null),
    listExecutions: vi.fn(async () => []),
    listRunners: vi.fn(async () => []),
    createRunnerRegistrationToken: vi.fn(async () => ({
      registrationToken: 'tok',
      expiresAt: new Date().toISOString(),
    })),
    ...extra,
  };
}

describe('chat bot MCP tools', () => {
  it('lists extra tools and dispatches chat_bot_run', async () => {
    const runChatBot = vi.fn(async (_args: Record<string, unknown>) =>
      JSON.stringify({ sessionId: 's1', answer: 'hello from bot' }),
    );
    const handler = createMcpToolHandler(
      baseDeps({
        listExtraTools: async () => [
          { name: 'chat_bot_run', description: 'Run any published bot by slug' },
        ],
        callExtraTool: async (name, args) => {
          if (name === 'chat_bot_run') {
            return runChatBot(args);
          }
          throw new Error('unknown');
        },
      }),
    );

    const tools = await handler.listTools();
    expect(tools.some((t) => t.name === 'chat_bot_run')).toBe(true);

    const result = await handler.callTool({
      name: 'chat_bot_run',
      arguments: { botSlug: 'support', message: 'hi' },
    });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0]!.text)).toMatchObject({
      answer: 'hello from bot',
    });
    expect(runChatBot).toHaveBeenCalledWith({ botSlug: 'support', message: 'hi' });
  });
});
