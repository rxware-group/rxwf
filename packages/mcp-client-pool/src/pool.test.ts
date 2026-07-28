import { describe, it, expect } from 'vitest';
import { createMcpClientPool } from './pool.js';

const mockSpawn = async (id: string) => ({
  id,
  async listTools() {
    return [];
  },
  async callTool() {
    return {};
  },
  close() {},
});

const launch = { command: 'npx', args: ['-y', 'stub'] };

describe('createMcpClientPool', () => {
  it('rejects when pool is at max capacity (AC-24)', async () => {
    const pool = createMcpClientPool({ maxClients: 2, spawnFn: mockSpawn });
    await pool.acquire('a', launch);
    await pool.acquire('b', launch);
    await expect(pool.acquire('c', launch)).rejects.toMatchObject({ code: 'E3010' });
    pool.release('a');
    const slot = await pool.acquire('c', launch);
    expect(slot.id).toBe('c');
  });

  it('invokes tool via npx command template', async () => {
    const pool = createMcpClientPool({
      maxClients: 3,
      spawnFn: async (id) => ({
        id,
        async listTools() {
          return ['tool_a', 'tool_b'];
        },
        async callTool(name: string) {
          return { name, ok: true };
        },
        close() {},
      }),
    });
    const client = await pool.acquire('npx', { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] });
    const result = await client.callTool('list_directory');
    expect(result).toEqual({ name: 'list_directory', ok: true });
    pool.release(client.id);
  });
});
