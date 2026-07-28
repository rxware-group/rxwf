import { describe, it, expect } from 'vitest';
import { createTestDb } from '@rxwf/providers-lite';
import { buildApp } from '../app.js';
import { createAuthService, createUserService } from '@rxwf/identity';

const definition = {
  schemaVersion: 1 as const,
  name: 'ACL Flow',
  nodes: [
    {
      id: 't1',
      type: 'manualTrigger',
      name: 'Start',
      position: { x: 0, y: 0 },
      parameters: {},
    },
  ],
  connections: [],
};

async function createUserWithKey(
  db: Awaited<ReturnType<typeof createTestDb>>,
  role: 'admin' | 'member',
  label: string,
) {
  const users = createUserService(db);
  const auth = createAuthService(db);
  const user = await users.createUser({
    email: `${label}-${crypto.randomUUID()}@example.com`,
    password: 'secret1234',
    role,
  });
  const { key } = await auth.createApiKey(user.id, 'test');
  return { user, key };
}

describe('workflows ACL API', () => {
  it('member shares viewer access and recipient lists shared workflows only', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });

    const owner = await createUserWithKey(db, 'member', 'owner');
    const viewer = await createUserWithKey(db, 'member', 'viewer');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      headers: { 'x-api-key': owner.key },
      payload: { name: 'Shared Flow', definition },
    });
    expect(createRes.statusCode).toBe(201);
    const { id: workflowId } = createRes.json() as { id: string };

    const shareRes = await app.inject({
      method: 'PUT',
      url: `/api/workflows/${workflowId}/collaborators`,
      headers: { 'x-api-key': owner.key },
      payload: {
        collaborators: [{ userId: viewer.user.id, role: 'viewer' }],
      },
    });
    expect(shareRes.statusCode).toBe(200);

    const sharedListRes = await app.inject({
      method: 'GET',
      url: '/api/workflows?scope=shared',
      headers: { 'x-api-key': viewer.key },
    });
    expect(sharedListRes.statusCode).toBe(200);
    const sharedIds = (sharedListRes.json() as { workflows: Array<{ id: string }> }).workflows.map(
      (w) => w.id,
    );
    expect(sharedIds).toEqual([workflowId]);

    const mineListRes = await app.inject({
      method: 'GET',
      url: '/api/workflows?scope=mine',
      headers: { 'x-api-key': viewer.key },
    });
    expect(mineListRes.statusCode).toBe(200);
    const mineIds = (mineListRes.json() as { workflows: Array<{ id: string }> }).workflows.map(
      (w) => w.id,
    );
    expect(mineIds).toEqual([]);

    await app.close();
  });

  it('non-member cannot GET workflow by id', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });

    const owner = await createUserWithKey(db, 'member', 'owner');
    const stranger = await createUserWithKey(db, 'member', 'stranger');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      headers: { 'x-api-key': owner.key },
      payload: { name: 'Private Flow', definition },
    });
    expect(createRes.statusCode).toBe(201);
    const { id: workflowId } = createRes.json() as { id: string };

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/workflows/${workflowId}`,
      headers: { 'x-api-key': stranger.key },
    });
    expect(getRes.statusCode).toBe(403);
    expect(getRes.json()).toMatchObject({ code: 'E4003' });

    await app.close();
  });
});
