import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb } from '@rxwf/providers-lite';
import { createAuthService, createUserService } from '@rxwf/identity';
import { buildApp } from '../app.js';

describe('models routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let apiKey: string;

  beforeAll(async () => {
    const db = await createTestDb();
    const built = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
      featurePlus: true,
      aiRuntime: {
        async *chat() {
          yield 'mock-assistant';
        },
      },
    });
    app = built.app;
    const users = createUserService(db);
    const auth = createAuthService(db);
    const admin = await users.createUser({
      email: 'models-admin@example.com',
      password: 'secret',
      role: 'admin',
    });
    apiKey = (await auth.createApiKey(admin.id, 'models')).key;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const headers = () => ({ 'x-api-key': apiKey });

  it('GET /api/models returns array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/models',
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { models: unknown[] };
    expect(Array.isArray(body.models)).toBe(true);
  });

  it('POST /api/models/providers as admin returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/models/providers',
      headers: headers(),
      payload: {
        name: 'Local Ollama',
        kind: 'ollama',
        baseUrl: 'http://127.0.0.1:11434',
        enabled: true,
      },
    });
    expect(res.statusCode).toBe(201);
    const provider = res.json() as { id: string; name: string; kind: string };
    expect(provider.name).toBe('Local Ollama');
    expect(provider.kind).toBe('ollama');
    expect(provider.id).toBeTruthy();
  });
});
