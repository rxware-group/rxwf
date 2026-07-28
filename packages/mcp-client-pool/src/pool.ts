import { AwfError } from '@rxwf/shared';

import { spawnMcpStdioClient } from './stdio-client.js';



export interface McpClientHandle {

  id: string;

  listTools(): Promise<string[]>;

  callTool(name: string, args?: Record<string, unknown>): Promise<unknown>;

  close(): void;

}



export interface McpLaunchOptions {

  command: string;

  args: string[];

  env?: Record<string, string>;

}



export interface McpSpawnFn {

  (id: string, opts: McpLaunchOptions): Promise<McpClientHandle>;

}



export function createMcpClientPool(options: {

  maxClients?: number;

  spawnFn?: McpSpawnFn;

}) {

  const max = options.maxClients ?? 3;

  const active = new Map<string, McpClientHandle>();



  const spawnFn = options.spawnFn ?? spawnMcpStdioClient;



  return {

    async acquire(id: string, launch?: McpLaunchOptions): Promise<McpClientHandle> {

      if (active.size >= max && !active.has(id)) {

        throw new AwfError('E3010', `MCP client pool full (max ${max})`);

      }

      if (active.has(id)) {

        return active.get(id)!;

      }

      if (!launch?.command || !launch.args?.length) {

        throw new AwfError('E1004', 'MCP launch command and args required');

      }

      const handle = await spawnFn(id, launch);

      active.set(id, handle);

      return handle;

    },



    release(id: string): void {

      const handle = active.get(id);

      if (handle) {

        handle.close();

        active.delete(id);

      }

    },



    size(): number {

      return active.size;

    },

  };

}


