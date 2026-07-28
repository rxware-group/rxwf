import { AwfError } from '@rxwf/shared';
import { createMcpClientPool } from '@rxwf/mcp-client-pool';
import type { PlusExecutorDeps } from '@rxwf/node-runner';
import { buildLaunchFromServer } from './launch.js';
import type { McpServerStore } from './store.js';

export function createCallMcpTool(deps: {
  store: McpServerStore;
  pool: ReturnType<typeof createMcpClientPool>;
}): NonNullable<PlusExecutorDeps['callMcpTool']> {
  return async ({ serverId, toolName, args }) => {
    const server = await deps.store.get(serverId);
    if (!server) {
      throw new AwfError('E1001', `MCP server not found: ${serverId}`);
    }
    const launch = buildLaunchFromServer(server);
    if (!launch) {
      throw new AwfError('E1004', 'Invalid MCP server config');
    }
    const client = await deps.pool.acquire(serverId, launch);
    try {
      return await client.callTool(toolName, args);
    } finally {
      deps.pool.release(serverId);
    }
  };
}
