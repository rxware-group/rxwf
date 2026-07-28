import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { registerPlusExecutors } from './register-plus.js';
import { createMcpClientExecutor } from './mcp-client.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const mcpClientAuditRowPath = join(repoRoot, 'docs/test/node-audit-rows/mcpClient.md');

describe('mcpClient registry', () => {
  it('throws E2003 when mcpClient executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('mcpClient', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered via registerPlusExecutors', () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('mcpClient')).toBe(true);
  });

  it('is registered and executable when createMcpClientExecutor is wired', async () => {
    const callMcpTool = vi.fn(async () => ({ entries: ['a.txt'] }));
    const registry = createExecutorRegistry();
    registry.register(
      createMcpClientExecutor({
        callMcpTool,
      }),
    );

    const result = await registry.execute('mcpClient', {
      config: {
        serverId: 'srv-1',
        tools: ['list_directory'],
        args: { path: '.' },
      },
      inputItems: [{ json: {} }],
      nodeId: 'n1',
      executionId: 'e1',
      workflowId: 'w1',
      parentExecutionId: 'e1',
    });

    expect(result.status).toBe('success');
    expect(callMcpTool).toHaveBeenCalledWith({
      serverId: 'srv-1',
      toolName: 'list_directory',
      args: { path: '.' },
    });
    expect(result.outputItems?.[0]?.[0]?.json.result).toEqual({ entries: ['a.txt'] });
  });
});

describe('mcpClient M-3 audit row', () => {
  it('documents panel, validation, executor, and error_codes with ok status', () => {
    expect(existsSync(mcpClientAuditRowPath)).toBe(true);
    const content = readFileSync(mcpClientAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-mcpClient');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | ok |');
    expect(content).toContain('E2E-N-mcpClient');
  });
});

describe('createMcpClientExecutor', () => {
  it('calls each selected tool via callMcpTool', async () => {
    const callMcpTool = vi.fn(async ({ toolName }: { toolName: string }) => ({
      tool: toolName,
    }));
    const executor = createMcpClientExecutor({ callMcpTool });

    const result = await executor.execute({
      config: {
        serverId: 'srv-1',
        tools: ['list_directory', 'read_file'],
      },
      inputItems: [{ json: {} }],
      nodeId: 'n1',
      executionId: 'e1',
      workflowId: 'w1',
      parentExecutionId: 'e1',
    });

    expect(result.status).toBe('success');
    expect(callMcpTool).toHaveBeenCalledTimes(2);
    expect(result.outputItems?.[0]?.[0]?.json.tools).toHaveLength(2);
    expect(result.outputItems?.[0]?.[0]?.json.tool).toBe('list_directory');
  });

  it('accepts legacy single tool parameter', async () => {
    const callMcpTool = vi.fn(async () => ({ ok: true }));
    const executor = createMcpClientExecutor({ callMcpTool });

    await executor.execute({
      config: { serverId: 'srv-1', tool: 'ping' },
      inputItems: [{ json: {} }],
      nodeId: 'n1',
      executionId: 'e1',
      workflowId: 'w1',
      parentExecutionId: 'e1',
    });

    expect(callMcpTool).toHaveBeenCalledWith({
      serverId: 'srv-1',
      toolName: 'ping',
      args: undefined,
    });
  });

  it('fails with E3012 when MCP tool runtime is not configured', async () => {
    const executor = createMcpClientExecutor({});

    const result = await executor.execute({
      config: { serverId: 'srv-1', tools: ['list_directory'] },
      inputItems: [{ json: {} }],
      nodeId: 'n1',
      executionId: 'e1',
      workflowId: 'w1',
      parentExecutionId: 'e1',
    });

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toMatch(/E3012|MCP tool runtime not configured/i);
  });

  it('fails when serverId is missing', async () => {
    const callMcpTool = vi.fn(async () => ({}));
    const executor = createMcpClientExecutor({ callMcpTool });

    const result = await executor.execute({
      config: { tools: ['list_directory'] },
      inputItems: [{ json: {} }],
      nodeId: 'n1',
      executionId: 'e1',
      workflowId: 'w1',
      parentExecutionId: 'e1',
    });

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toMatch(/E1004|serverId/i);
    expect(callMcpTool).not.toHaveBeenCalled();
  });

  it('fails when no tools are selected', async () => {
    const callMcpTool = vi.fn(async () => ({}));
    const executor = createMcpClientExecutor({ callMcpTool });

    const result = await executor.execute({
      config: { serverId: 'srv-1', tools: [] },
      inputItems: [{ json: {} }],
      nodeId: 'n1',
      executionId: 'e1',
      workflowId: 'w1',
      parentExecutionId: 'e1',
    });

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toMatch(/E1004|tool/i);
    expect(callMcpTool).not.toHaveBeenCalled();
  });

  it('surfaces callMcpTool errors as failed status', async () => {
    const callMcpTool = vi.fn(async () => {
      const { AwfError } = await import('@rxwf/shared');
      throw new AwfError('E1001', 'MCP server not found: missing');
    });
    const executor = createMcpClientExecutor({ callMcpTool });

    const result = await executor.execute({
      config: { serverId: 'missing', tools: ['list_directory'] },
      inputItems: [{ json: {} }],
      nodeId: 'n1',
      executionId: 'e1',
      workflowId: 'w1',
      parentExecutionId: 'e1',
    });

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toMatch(/E1001|MCP server not found/i);
  });
});
