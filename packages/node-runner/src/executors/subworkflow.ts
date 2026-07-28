import { resolveSubworkflowInputSchema, type WorkflowDefinition } from '@rxwf/workflow';
import type { WorkflowItem } from '@rxwf/shared';
import type { NodeExecutor } from '../types/node-executor.js';
import { buildSubworkflowPayload } from './build-subworkflow-payload.js';

const MAX_SUBWORKFLOW_DEPTH = 5;

export interface SubworkflowRunChildInput {
  workflowId: string;
  parentExecutionId: string;
  depth: number;
  inputItems: WorkflowItem[];
  /** Workflow Tool path: target must be published with settings.exposeAsTool. */
  requireExposeAsTool?: boolean;
  definitionSource?: 'draft' | 'published';
}

export interface SubworkflowRunChildResult {
  executionId: string;
  outputItems: WorkflowItem[];
}

export interface SubworkflowExecutorDeps {
  runChild(input: SubworkflowRunChildInput): Promise<SubworkflowRunChildResult>;
  loadPublishedWorkflowDefinition?: (
    workflowId: string,
  ) => Promise<WorkflowDefinition | null>;
}

export function createSubworkflowExecutor(deps: SubworkflowExecutorDeps): NodeExecutor {
  return {
    type: 'executeWorkflow',
    async execute(ctx) {
      const workflowId = String(ctx.config.workflowId ?? '');
      if (!workflowId) {
        return {
          status: 'failed',
          errorCode: 'E2003',
          errorMessage: 'executeWorkflow requires workflowId',
        };
      }
      const depth = ctx.subworkflowDepth ?? 0;
      if (depth >= MAX_SUBWORKFLOW_DEPTH) {
        return {
          status: 'failed',
          errorCode: 'E2008',
          errorMessage: 'Subworkflow nesting depth exceeded',
        };
      }
      const parentExecutionId = ctx.parentExecutionId ?? ctx.executionId ?? '';
      if (!parentExecutionId) {
        return {
          status: 'failed',
          errorCode: 'E2003',
          errorMessage: 'executeWorkflow requires parentExecutionId',
        };
      }
      try {
        let inputItems = ctx.inputItems;
        const mapping = ctx.config.inputMapping;
        const hasMapping =
          mapping &&
          typeof mapping === 'object' &&
          !Array.isArray(mapping) &&
          Object.keys(mapping as Record<string, unknown>).length > 0;
        const childDef = deps.loadPublishedWorkflowDefinition
          ? await deps.loadPublishedWorkflowDefinition(workflowId)
          : null;
        const childSchema = childDef ? resolveSubworkflowInputSchema(childDef) : null;
        if (hasMapping || (childSchema && childSchema.mode !== 'acceptAll')) {
          const sourceJson = ctx.inputItems[0]?.json ?? {};
          const payload = await buildSubworkflowPayload({
            llmArgs:
              typeof sourceJson === 'object' && sourceJson !== null
                ? (sourceJson as Record<string, unknown>)
                : {},
            inputMapping: mapping,
            childSchema,
            inputItems: ctx.inputItems,
            env: ctx.env,
            nodes: ctx.nodes,
            vars: ctx.vars,
          });
          inputItems = [{ json: payload }];
        }
        const child = await deps.runChild({
          workflowId,
          parentExecutionId,
          depth: depth + 1,
          inputItems,
        });
        return {
          status: 'success',
          outputItems: [child.outputItems],
        };
      } catch (err) {
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code: string }).code)
            : 'E2003';
        return {
          status: 'failed',
          errorCode: code,
          errorMessage: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}
