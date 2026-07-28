/**
 * Knowledge platform config integration: seed config → create KB → upload → query
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { EmbeddingProvider } from '@rxwf/knowledge';
import { createTestDb } from '@rxwf/providers-lite';
import { createAuthService, createUserService } from '@rxwf/identity';
import { buildApp } from '../app.js';
import { getBootstrapAppContext } from '../bootstrap.js';

const MOCK_DIM = 8;
const MOCK_VEC = Array.from({ length: MOCK_DIM }, (_, i) => (i === 0 ? 1 : 0));

function mockEmbeddings(): EmbeddingProvider {
  return {
    async embed() {
      return [...MOCK_VEC];
    },
    async embedBatch(texts: string[]) {
      return texts.map(() => [...MOCK_VEC]);
    },
  };
}

describe('knowledge platform config integration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let apiKey: string;
  let jobProcessor: NonNullable<
    ReturnType<typeof getBootstrapAppContext>
  >['executionRuntime']['jobProcessor'];

  beforeAll(async () => {
    process.env.RXWF_JOB_TICK_MS = '50';
    const db = await createTestDb();
    const built = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: false,
      featurePlus: true,
      seedKnowledgePlatformConfig: true,
      createEmbeddings: () => mockEmbeddings(),
    });
    app = built.app;
    jobProcessor = getBootstrapAppContext()!.executionRuntime.jobProcessor;
    const users = createUserService(db);
    const auth = createAuthService(db);
    const user = await users.createUser({
      email: 'kb-platform@example.com',
      password: 'secret',
      role: 'admin',
    });
    apiKey = (await auth.createApiKey(user.id, 'kb-platform')).key;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const headers = () => ({ 'x-api-key': apiKey });

  it('rejects knowledge writes when platform is not configured', async () => {
    const db = await createTestDb();
    const built = await buildApp({
      db,
      featurePlus: true,
      disableJobProcessor: true,
      disableScheduler: true,
    });
    const users = createUserService(db);
    const auth = createAuthService(db);
    const user = await users.createUser({
      email: 'kb-unconfigured@example.com',
      password: 'secret',
      role: 'admin',
    });
    const key = (await auth.createApiKey(user.id, 'kb-unconfigured')).key;
    await built.app.ready();

    const res = await built.app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { 'x-api-key': key },
      payload: { name: 'Should Fail' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      code: 'E1004',
      message: expect.stringContaining('Knowledge platform'),
    });

    await built.app.close();
  });

  it(
    'seed config → create KB → upload document → query returns hits',
    async () => {
    const settingsRes = await app.inject({
      method: 'GET',
      url: '/api/settings/knowledge',
      headers: headers(),
    });
    expect(settingsRes.statusCode).toBe(200);
    const settings = settingsRes.json() as { configured: boolean };
    expect(settings.configured).toBe(true);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: headers(),
      payload: { name: 'Platform KB' },
    });
    expect(createRes.statusCode).toBe(201);
    const kbId = (createRes.json() as { id: string }).id;

    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/documents`,
      headers: headers(),
      payload: {
        fileName: 'note.txt',
        mimeType: 'text/plain',
        contentBase64: Buffer.from('hello knowledge platform').toString('base64'),
      },
    });
    expect(uploadRes.statusCode).toBe(201);
    const docId = (uploadRes.json() as { id: string }).id;

    const reindexRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/documents/${docId}/reindex`,
      headers: headers(),
    });
    expect(reindexRes.statusCode).toBe(202);

    let indexed = false;
    for (let i = 0; i < 80; i++) {
      await jobProcessor.processOnce(10);
      const docRes = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: headers(),
      });
      const items = (docRes.json() as { items: Array<{ id: string; status: string }> }).items;
      const doc = items.find((d) => d.id === docId);
      if (doc?.status === 'indexed') {
        indexed = true;
        break;
      }
      if (doc?.status === 'failed') {
        throw new Error(`Document indexing failed: ${doc.errorMessage ?? 'unknown'}`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(indexed).toBe(true);

    const queryRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/query`,
      headers: headers(),
      payload: { query: 'hello' },
    });
    expect(queryRes.statusCode).toBe(200);
    const hits = (queryRes.json() as { hits: unknown[] }).hits;
    expect(hits.length).toBeGreaterThan(0);
  },
    20_000,
  );
});
