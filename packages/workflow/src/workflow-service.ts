import { AwfError } from '@rxwf/shared';
import {
  validateWorkflowDefinition,
  type ValidateOptions,
  type WorkflowDefinition,
} from './validate.js';
import { nextSemverLabel } from './semver.js';
import {
  validateToolWorkflowTarget,
  type ToolWorkflowTargetInfo,
} from './tool-workflow-target.js';
import {
  findSubworkflowTriggerNode,
  hasInputMappingOverride,
  resolveSubworkflowInputSchema,
} from './subworkflow-trigger-schema.js';
import { getWorkflowKind, type WorkflowKind } from './workflow-kind.js';

export type { WorkflowDefinition } from './validate.js';

export interface WorkflowVersionRow {
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
}

export interface WorkflowPublishedVersionSummary {
  id: string;
  version: number;
  semverLabel: string;
  publishNote: string | null;
  publishedAt: Date;
  publishedByUserId: string | null;
  publishedByEmail: string | null;
  isCurrent: boolean;
}

export interface WorkflowRepositoryPort {
  insertWorkflow(row: {
    id: string;
    name: string;
    description?: string;
    status: string;
    publishedVersionId?: string | null;
    publishedAt?: Date | null;
    createdByUserId?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<void>;
  insertVersion(row: {
    id: string;
    workflowId: string;
    version: number;
    definition: string;
    semverLabel: string;
    changeNote?: string | null;
    publishedAt?: Date | null;
    publishedByUserId?: string | null;
    publishNote?: string | null;
    createdAt: Date;
  }): Promise<void>;
  updateWorkflow(row: {
    id: string;
    name: string;
    description?: string;
    status: string;
    publishedVersionId?: string | null;
    publishedAt?: Date | null;
    updatedAt: Date;
  }): Promise<void>;
  findByName(name: string): Promise<{ id: string } | null>;
  getWorkflow(
    id: string,
  ): Promise<{
    id: string;
    name: string;
    description: string;
    status: string;
    publishedVersionId: string | null;
    publishedAt: Date | null;
    createdByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null>;
  getDraftVersion(workflowId: string): Promise<WorkflowVersionRow | null>;
  updateDraftVersion(workflowId: string, definition: string): Promise<boolean>;
  getVersionById(versionId: string): Promise<WorkflowVersionRow | null>;
  getPublishedVersion(
    workflowId: string,
    version: number,
  ): Promise<WorkflowVersionRow | null>;
  getNextPublishedVersionNumber(workflowId: string): Promise<number>;
  listPublishedVersions(workflowId: string): Promise<WorkflowPublishedVersionSummary[]>;
  appendPublishLog(input: {
    id: string;
    workflowId: string;
    versionId: string | null;
    action: string;
    detail: Record<string, unknown>;
    userId: string;
  }): Promise<void>;
  listWorkflows(options?: { ids?: string[] }): Promise<
    Array<{
      id: string;
      name: string;
      description: string;
      status: string;
      publishedVersionId: string | null;
      createdAt: Date;
      updatedAt: Date;
      createdByUserId: string | null;
      createdByEmail: string | null;
      createdByNickname: string | null;
    }>
  >;
  deleteWorkflow(workflowId: string): Promise<boolean>;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  status: string;
  version: number;
  semverLabel: string;
  createdAt: Date;
  updatedAt: Date;
  createdByEmail?: string | null;
  createdByNickname?: string | null;
  workflowKind?: WorkflowKind;
}

export interface WorkflowDetail extends WorkflowSummary {
  definition: WorkflowDefinition;
  publishedVersion: number | null;
  publishedSemverLabel: string | null;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
}

export interface WorkflowServiceOptions {
  validateOptions?: ValidateOptions;
}

function assertValid(
  definition: WorkflowDefinition,
  validateOptions: ValidateOptions = {},
): void {
  const result = validateWorkflowDefinition(definition, validateOptions);
  if (!result.ok) {
    const first = result.errors[0];
    throw new AwfError(first?.code ?? 'E1003', first?.message ?? 'Invalid workflow');
  }
}

function stripLegacyActive(definition: WorkflowDefinition): WorkflowDefinition {
  const { active: _active, ...rest } = definition as WorkflowDefinition & {
    active?: boolean;
  };
  return rest;
}

function normalizeDefinitionJson(definition: WorkflowDefinition): string {
  return JSON.stringify(stripLegacyActive(definition));
}

function definitionsEqual(a: WorkflowDefinition, b: WorkflowDefinition): boolean {
  return normalizeDefinitionJson(a) === normalizeDefinitionJson(b);
}

function normalizeWorkflowName(name: string): string {
  return name.trim();
}

async function assertNameAvailable(
  repo: WorkflowRepositoryPort,
  name: string,
  excludeWorkflowId?: string,
): Promise<void> {
  const normalized = normalizeWorkflowName(name);
  if (!normalized) {
    throw new AwfError('E1001', 'Workflow name is required');
  }
  const existing = await repo.findByName(normalized);
  if (existing && existing.id !== excludeWorkflowId) {
    throw new AwfError('E1040', `Workflow name already exists: ${normalized}`);
  }
}

export function createWorkflowService(
  repo: WorkflowRepositoryPort,
  options: WorkflowServiceOptions = {},
) {
  const validateOptions = options.validateOptions ?? {};
  return {
    async create(input: {
      name: string;
      description?: string | null;
      definition: WorkflowDefinition;
      createdByUserId?: string | null;
    }): Promise<{ id: string }> {
      const name = normalizeWorkflowName(input.name);
      await assertNameAvailable(repo, name);
      assertValid(input.definition, validateOptions);
      const id = crypto.randomUUID();
      const versionId = crypto.randomUUID();
      const now = new Date();
      const description = input.description?.trim() ?? '';
      const definition: WorkflowDefinition = stripLegacyActive({
        ...input.definition,
        name,
      });
      await repo.insertWorkflow({
        id,
        name,
        description,
        status: 'draft',
        publishedVersionId: null,
        publishedAt: null,
        createdByUserId: input.createdByUserId ?? null,
        createdAt: now,
        updatedAt: now,
      });
      await repo.insertVersion({
        id: versionId,
        workflowId: id,
        version: 0,
        definition: JSON.stringify(definition),
        semverLabel: '1.0.0',
        changeNote: null,
        publishedAt: null,
        createdAt: now,
      });
      return { id };
    },

    async update(
      workflowId: string,
      definition: WorkflowDefinition,
    ): Promise<{ id: string }> {
      const existing = await repo.getWorkflow(workflowId);
      if (!existing) {
        throw new AwfError('E1001', `Workflow not found: ${workflowId}`);
      }
      assertValid(definition, validateOptions);
      const draft = await repo.getDraftVersion(workflowId);
      if (!draft) {
        throw new AwfError('E1001', `Draft version not found: ${workflowId}`);
      }
      const merged: WorkflowDefinition = stripLegacyActive({
        ...definition,
        name: definition.name ? normalizeWorkflowName(definition.name) : existing.name,
      });
      if (merged.name !== existing.name) {
        await assertNameAvailable(repo, merged.name, workflowId);
      }
      const now = new Date();
      const ok = await repo.updateDraftVersion(workflowId, normalizeDefinitionJson(merged));
      if (!ok) {
        throw new AwfError('E1001', `Draft version not found: ${workflowId}`);
      }
      await repo.updateWorkflow({
        id: workflowId,
        name: merged.name,
        description: existing.description,
        status: existing.status,
        publishedVersionId: existing.publishedVersionId,
        publishedAt: existing.publishedAt,
        updatedAt: now,
      });
      return { id: workflowId };
    },

    async updateMeta(
      workflowId: string,
      input: { name: string; description?: string | null },
    ): Promise<{ id: string }> {
      const name = normalizeWorkflowName(input.name);
      await assertNameAvailable(repo, name, workflowId);
      const existing = await repo.getWorkflow(workflowId);
      if (!existing) {
        throw new AwfError('E1001', `Workflow not found: ${workflowId}`);
      }
      const draft = await repo.getDraftVersion(workflowId);
      if (!draft) {
        throw new AwfError('E1001', `Draft version not found: ${workflowId}`);
      }
      const definition = JSON.parse(draft.definition) as WorkflowDefinition;
      const merged: WorkflowDefinition = stripLegacyActive({
        ...definition,
        name,
      });
      assertValid(merged, validateOptions);
      const now = new Date();
      const description = input.description?.trim() ?? '';
      const ok = await repo.updateDraftVersion(workflowId, normalizeDefinitionJson(merged));
      if (!ok) {
        throw new AwfError('E1001', `Draft version not found: ${workflowId}`);
      }
      await repo.updateWorkflow({
        id: workflowId,
        name,
        description,
        status: existing.status,
        publishedVersionId: existing.publishedVersionId,
        publishedAt: existing.publishedAt,
        updatedAt: now,
      });
      return { id: workflowId };
    },

    async publish(
      workflowId: string,
      userId: string,
      publishNote?: string,
    ): Promise<{
      id: string;
      status: 'published';
      version: number;
      semverLabel: string;
    }> {
      const existing = await repo.getWorkflow(workflowId);
      if (!existing) {
        throw new AwfError('E1001', `Workflow not found: ${workflowId}`);
      }
      const draft = await repo.getDraftVersion(workflowId);
      if (!draft) {
        throw new AwfError('E1010', 'No draft to publish');
      }
      const definition = JSON.parse(draft.definition) as WorkflowDefinition;
      assertValid(definition, validateOptions);
      const published = await repo.listPublishedVersions(workflowId);
      const lastSemver = published[0]?.semverLabel ?? '0.0.0';
      const semverLabel =
        published.length === 0 ? '1.0.0' : nextSemverLabel(lastSemver);
      const versionNum = await repo.getNextPublishedVersionNumber(workflowId);
      const now = new Date();
      const versionId = crypto.randomUUID();
      await repo.insertVersion({
        id: versionId,
        workflowId,
        version: versionNum,
        definition: draft.definition,
        semverLabel,
        changeNote: null,
        publishedAt: now,
        publishedByUserId: userId,
        publishNote: publishNote?.trim() || null,
        createdAt: now,
      });
      await repo.updateWorkflow({
        id: workflowId,
        name: existing.name,
        description: existing.description,
        status: 'published',
        publishedVersionId: versionId,
        publishedAt: now,
        updatedAt: now,
      });
      await repo.appendPublishLog({
        id: crypto.randomUUID(),
        workflowId,
        versionId,
        action: 'published',
        detail: { version: versionNum, semverLabel, publishNote: publishNote?.trim() || null },
        userId,
      });
      return {
        id: workflowId,
        status: 'published',
        version: versionNum,
        semverLabel,
      };
    },

    async unpublish(workflowId: string, userId: string): Promise<{ id: string; status: 'draft' }> {
      const existing = await repo.getWorkflow(workflowId);
      if (!existing) {
        throw new AwfError('E1001', `Workflow not found: ${workflowId}`);
      }
      if (existing.status !== 'published') {
        return { id: workflowId, status: 'draft' };
      }
      const now = new Date();
      await repo.updateWorkflow({
        id: workflowId,
        name: existing.name,
        description: existing.description,
        status: 'draft',
        publishedVersionId: existing.publishedVersionId,
        publishedAt: existing.publishedAt,
        updatedAt: now,
      });
      await repo.appendPublishLog({
        id: crypto.randomUUID(),
        workflowId,
        versionId: existing.publishedVersionId,
        action: 'unpublished',
        detail: {},
        userId,
      });
      return { id: workflowId, status: 'draft' };
    },

    async get(workflowId: string): Promise<WorkflowDetail | null> {
      const row = await repo.getWorkflow(workflowId);
      const draft = await repo.getDraftVersion(workflowId);
      if (!row || !draft) return null;

      let publishedVersion: number | null = null;
      let publishedSemverLabel: string | null = null;
      let publishedDefinition: WorkflowDefinition | null = null;
      if (row.publishedVersionId) {
        const published = await repo.getVersionById(row.publishedVersionId);
        if (published) {
          publishedVersion = published.version;
          publishedSemverLabel = published.semverLabel;
          publishedDefinition = JSON.parse(published.definition) as WorkflowDefinition;
        }
      }

      const draftDefinition = JSON.parse(draft.definition) as WorkflowDefinition;
      const isPublished = row.status === 'published';
      const hasUnpublishedChanges =
        isPublished &&
        publishedDefinition !== null &&
        !definitionsEqual(draftDefinition, publishedDefinition);

      const publishedList = await repo.listPublishedVersions(workflowId);
      const currentPublished = publishedList.find((v) => v.isCurrent);

      return {
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        version: currentPublished?.version ?? 0,
        semverLabel: currentPublished?.semverLabel ?? '1.0.0',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        definition: draftDefinition,
        publishedVersion,
        publishedSemverLabel,
        publishedAt: row.publishedAt?.toISOString() ?? null,
        hasUnpublishedChanges,
      };
    },

    async getMeta(
      workflowId: string,
    ): Promise<{ createdByUserId: string | null } | null> {
      const row = await repo.getWorkflow(workflowId);
      if (!row) return null;
      return { createdByUserId: row.createdByUserId };
    },

    async list(options?: {
      ids?: string[];
      kind?: WorkflowKind;
    }): Promise<WorkflowSummary[]> {
      if (options?.ids !== undefined && options.ids.length === 0) {
        return [];
      }
      const rows = await repo.listWorkflows(
        options?.ids ? { ids: options.ids } : undefined,
      );
      const summaries: WorkflowSummary[] = [];
      for (const row of rows) {
        const draft = await repo.getDraftVersion(row.id);
        if (!draft) continue;
        const def = JSON.parse(draft.definition) as WorkflowDefinition;
        const kind = getWorkflowKind(def);
        if (options?.kind && kind !== options.kind) continue;
        const published = await repo.listPublishedVersions(row.id);
        const current = published.find((v) => v.isCurrent);
        summaries.push({
          id: row.id,
          name: row.name,
          description: row.description,
          status: row.status,
          version: current?.version ?? 0,
          semverLabel: current?.semverLabel ?? '1.0.0',
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          createdByEmail: row.createdByEmail,
          createdByNickname: row.createdByNickname,
          workflowKind: kind,
        });
      }
      return summaries;
    },

    async listPublishedVersions(workflowId: string): Promise<WorkflowPublishedVersionSummary[]> {
      const existing = await repo.getWorkflow(workflowId);
      if (!existing) {
        throw new AwfError('E1001', `Workflow not found: ${workflowId}`);
      }
      return repo.listPublishedVersions(workflowId);
    },

    async getPublishedVersionDefinition(
      workflowId: string,
      version: number,
    ): Promise<WorkflowDefinition> {
      const row = await repo.getPublishedVersion(workflowId, version);
      if (!row) {
        throw new AwfError(
          'E1001',
          `Published version not found: ${workflowId} v${version}`,
        );
      }
      return JSON.parse(row.definition) as WorkflowDefinition;
    },

    async rollbackPublish(
      workflowId: string,
      version: number,
      userId: string,
    ): Promise<{ id: string; version: number; semverLabel: string }> {
      const existing = await repo.getWorkflow(workflowId);
      if (!existing) {
        throw new AwfError('E1001', `Workflow not found: ${workflowId}`);
      }
      const target = await repo.getPublishedVersion(workflowId, version);
      if (!target || !target.publishedAt) {
        throw new AwfError(
          'E1001',
          `Published version not found: ${workflowId} v${version}`,
        );
      }
      const now = new Date();
      await repo.updateWorkflow({
        id: workflowId,
        name: existing.name,
        description: existing.description,
        status: 'published',
        publishedVersionId: target.id,
        publishedAt: now,
        updatedAt: now,
      });
      await repo.appendPublishLog({
        id: crypto.randomUUID(),
        workflowId,
        versionId: target.id,
        action: 'rollback_published',
        detail: { version, semverLabel: target.semverLabel },
        userId,
      });
      return { id: workflowId, version: target.version, semverLabel: target.semverLabel };
    },

    async restoreDraftFromPublished(
      workflowId: string,
      version: number,
      userId: string,
    ): Promise<{ id: string }> {
      const existing = await repo.getWorkflow(workflowId);
      if (!existing) {
        throw new AwfError('E1001', `Workflow not found: ${workflowId}`);
      }
      const target = await repo.getPublishedVersion(workflowId, version);
      if (!target || !target.publishedAt) {
        throw new AwfError(
          'E1001',
          `Published version not found: ${workflowId} v${version}`,
        );
      }
      const ok = await repo.updateDraftVersion(workflowId, target.definition);
      if (!ok) {
        throw new AwfError('E1001', `Draft version not found: ${workflowId}`);
      }
      const now = new Date();
      await repo.updateWorkflow({
        id: workflowId,
        name: existing.name,
        description: existing.description,
        status: existing.status,
        publishedVersionId: existing.publishedVersionId,
        publishedAt: existing.publishedAt,
        updatedAt: now,
      });
      await repo.appendPublishLog({
        id: crypto.randomUUID(),
        workflowId,
        versionId: target.id,
        action: 'restored_draft',
        detail: { version, semverLabel: target.semverLabel },
        userId,
      });
      return { id: workflowId };
    },

    async remove(workflowId: string): Promise<void> {
      const deleted = await repo.deleteWorkflow(workflowId);
      if (!deleted) {
        throw new AwfError('E1001', `Workflow not found: ${workflowId}`);
      }
    },

    async getPublishedDefinition(workflowId: string): Promise<WorkflowDefinition | null> {
      const row = await repo.getWorkflow(workflowId);
      if (!row || row.status !== 'published' || !row.publishedVersionId) {
        return null;
      }
      const publishedVer = await repo.getVersionById(row.publishedVersionId);
      if (!publishedVer) return null;
      return JSON.parse(publishedVer.definition) as WorkflowDefinition;
    },

    async resolveToolWorkflowTarget(
      workflowId: string,
    ): Promise<ToolWorkflowTargetInfo> {
      const row = await repo.getWorkflow(workflowId);
      if (!row) {
        return { exists: false, published: false, exposeAsTool: false };
      }
      if (row.status !== 'published' || !row.publishedVersionId) {
        return { exists: true, published: false, exposeAsTool: false };
      }
      const publishedVer = await repo.getVersionById(row.publishedVersionId);
      if (!publishedVer) {
        return { exists: true, published: false, exposeAsTool: false };
      }
      const def = JSON.parse(publishedVer.definition) as WorkflowDefinition;
      return {
        exists: true,
        published: true,
        exposeAsTool: Boolean(def.settings?.exposeAsTool),
      };
    },

    async validateToolWorkflowNodes(definition: WorkflowDefinition) {
      const base = validateWorkflowDefinition(definition, validateOptions);
      const errors = [...(base.ok ? [] : base.errors)];
      const warnings = [...base.warnings];
      for (const node of definition.nodes) {
        if (node.type !== 'toolWorkflow') continue;
        const targetId = String(node.parameters.workflowId ?? '').trim();
        if (!targetId) {
          errors.push({
            code: 'E1001',
            message: 'toolWorkflow requires workflowId',
            nodeId: node.id,
          });
          continue;
        }
        const target = await this.resolveToolWorkflowTarget(targetId);
        const err = validateToolWorkflowTarget(target, node.id);
        if (err) {
          errors.push(err);
          continue;
        }
        const childDef = await this.getPublishedDefinition(targetId);
        if (!childDef || !findSubworkflowTriggerNode(childDef)) {
          errors.push({
            code: 'E1055',
            message: 'Workflow Tool target must define a subworkflowTrigger',
            nodeId: node.id,
          });
          continue;
        }
        const childSchema = resolveSubworkflowInputSchema(childDef);
        if (childSchema?.mode === 'acceptAll') {
          warnings.push({
            code: 'W1016',
            message: 'Agent Tool child workflow uses acceptAll input mode',
            nodeId: node.id,
          });
        }
        if (hasInputMappingOverride(node.parameters)) {
          const mappingKeys = Object.keys(
            (node.parameters.inputMapping ?? {}) as Record<string, unknown>,
          );
          const schemaKeys = new Set(childSchema?.fields.map((f) => f.name) ?? []);
          for (const key of mappingKeys) {
            if (key === '_payload') continue;
            if (childSchema?.mode !== 'acceptAll' && !schemaKeys.has(key)) {
              warnings.push({
                code: 'W1017',
                message: `toolWorkflow inputMapping key not in child schema: ${key}`,
                nodeId: node.id,
              });
            }
          }
        }
      }

      for (const node of definition.nodes) {
        if (node.type !== 'executeWorkflow') continue;
        const targetId = String(node.parameters.workflowId ?? '').trim();
        if (!targetId) continue;
        const childDef = await this.getPublishedDefinition(targetId);
        if (!childDef) {
          errors.push({
            code: 'E1053',
            message: 'executeWorkflow target workflow is not published',
            nodeId: node.id,
          });
          continue;
        }
        if (!findSubworkflowTriggerNode(childDef)) {
          warnings.push({
            code: 'W1015',
            message: 'executeWorkflow target has no subworkflowTrigger; input may not pass through',
            nodeId: node.id,
          });
        }
      }

      if (errors.length > 0) {
        return { ok: false as const, errors, warnings };
      }
      return { ok: true as const, warnings };
    },

    async listExposedAsTools(options?: {
      ids?: string[];
    }): Promise<WorkflowSummary[]> {
      const summaries = await this.list(options);
      const out: WorkflowSummary[] = [];
      for (const s of summaries) {
        const info = await this.resolveToolWorkflowTarget(s.id);
        if (info.published && info.exposeAsTool) out.push(s);
      }
      return out;
    },

    validate(definition: WorkflowDefinition) {
      return validateWorkflowDefinition(definition, validateOptions);
    },
  };
}
