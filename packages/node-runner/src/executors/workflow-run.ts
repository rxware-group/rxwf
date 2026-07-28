import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  WorkflowCompiler,
  assertWorkflowsEnabled,
  parseAntigravityWorkflowYaml,
} from '@rxwf/skill-runtime';
import { AwfError } from '@rxwf/shared';
import type { NodeExecutionContext, NodeRunResult } from '../types/node-executor.js';
import type { PlusExecutorDeps } from './register-plus.js';
import type { WorkflowDefinition } from '@rxwf/workflow';

export function createWorkflowRunExecutor(deps: PlusExecutorDeps) {
  return {
    type: 'workflow_run',
    async execute(ctx: NodeExecutionContext): Promise<NodeRunResult> {
      const params = ctx.config;
      const workspaceRoot = String(params.workspaceRoot ?? process.cwd()).trim();
      const source = String(params.workflowSource ?? 'template');

      if (source === 'published') {
        const workflowId = String(params.workflowId ?? '').trim();
        if (!workflowId) {
          throw new AwfError('E1076', 'workflow_run published source requires workflowId');
        }
        if (!deps.runSubworkflow || !ctx.parentExecutionId) {
          throw new AwfError('E2003', 'workflow_run published requires subworkflow runtime');
        }
        const child = await deps.runSubworkflow({
          workflowId,
          parentExecutionId: ctx.parentExecutionId,
          depth: (ctx.subworkflowDepth ?? 0) + 1,
          inputItems: ctx.inputItems,
          requireExposeAsTool: false,
        });
        return {
          status: 'success',
          outputItems: [
            [
              {
                json: {
                  items: child.outputItems,
                  childExecutionId: child.executionId,
                  workflowId,
                },
              },
            ],
          ],
        };
      }

      const relPath = String(params.workflowRelPath ?? '').trim();
      if (!relPath) {
        throw new AwfError('E1076', 'workflow_run template source requires workflowRelPath');
      }

      await assertWorkflowsEnabled(workspaceRoot);

      const filePath = join(
        workspaceRoot,
        '.rxwf',
        'workflows',
        relPath.endsWith('.workflow.yaml') || relPath.endsWith('.workflow.yml')
          ? relPath
          : `${relPath}.workflow.yaml`,
      );

      let raw: string;
      try {
        raw = await readFile(filePath, 'utf8');
      } catch {
        throw new AwfError('E1073', `Workflow template not found: ${filePath}`);
      }

      const ir = parseAntigravityWorkflowYaml(raw);
      const compiled = new WorkflowCompiler().compile(ir, {
        compileMode: 'linear_skillRun',
        workspaceRootTemplate: workspaceRoot,
      });

      const definition: WorkflowDefinition = {
        schemaVersion: 1,
        name: compiled.name,
        nodes: compiled.nodes as WorkflowDefinition['nodes'],
        connections: compiled.connections,
        settings: ctx.workflowDefinition?.settings,
      };

      if (!deps.runCompiledWorkflow || !ctx.parentExecutionId) {
        return {
          status: 'success',
          outputItems: [
            [
              {
                json: {
                  compiled: true,
                  nodeCount: definition.nodes.length,
                  meta: compiled.meta,
                  note: 'runCompiledWorkflow not configured; definition only materialized',
                },
              },
            ],
          ],
        };
      }

      const child = await deps.runCompiledWorkflow({
        definition,
        parentExecutionId: ctx.parentExecutionId,
        depth: (ctx.subworkflowDepth ?? 0) + 1,
        inputItems: ctx.inputItems,
        definitionSource: 'draft',
      });

      return {
        status: 'success',
        outputItems: [
          [
            {
              json: {
                items: child.outputItems,
                childExecutionId: child.executionId,
                templateId: ir.id,
                pendingHitlLoop: compiled.meta?.pendingHitlLoop,
              },
            },
          ],
        ],
      };
    },
  };
}
