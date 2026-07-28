import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb } from '@rxwf/providers-lite';
import { createAuthService, createUserService } from '@rxwf/identity';
import { buildApp } from '../app.js';

describe('chat routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let apiKey: string;

  beforeAll(async () => {
    const db = await createTestDb();
    const built = await buildApp({
      db,
      featurePlus: true,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    app = built.app;
    const users = createUserService(db);
    const auth = createAuthService(db);
    const user = await users.createUser({
      email: 'chat@test.local',
      password: 'password123',
      role: 'admin',
    });
    apiKey = (await auth.createApiKey(user.id, 'chat-test')).key;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const headers = () => ({ 'x-api-key': apiKey });

  it('DELETE session returns 204 and removes from list', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/chat/sessions',
      headers: headers(),
      payload: { title: 'To delete' },
    });
    expect(create.statusCode).toBe(201);
    const session = create.json() as { id: string };

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/chat/sessions/${session.id}`,
      headers: headers(),
    });
    expect(del.statusCode).toBe(204);

    const list = await app.inject({
      method: 'GET',
      url: '/api/chat/sessions',
      headers: headers(),
    });
    expect(list.statusCode).toBe(200);
    const sessions = (list.json() as { sessions: { id: string }[] }).sessions;
    expect(sessions.some((s) => s.id === session.id)).toBe(false);
  });

  it('PATCH modelId updates session', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/chat/sessions',
      headers: headers(),
      payload: { title: 'Model test' },
    });
    expect(create.statusCode).toBe(201);
    const session = create.json() as { id: string; modelId?: string | null };
    expect(session.modelId).toBeFalsy();

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/chat/sessions/${session.id}`,
      headers: headers(),
      payload: { modelId: 'gpt-4o-mini' },
    });
    expect(patch.statusCode).toBe(200);
    const updated = patch.json() as { modelId?: string | null };
    expect(updated.modelId).toBe('gpt-4o-mini');
  });
});
