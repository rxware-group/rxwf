import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb } from '@rxwf/providers-lite';
import { createAuthService, createUserService } from '@rxwf/identity';
import { buildApp } from '../app.js';

describe('mcp token routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let apiKey: string;

  beforeAll(async () => {
    const db = await createTestDb();
    const built = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    app = built.app;
    const users = createUserService(db);
    const auth = createAuthService(db);
    const user = await users.createUser({
      email: 'mcp-token@example.com',
      password: 'secret1234',
      role: 'member',
    });
    apiKey = (await auth.createApiKey(user.id, 'test')).key;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates MCP token and lists without secret', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/mcp-tokens',
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
      payload: { name: 'cursor' },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as { id: string; token: string; mcpJson: unknown };
    expect(created.token.length).toBeGreaterThan(10);
    expect(created.mcpJson).toBeTruthy();

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/mcp-tokens',
      headers: { 'x-api-key': apiKey },
    });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json() as { tokens: Array<{ id: string; name: string }> };
    expect(list.tokens.some((t) => t.id === created.id && t.name === 'cursor')).toBe(true);
    expect(JSON.stringify(list)).not.toContain(created.token);
  });
});
