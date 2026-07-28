import { AwfError } from '@rxwf/shared';
import type { WorkflowDefinition } from '@rxwf/workflow';
import { createExecutionSnapshot } from '../snapshot/create-execution-snapshot.js';

export type ExecutionTriggerType =
  | 'manual'
  | 'webhook'
  | 'schedule'
  | 'api'
  | 'mcp'
  | 'subworkflow'
  | 'error';

export type ExecutionEnvironment = 'test' | 'prod';

export interface EnqueueExecutionInput {
  workflowId: string;
  triggerType: ExecutionTriggerType;
  mode?: 'production' | 'manual' | 'partial';
  environment?: ExecutionEnvironment;
  idempotencyKey?: string;
  definitionSource?: 'draft' | 'published';
  sessionId?: string;
}

export interface EnqueueExecutionResult {
  executionId: string;
  status: 'queued';
  version: number;
}

export interface ExecutionEnqueueDeps {
  loadWorkflow(
    workflowId: string,
    source?: 'draft' | 'published',
  ): Promise<{
    workflowId: string;
    workflowVersionId: string;
    version: number;
    status: string;
    definition: WorkflowDefinition;
  } | null>;
  insertExecution(record: {
    id: string;
    traceId: string;
    workflowId: string;
    workflowVersionId: string;
    definitionSnapshot: string;
    version: number;
    status: string;
    mode: string;
    environment: string;
    idempotencyKey?: string;
    sessionId?: string;
  }): Promise<void>;
}

export function createExecutionEnqueueService(deps: ExecutionEnqueueDeps) {
  return {
    async enqueue(input: EnqueueExecutionInput): Promise<EnqueueExecutionResult> {
      const mode = input.mode ?? 'production';
      const definitionSource =
        input.definitionSource ?? (mode === 'production' ? 'published' : 'draft');
      const loaded = await deps.loadWorkflow(input.workflowId, definitionSource);
      if (!loaded) {
        throw new AwfError('E1001', `Workflow not found: ${input.workflowId}`);
      }

      if (mode === 'production' && loaded.status !== 'published') {
        throw new AwfError('E2001', 'Workflow is not published');
      }

      const snapshot = createExecutionSnapshot({
        workflowId: loaded.workflowId,
        workflowVersionId: loaded.workflowVersionId,
        definition: {
          nodes: loaded.definition.nodes,
          edges: loaded.definition.connections,
          settings: loaded.definition.settings,
        },
        triggerType: input.triggerType,
      });

      const definitionSnapshot = JSON.stringify({
        schemaVersion: loaded.definition.schemaVersion,
        name: loaded.definition.name,
        version: loaded.version,
        nodes: loaded.definition.nodes,
        connections: loaded.definition.connections,
        settings: loaded.definition.settings,
        trigger_type: snapshot.trigger_type,
      });

      const executionId = crypto.randomUUID();
      await deps.insertExecution({
        id: executionId,
        traceId: crypto.randomUUID(),
        workflowId: loaded.workflowId,
        workflowVersionId: loaded.workflowVersionId,
        definitionSnapshot,
        version: loaded.version,
        status: 'queued',
        mode,
        environment:
          input.environment ?? (mode === 'manual' ? 'test' : 'prod'),
        idempotencyKey: input.idempotencyKey,
        sessionId: input.sessionId,
      });

      return {
        executionId,
        status: 'queued',
        version: loaded.version,
      };
    },
  };
}
