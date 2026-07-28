import type { PlusExecutorDeps } from './register-plus.js';
import type { NodeExecutionContext, NodeExecutor, NodeRunResult } from '../types/node-executor.js';

export interface McpClientExecutorDeps {
  callMcpTool?: PlusExecutorDeps['callMcpTool'];
}

export function resolveMcpToolList(config: Record<string, unknown>): string[] {
  if (Array.isArray(config.tools)) {
    return (config.tools as unknown[]).filter(
      (t): t is string => typeof t === 'string' && t.length > 0,
    );
  }
  if (config.tool) {
    return [String(config.tool)];
  }
  return [];
}

export function createMcpClientExecutor(deps: McpClientExecutorDeps): NodeExecutor {
  return {
    type: 'mcpClient',
    async execute(ctx: NodeExecutionContext): Promise<NodeRunResult> {
      if (!deps.callMcpTool) {
        return {
          status: 'failed',
          errorMessage: 'E3012 MCP tool runtime not configured',
        };
      }

      const serverId = String(ctx.config.serverId ?? '').trim();
      if (!serverId) {
        return {
          status: 'failed',
          errorMessage: 'E1004 MCP serverId is required',
        };
      }

      const toolList = resolveMcpToolList(ctx.config);
      if (toolList.length === 0) {
        return {
          status: 'failed',
          errorMessage: 'E1004 At least one MCP tool must be selected',
        };
      }

      const args = ctx.config.args as Record<string, unknown> | undefined;
      try {
        const results: Array<{ tool: string; result: unknown }> = [];
        for (const tool of toolList) {
          results.push({
            tool,
            result: await deps.callMcpTool({
              serverId,
              toolName: tool,
              args,
            }),
          });
        }
        return {
          status: 'success',
          outputItems: [
            [
              {
                json: {
                  tools: results,
                  tool: results[0]?.tool,
                  result: results[0]?.result,
                },
              },
            ],
          ],
        };
      } catch (err) {
        return {
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}
