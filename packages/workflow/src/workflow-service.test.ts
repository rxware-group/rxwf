import { describe, it, expect, beforeEach } from 'vitest';
import { createWorkflowService } from './workflow-service.js';
import type { WorkflowDefinition, WorkflowRepositoryPort } from './workflow-service.js';

const validDefinition: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'Demo',
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

type VersionRow = {
  id: string;
  workflowId: string;
  version: number;
  definition: string;
  semverLabel: string;
  changeNote: string | null;
  publishedAt: Date | null;
  publishedByUserId: string | null;
  publishNote: string | null;
  createdAt: Date;
};

function createMemoryRepo(): WorkflowRepositoryPort {
  const workflows = new Map<
    string,
    {
      id: string;
      name: string;
      description: string;
      status: string;
      publishedVersionId: string | null;
      publishedAt: Date | null;
      createdByUserId: string | null;
      createdAt: Date;
      updatedAt: Date;
    }
  >();
  const versions = new Map<string, VersionRow[]>();
  const publishLogs: Array<{ workflowId: string; action: string }> = [];

  return {
    async insertWorkflow(row) {
      workflows.set(row.id, {
        id: row.id,
        name: row.name,
        description: row.description ?? '',
        status: row.status,
        publishedVersionId: row.publishedVersionId ?? null,
        publishedAt: row.publishedAt ?? null,
        createdByUserId: row.createdByUserId ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
      versions.set(row.id, []);
    },
    async insertVersion(row) {
      versions.get(row.workflowId)!.push({
        id: row.id,
        workflowId: row.workflowId,
        version: row.version,
        definition: row.definition,
        semverLabel: row.semverLabel,
        changeNote: row.changeNote ?? null,
        publishedAt: row.publishedAt ?? null,
        publishedByUserId: row.publishedByUserId ?? null,
        publishNote: row.publishNote ?? null,
        createdAt: row.createdAt,
      });
    },
    async updateWorkflow(row) {
      const existing = workflows.get(row.id);
      workflows.set(row.id, {
        id: row.id,
        name: row.name,
        description: row.description ?? existing?.description ?? '',
        status: row.status,
        publishedVersionId: row.publishedVersionId ?? null,
        publishedAt: row.publishedAt ?? null,
        createdByUserId: existing?.createdByUserId ?? null,
        createdAt: existing?.createdAt ?? row.updatedAt,
        updatedAt: row.updatedAt,
      });
    },
    async findByName(name) {
      for (const row of workflows.values()) {
        if (row.name === name) return { id: row.id };
      }
      return null;
    },
    async getWorkflow(id) {
      return workflows.get(id) ?? null;
    },
    async getDraftVersion(workflowId) {
      const list = versions.get(workflowId) ?? [];
      return list.find((v) => v.publishedAt === null) ?? null;
    },
    async updateDraftVersion(workflowId, definition) {
      const draft = await this.getDraftVersion(workflowId);
      if (!draft) return false;
      draft.definition = definition;
      return true;
    },
    async getVersionById(versionId) {
      for (const list of versions.values()) {
        const row = list.find((v) => v.id === versionId);
        if (row) return row;
      }
      return null;
    },
    async getPublishedVersion(workflowId, version) {
      const list = versions.get(workflowId) ?? [];
      return list.find((v) => v.version === version && v.publishedAt !== null) ?? null;
    },
    async getNextPublishedVersionNumber(workflowId) {
      const list = versions.get(workflowId) ?? [];
      const published = list.filter((v) => v.publishedAt !== null);
      if (published.length === 0) return 1;
      return Math.max(...published.map((v) => v.version)) + 1;
    },
    async listPublishedVersions(workflowId) {
      const wf = workflows.get(workflowId);
      const list = (versions.get(workflowId) ?? [])
        .filter((v) => v.publishedAt !== null)
        .sort((a, b) => b.version - a.version);
      return list.map((v) => ({
        id: v.id,
        version: v.version,
        semverLabel: v.semverLabel,
        publishNote: v.publishNote,
        publishedAt: v.publishedAt!,
        publishedByUserId: v.publishedByUserId,
        publishedByEmail: null,
        isCurrent: wf?.publishedVersionId === v.id,
      }));
    },
    async appendPublishLog(input) {
      publishLogs.push({ workflowId: input.workflowId, action: input.action });
    },
    async listWorkflows(options?: { ids?: string[] }) {
      const rows = [...workflows.values()];
      const filtered = options?.ids?.length
        ? rows.filter((row) => new Set(options.ids).has(row.id))
        : rows;
      return filtered.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        publishedVersionId: row.publishedVersionId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        createdByUserId: row.createdByUserId,
        createdByEmail: null,
        createdByNickname: null,
      }));
    },
    async deleteWorkflow(workflowId: string) {
      if (!workflows.has(workflowId)) return false;
      workflows.delete(workflowId);
      versions.delete(workflowId);
      return true;
    },
  };
}

describe('createWorkflowService', () => {
  let repo: WorkflowRepositoryPort;

  beforeEach(() => {
    repo = createMemoryRepo();
  });

  it('creates workflow with draft version', async () => {
    const svc = createWorkflowService(repo);
    const created = await svc.create({ name: 'My Flow', definition: validDefinition });
    const loaded = await svc.get(created.id);
    expect(loaded?.name).toBe('My Flow');
    expect(loaded?.definition.name).toBe('My Flow');
  });

  it('rejects duplicate workflow names', async () => {
    const svc = createWorkflowService(repo);
    await svc.create({ name: 'Unique Flow', definition: validDefinition });
    await expect(
      svc.create({ name: 'Unique Flow', definition: validDefinition }),
    ).rejects.toMatchObject({ code: 'E1040' });
  });

  it('updates workflow metadata', async () => {
    const svc = createWorkflowService(repo);
    const created = await svc.create({
      name: 'Meta Flow',
      description: 'old',
      definition: validDefinition,
    });
    await svc.updateMeta(created.id, { name: 'Renamed Flow', description: 'new desc' });
    const loaded = await svc.get(created.id);
    expect(loaded?.name).toBe('Renamed Flow');
    expect(loaded?.description).toBe('new desc');
    expect(loaded?.definition.name).toBe('Renamed Flow');
  });

  it('updates draft in place without creating published versions', async () => {
    const svc = createWorkflowService(repo);
    const created = await svc.create({ name: 'My Flow', definition: validDefinition });
    await svc.update(created.id, { ...validDefinition, name: 'Demo v2' });
    const published = await svc.listPublishedVersions(created.id);
    expect(published).toHaveLength(0);
    const loaded = await svc.get(created.id);
    expect(loaded?.definition.name).toBe('Demo v2');
  });

  it('publish creates snapshot and sets hasUnpublishedChanges after draft edit', async () => {
    const svc = createWorkflowService(repo);
    const created = await svc.create({ name: 'My Flow', definition: validDefinition });
    const published = await svc.publish(created.id, 'user-1', 'first release');
    expect(published.status).toBe('published');
    expect(published.version).toBe(1);
    expect(published.semverLabel).toBe('1.0.0');

    let loaded = await svc.get(created.id);
    expect(loaded?.hasUnpublishedChanges).toBe(false);

    await svc.update(created.id, { ...validDefinition, name: 'Draft changed' });
    loaded = await svc.get(created.id);
    expect(loaded?.hasUnpublishedChanges).toBe(true);
  });

  it('listPublishedVersions returns published snapshots descending', async () => {
    const svc = createWorkflowService(repo);
    const created = await svc.create({ name: 'My Flow', definition: validDefinition });
    await svc.publish(created.id, 'user-1', 'v1');
    await svc.update(created.id, { ...validDefinition, name: 'Draft v2' });
    await svc.publish(created.id, 'user-1', 'v2');

    const vers = await svc.listPublishedVersions(created.id);
    expect(vers.map((v) => v.version)).toEqual([2, 1]);
    expect(vers[0]?.publishNote).toBe('v2');
  });

  it('rollbackPublish points production to older published version', async () => {
    const svc = createWorkflowService(repo);
    const created = await svc.create({ name: 'My Flow', definition: validDefinition });
    await svc.publish(created.id, 'user-1');
    await svc.update(created.id, { ...validDefinition, name: 'Draft v2' });
    await svc.publish(created.id, 'user-1');

    const rolled = await svc.rollbackPublish(created.id, 1, 'user-1');
    expect(rolled.version).toBe(1);
    const loaded = await svc.get(created.id);
    expect(loaded?.publishedVersion).toBe(1);
  });

  it('restoreDraftFromPublished copies published definition to draft', async () => {
    const svc = createWorkflowService(repo);
    const created = await svc.create({ name: 'My Flow', definition: validDefinition });
    await svc.publish(created.id, 'user-1');
    await svc.update(created.id, { ...validDefinition, name: 'Changed draft' });
    await svc.restoreDraftFromPublished(created.id, 1, 'user-1');
    const loaded = await svc.get(created.id);
    expect(loaded?.definition.name).toBe('My Flow');
  });

  it('rejects invalid definition with E1003 on cycle', async () => {
    const svc = createWorkflowService(repo);
    await expect(
      svc.create({
        name: 'Bad',
        definition: {
          ...validDefinition,
          nodes: [
            { id: 'a', type: 'set', name: 'A', position: { x: 0, y: 0 }, parameters: {} },
            { id: 'b', type: 'set', name: 'B', position: { x: 1, y: 0 }, parameters: {} },
          ],
          connections: [
            { from: 'a', to: 'b' },
            { from: 'b', to: 'a' },
          ],
        },
      }),
    ).rejects.toMatchObject({ code: 'E1003' });
  });
});
