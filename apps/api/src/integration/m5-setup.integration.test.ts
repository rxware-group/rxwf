import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb } from '@rxwf/providers-lite';
import { createUserService } from '@rxwf/identity';
import { buildApp } from '../app.js';

describe('M5 setup integration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  beforeAll(async () => {
    const db = await createTestDb();
    await createUserService(db).createUser({
      email: 'setup@example.com',
      password: 'secret',
      role: 'admin',
    });
    const built = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    app = built.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns setup checklist (AC-35)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/setup/checklist' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { complete: boolean; items: { id: string; done: boolean }[] };
    expect(body.items.some((i) => i.id === 'admin' && i.done)).toBe(true);
    expect(body.complete).toBe(true);
  });
});
