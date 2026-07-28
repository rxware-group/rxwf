import { describe, it, expect, beforeAll } from 'vitest';
import { createTestDb } from '@rxwf/providers-lite';
import { buildApp } from '../app.js';
import { createAuthService, createUserService } from '@rxwf/identity';

describe('knowledge-bases routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let apiKey: string;

  beforeAll(async () => {
    const db = await createTestDb();
    const built = await buildApp({
      db,
      featurePlus: true,
      disableJobProcessor: true,
      disableScheduler: true,
      seedKnowledgePlatformConfig: true,
    });
    app = built.app;
    const users = createUserService(db);
    const auth = createAuthService(db);
    const user = await users.createUser({
      email: 'kb@test.local',
      password: 'password123',
      role: 'admin',
    });
    const key = await auth.createApiKey(user.id, 'kb-test');
    apiKey = key.key;
  });

  it('creates knowledge base and lists documents', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { 'x-api-key': apiKey },
      payload: { name: 'Ops Manual', description: 'test' },
    });
    expect(create.statusCode).toBe(201);
    const kb = create.json() as { id: string };

    const list = await app.inject({
      method: 'GET',
      url: `/api/knowledge-bases/${kb.id}/documents`,
      headers: { 'x-api-key': apiKey },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual({ items: [] });
  });

  it('manages knowledge base collaborators', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { 'x-api-key': apiKey },
      payload: { name: 'Shared KB', description: 'collab test' },
    });
    expect(create.statusCode).toBe(201);
    const kb = create.json() as { id: string };

    const list = await app.inject({
      method: 'GET',
      url: `/api/knowledge-bases/${kb.id}/collaborators`,
      headers: { 'x-api-key': apiKey },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as {
      ownerUserId: string;
      collaborators: unknown[];
    };
    expect(body.ownerUserId).toBeTruthy();
    expect(body.collaborators).toEqual([]);
  });

  it('uploads document via multipart', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { 'x-api-key': apiKey },
      payload: { name: 'Docs' },
    });
    const kb = create.json() as { id: string };

    const boundary = '----rxwf-test-boundary';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="note.md"',
      'Content-Type: text/markdown',
      '',
      '# Hello\n\nThis is a knowledge base test document with enough text.',
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const upload = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kb.id}/documents`,
      headers: {
        'x-api-key': apiKey,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });
    expect(upload.statusCode).toBe(201);
    const doc = upload.json() as { id: string; status: string };
    expect(doc.status).toBe('pending');
  });
});
