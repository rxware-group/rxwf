import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb } from '@rxwf/providers-lite';
import { createAuthService, createUserService } from '@rxwf/identity';
import { buildApp } from '../app.js';

describe('/api/templates', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let apiKey: string;

  beforeAll(async () => {
    const db = await createTestDb();
    const built = await buildApp({ db, disableScheduler: true, disableJobProcessor: true });
    app = built.app;
    const users = createUserService(db);
    const auth = createAuthService(db);
    const user = await users.createUser({
      email: 'templates@example.com',
      password: 'secret1234',
      role: 'admin',
    });
    apiKey = (await auth.createApiKey(user.id, 'tpl')).key;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists built-in templates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/templates',
      headers: { 'x-api-key': apiKey },
    });
    expect(res.statusCode).toBe(200);
    const json = res.json() as { templates: Array<{ id: string; name: string }> };
    expect(json.templates.length).toBeGreaterThanOrEqual(3);
    expect(json.templates.some((t) => t.id === 'manual-set-if')).toBe(true);
    expect(json.templates.some((t) => t.id === 'agent-single')).toBe(true);
    const agentTpl = json.templates.find((t) => t.id === 'agent-single');
    expect(agentTpl?.category).toBe('agent');
    const autoTpl = json.templates.find((t) => t.id === 'manual-set-if');
    expect(autoTpl?.category).toBe('automation');
  });

  it('clones a template into a new workflow', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/templates/manual-set-if/clone',
      headers: { 'x-api-key': apiKey },
    });
    expect(res.statusCode).toBe(201);
    const json = res.json() as { id: string };
    expect(json.id).toBeTruthy();

    const wf = await app.inject({
      method: 'GET',
      url: `/api/workflows/${json.id}`,
      headers: { 'x-api-key': apiKey },
    });
    expect(wf.statusCode).toBe(200);
  });
});
