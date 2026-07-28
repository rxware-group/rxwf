import { describe, it, expect } from 'vitest';
import { createTestDb } from './test-db.js';
import { createLiteModelCatalogRepository } from './model-catalog-repository.js';

describe('createLiteModelCatalogRepository', () => {
  it('creates provider and model, lists by capability chat', async () => {
    const db = await createTestDb();
    const repo = createLiteModelCatalogRepository(db);
    await repo.createProvider({
      id: 'p1',
      name: 'Ollama',
      kind: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      credentialId: null,
      enabled: true,
    });
    await repo.addModel({
      id: 'm1',
      providerId: 'p1',
      modelName: 'llama3',
      capabilities: ['chat'],
      isDefaultChat: false,
      isDefaultWorkflow: false,
      enabled: true,
      source: 'manual',
    });
    const models = await repo.listModels({ capability: 'chat' });
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].modelName).toBeDefined();
  });
});
