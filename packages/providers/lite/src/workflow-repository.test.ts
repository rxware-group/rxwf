import { describe, it, expect } from 'vitest';
import { createWorkflowService } from '@rxwf/workflow';
import { createLiteWorkflowRepository } from './workflow-repository.js';
import { createTestDb } from './test-db.js';

const definition = {
  schemaVersion: 1 as const,
  name: 'Lite',
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

describe('createLiteWorkflowRepository', () => {
  it('persists workflow versions in sqlite', async () => {
    const db = await createTestDb();
    const repo = createLiteWorkflowRepository(db);
    const svc = createWorkflowService(repo);
    const created = await svc.create({ name: 'Lite Flow', definition });
    await svc.update(created.id, { ...definition, name: 'Lite v2' });
    const loaded = await svc.get(created.id);
    expect(loaded?.version).toBe(0);
    expect(loaded?.name).toBe('Lite v2');
  });
});

