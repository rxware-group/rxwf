import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { McpClientHandle, McpLaunchOptions } from './pool.js';

function mergeEnv(extra?: Record<string, string>): Record<string, string> | undefined {
  if (!extra || Object.keys(extra).length === 0) return undefined;
  const base: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === 'string') base[k] = v;
  }
  return { ...base, ...extra };
}

async function listToolNames(client: Client): Promise<string[]> {
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await client.listTools(cursor ? { cursor } : undefined);
    for (const t of page.tools) {
      if (t.name) names.push(t.name);
    }
    cursor = page.nextCursor;
  } while (cursor);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

export async function spawnMcpStdioClient(
  id: string,
  opts: McpLaunchOptions,
): Promise<McpClientHandle> {
  const isHttpStub =
    opts.command === 'npx' &&
    opts.args?.includes('-y') &&
    opts.args?.includes('rxwf-mcp-http-stub');
  if (isHttpStub) {
    throw new Error('HTTP MCP 传输暂未实现 tools/list，请使用 stdio（npx/docker）');
  }

  const transport = new StdioClientTransport({
    command: opts.command,
    args: opts.args,
    env: mergeEnv(opts.env),
    stderr: 'pipe',
  });
  const client = new Client({ name: 'rx-workflow', version: '1.0.0' });
  await client.connect(transport);

  return {
    id,
    async listTools() {
      return listToolNames(client);
    },
    async callTool(name: string, args?: Record<string, unknown>) {
      return client.callTool({ name, arguments: args ?? {} });
    },
    close() {
      void transport.close();
      void client.close();
    },
  };
}
