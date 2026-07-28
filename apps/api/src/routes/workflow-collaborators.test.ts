import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import {
  createLiteWorkflowRepository,
  createTestDb,
  createWorkflowCollaboratorRepository,
} from '@rxwf/providers-lite';
import {
  createAuthService,
  createUserService,
  createWorkflowAccessService,
} from '@rxwf/identity';
import { createWorkflowService } from '@rxwf/workflow';
import { createAuthPreHandler } from '../middleware/auth.js';
import { buildApp } from '../app.js';
import { registerWorkflowCollaboratorRoutes } from './workflow-collaborators.js';

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

async function buildCollaboratorRouteApp(db: Awaited<ReturnType<typeof createTestDb>>) {
  const app = Fastify({ logger: false });
  const authService = createAuthService(db);
  const authPreHandler = createAuthPreHandler(authService);
  const workflowRepo = createLiteWorkflowRepository(db);
  const workflowService = createWorkflowService(workflowRepo);
  const collaboratorRepo = createWorkflowCollaboratorRepository(db);
  const workflowAccess = createWorkflowAccessService({
    collaborators: collaboratorRepo,
    getWorkflowMeta: (id) => workflowService.getMeta(id),
  });
  const users = createUserService(db);

  registerWorkflowCollaboratorRoutes(app, authPreHandler, {
    workflowService,
    collaboratorRepo,
    workflowAccess,
    users,
  });
  await app.ready();
  return { app, workflowService };
}

describe('workflow collaborators API', () => {
  it('owner can share collaborators via PUT', async () => {
    const db = await createTestDb();
    const { app, workflowService } = await buildCollaboratorRouteApp(db);
    const owner = await createUserWithKey(db, 'member', 'owner');
    const viewer = await createUserWithKey(db, 'member', 'viewer');

    const created = await workflowService.create({
      name: 'Shared Flow',
      definition,
      createdByUserId: owner.user.id,
    });

    const shareRes = await app.inject({
      method: 'PUT',
      url: `/api/workflows/${created.id}/collaborators`,
      headers: { 'x-api-key': owner.key },
      payload: {
        collaborators: [{ userId: viewer.user.id, role: 'viewer' }],
      },
    });
    expect(shareRes.statusCode).toBe(200);
    const body = shareRes.json() as {
      creatorUserId: string;
      collaborators: Array<{ userId: string; role: string }>;
    };
    expect(body.creatorUserId).toBe(owner.user.id);
    expect(body.collaborators).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: viewer.user.id, role: 'viewer' }),
      ]),
    );

    await app.close();
  });

  it('viewer can GET collaborators but cannot PUT share', async () => {
    const db = await createTestDb();
    const { app, workflowService } = await buildCollaboratorRouteApp(db);
    const owner = await createUserWithKey(db, 'member', 'owner');
    const viewer = await createUserWithKey(db, 'member', 'viewer');

    const created = await workflowService.create({
      name: 'Viewer Flow',
      definition,
      createdByUserId: owner.user.id,
    });

    await app.inject({
      method: 'PUT',
      url: `/api/workflows/${created.id}/collaborators`,
      headers: { 'x-api-key': owner.key },
      payload: {
        collaborators: [{ userId: viewer.user.id, role: 'viewer' }],
      },
    });

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/workflows/${created.id}/collaborators`,
      headers: { 'x-api-key': viewer.key },
    });
    expect(getRes.statusCode).toBe(200);

    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/workflows/${created.id}/collaborators`,
      headers: { 'x-api-key': viewer.key },
      payload: {
        collaborators: [{ userId: viewer.user.id, role: 'editor' }],
      },
    });
    expect(putRes.statusCode).toBe(403);
    expect(putRes.json()).toMatchObject({ code: 'E4003' });

    await app.close();
  });

  it('editor can share collaborators', async () => {
    const db = await createTestDb();
    const { app, workflowService } = await buildCollaboratorRouteApp(db);
    const owner = await createUserWithKey(db, 'member', 'owner');
    const editor = await createUserWithKey(db, 'member', 'editor');
    const viewer = await createUserWithKey(db, 'member', 'viewer');

    const created = await workflowService.create({
      name: 'Editor Flow',
      definition,
      createdByUserId: owner.user.id,
    });

    await app.inject({
      method: 'PUT',
      url: `/api/workflows/${created.id}/collaborators`,
      headers: { 'x-api-key': owner.key },
      payload: {
        collaborators: [{ userId: editor.user.id, role: 'editor' }],
      },
    });

    const shareRes = await app.inject({
      method: 'PUT',
      url: `/api/workflows/${created.id}/collaborators`,
      headers: { 'x-api-key': editor.key },
      payload: {
        collaborators: [
          { userId: editor.user.id, role: 'editor' },
          { userId: viewer.user.id, role: 'viewer' },
        ],
      },
    });
    expect(shareRes.statusCode).toBe(200);
    const body = shareRes.json() as { collaborators: Array<{ userId: string }> };
    expect(body.collaborators.map((c) => c.userId)).toEqual(
      expect.arrayContaining([editor.user.id, viewer.user.id]),
    );

    await app.close();
  });
});

describe('workflow ACL delete guard', () => {
  it('viewer cannot DELETE workflow', async () => {
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
      payload: { name: 'Protected Flow', definition },
    });
    expect(createRes.statusCode).toBe(201);
    const { id: workflowId } = createRes.json() as { id: string };

    await app.inject({
      method: 'PUT',
      url: `/api/workflows/${workflowId}/collaborators`,
      headers: { 'x-api-key': owner.key },
      payload: {
        collaborators: [{ userId: viewer.user.id, role: 'viewer' }],
      },
    });

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/workflows/${workflowId}`,
      headers: { 'x-api-key': viewer.key },
    });
    expect(deleteRes.statusCode).toBe(403);
    expect(deleteRes.json()).toMatchObject({ code: 'E4003' });

    await app.close();
  });
});
