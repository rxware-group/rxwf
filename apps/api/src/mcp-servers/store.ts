import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { AwfError } from '@rxwf/shared';

export type McpTransport = 'npx' | 'docker' | 'http';

export interface McpDockerConfig {
  /** 留空时使用 command/args 直接调用 Docker CLI（如 mcp gateway run） */
  image?: string;
  args?: string[];
  volumes?: string[];
  env?: Record<string, string>;
  /** bridge | host | none 或自定义网络名 */
  network?: string;
}

export interface McpServerRecord {
  id: string;
  name: string;
  transport: McpTransport;
  command?: string;
  args?: string[];
  url?: string;
  docker?: McpDockerConfig;
  createdAt: string;
  updatedAt: string;
}

interface StoreFile {
  servers: McpServerRecord[];
}

export function createMcpServerStore(dataDir: string) {
  const filePath = join(dataDir, 'mcp-servers.json');

  async function load(): Promise<McpServerRecord[]> {
    try {
      const raw = await readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as StoreFile;
      return parsed.servers ?? [];
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? err.code : '';
      if (code === 'ENOENT') return [];
      throw err;
    }
  }

  async function save(servers: McpServerRecord[]): Promise<void> {
    await mkdir(dataDir, { recursive: true });
    const payload: StoreFile = { servers };
    await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  }

  return {
    async list(): Promise<McpServerRecord[]> {
      return load();
    },

    async get(id: string): Promise<McpServerRecord | null> {
      const servers = await load();
      return servers.find((s) => s.id === id) ?? null;
    },

    async create(input: {
      name: string;
      transport: McpTransport;
      command?: string;
      args?: string[];
      url?: string;
      docker?: McpDockerConfig;
    }): Promise<McpServerRecord> {
      const now = new Date().toISOString();
      const record: McpServerRecord = {
        id: crypto.randomUUID(),
        name: input.name,
        transport: input.transport,
        command: input.command,
        args: input.args,
        url: input.url,
        docker: input.docker,
        createdAt: now,
        updatedAt: now,
      };
      const servers = await load();
      servers.push(record);
      await save(servers);
      return record;
    },

    async update(
      id: string,
      patch: Partial<Omit<McpServerRecord, 'id' | 'createdAt'>>,
    ): Promise<McpServerRecord> {
      const servers = await load();
      const idx = servers.findIndex((s) => s.id === id);
      if (idx < 0) {
        throw new AwfError('E1001', `MCP server not found: ${id}`);
      }
      const updated: McpServerRecord = {
        ...servers[idx]!,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      servers[idx] = updated;
      await save(servers);
      return updated;
    },

    async remove(id: string): Promise<boolean> {
      const servers = await load();
      const next = servers.filter((s) => s.id !== id);
      if (next.length === servers.length) return false;
      await save(next);
      return true;
    },
  };
}

export type McpServerStore = ReturnType<typeof createMcpServerStore>;
