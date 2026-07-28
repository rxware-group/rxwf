/**
 * Standard deploy profile: PG workflows + BullMQ queue + /api/ready probe.
 * Skips when Postgres/Redis are unavailable (local dev without services).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createStandardHealthChecker } from '@rxwf/providers-standard';
import { createTestDb } from '@rxwf/providers-lite';
import { createAuthService, createUserService } from '@rxwf/identity';

const PG_URL =
  process.env.RXWF_DATABASE_URL ?? 'postgres://rxwf:rxwf@localhost:5432/rxwf';
const REDIS_URL = process.env.RXWF_REDIS_URL ?? 'redis://localhost:6379';

describe('standard deploy profile (API)', () => {
  let skip = false;
  let app: Awaited<ReturnType<typeof import('../app.js').buildApp>>['app'];
  let apiKey = '';

  beforeAll(async () => {
    const health = await createStandardHealthChecker({
      databaseUrl: PG_URL,
      redisUrl: REDIS_URL,
    }).check();
    if (!health.ready) {
      skip = true;
      return;
    }

    process.env.RXWF_DEPLOY_PROFILE = 'standard';
    process.env.RXWF_DATABASE_URL = PG_URL;
    process.env.RXWF_REDIS_URL = REDIS_URL;

    const { buildApp } = await import('../app.js');
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
      email: 'standard@example.com',
      password: 'secret1234',
      role: 'admin',
    });
    apiKey = (await auth.createApiKey(user.id, 'standard-it')).key;
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  const headers = () => ({ 'x-api-key': apiKey });

  it('GET /api/ready reports postgres, redis, and queue', async () => {
    if (skip) return;
    const res = await app.inject({ method: 'GET', url: '/api/ready' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      ready: boolean;
      postgres?: boolean;
      redis?: boolean;
      queue?: boolean;
    };
    expect(body.ready).toBe(true);
    expect(body.postgres).toBe(true);
    expect(body.redis).toBe(true);
    expect(body.queue).toBe(true);
  });

  it('creates workflow in PG and lists via API', async () => {
    if (skip) return;
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      headers: { ...headers(), 'content-type': 'application/json' },
      payload: {
        name: 'Standard PG Workflow',
        definition: {
          schemaVersion: 1,
          name: 'Standard PG Workflow',
          nodes: [
            {
              id: 't1',
              type: 'manualtrigger',
              name: 'Start',
              position: { x: 0, y: 0 },
              parameters: {},
            },
          ],
          connections: [],
        },
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { id } = createRes.json() as { id: string };

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/workflows',
      headers: headers(),
    });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json() as { workflows: Array<{ id: string }> };
    expect(list.workflows.some((w) => w.id === id)).toBe(true);
  });
});
