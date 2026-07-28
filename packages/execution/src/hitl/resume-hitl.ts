import type { WorkflowItem } from '@rxwf/shared';
import type { WorkflowDefinition } from '@rxwf/workflow';
import { toWorkflowGraph } from '../graph/to-workflow-graph.js';
import type { ExecutionEngineDeps, RunExecutionResult } from '../engine/execution-engine.js';
import { createExecutionEngine } from '../engine/execution-engine.js';

export type HitlDecision = 'approve' | 'reject';

export interface HitlNodeRunRow {
  id: string;
  nodeId: string;
  nodeType: string;
  status: string;
  outputData: unknown[][] | null;
  metadata: Record<string, unknown> | null;
}

export function buildHitlDecisionOutput(
  decision: HitlDecision,
  inputItems: WorkflowItem[],
  options?: { comment?: string; supplement?: string },
): WorkflowItem[][] {
  return [
    [
      {
        json: {
          decision,
          approved: decision === 'approve',
          comment: options?.comment?.trim() ?? '',
          supplement: options?.supplement?.trim() ?? '',
          input: inputItems[0]?.json ?? {},
        },
      },
    ],
  ];
}

export function buildPrecomputedOutputsFromNodeRuns(
  nodeRuns: HitlNodeRunRow[],
): Map<string, WorkflowItem[][]> {
  const out = new Map<string, WorkflowItem[][]>();
  for (const nr of nodeRuns) {
    if (nr.status !== 'success' || !nr.outputData?.length) continue;
    out.set(nr.nodeId, nr.outputData as WorkflowItem[][]);
  }
  return out;
}

export interface ResumeHitlExecutionInput {
  executionId: string;
  definition: WorkflowDefinition;
  nodeRuns: HitlNodeRunRow[];
  waitingNodeId: string;
  decision: HitlDecision;
  comment?: string;
  supplement?: string;
  mode: 'production' | 'manual' | 'partial';
  workflowSettings?: Record<string, unknown>;
  env?: Record<string, string>;
  vars?: Record<string, string>;
  workflowId?: string;
  sessionId?: string;
}

export async function resumeHitlExecution(
  deps: ExecutionEngineDeps,
  input: ResumeHitlExecutionInput,
): Promise<RunExecutionResult & { rejectFailedNodeId?: string }> {
  const gateRun = input.nodeRuns.find((nr) => nr.nodeId === input.waitingNodeId);
  if (!gateRun) {
    throw new Error(`No node run for HITL gate node ${input.waitingNodeId}`);
  }

  const precomputedOutputs = buildPrecomputedOutputsFromNodeRuns(
    input.nodeRuns.filter((nr) => nr.nodeId !== input.waitingNodeId),
  );

  if (input.decision === 'reject') {
    const gateNode = input.definition.nodes.find((n) => n.id === input.waitingNodeId);
    const loopOnReject = gateNode?.parameters?.hitlLoopOnReject === true;

    if (loopOnReject) {
      const upstreamId = input.definition.connections.find(
        (c) => c.to === input.waitingNodeId,
      )?.from;
      if (upstreamId) {
        const supplementItems: WorkflowItem[] = input.supplement?.trim()
          ? [{ json: { supplement: input.supplement.trim(), hitlRetry: true } }]
          : [{ json: { hitlRetry: true } }];
        const loopPrecomputed = buildPrecomputedOutputsFromNodeRuns(
          input.nodeRuns.filter(
            (nr) => nr.nodeId !== input.waitingNodeId && nr.nodeId !== upstreamId,
          ),
        );
        const { graph, startNodeId } = toWorkflowGraph(input.definition);
        const engine = createExecutionEngine(deps);
        const continued = await engine.run({
          executionId: input.executionId,
          graph,
          startNodeId: upstreamId,
          initialItems: supplementItems,
          mode: input.mode,
          workflowSettings: input.workflowSettings,
          env: input.env,
          vars: input.vars,
          workflowDefinition: input.definition,
          workflowId: input.workflowId,
          sessionId: input.sessionId,
          precomputedOutputs: loopPrecomputed,
        });
        return continued;
      }
    }

    precomputedOutputs.set(
      input.waitingNodeId,
      buildHitlDecisionOutput('reject', [], {
        comment: input.comment,
        supplement: input.supplement,
      }),
    );
    return {
      status: 'failed',
      failedNodeId: input.waitingNodeId,
      rejectFailedNodeId: input.waitingNodeId,
    };
  }

  precomputedOutputs.set(
    input.waitingNodeId,
    buildHitlDecisionOutput('approve', [], {
      comment: input.comment,
      supplement: input.supplement,
    }),
  );

  const { graph, startNodeId } = toWorkflowGraph(input.definition);
  const engine = createExecutionEngine(deps);
  return engine.run({
    executionId: input.executionId,
    graph,
    startNodeId,
    initialItems: [{ json: {} }],
    mode: input.mode,
    workflowSettings: input.workflowSettings,
    env: input.env,
    vars: input.vars,
    workflowDefinition: input.definition,
    workflowId: input.workflowId,
    sessionId: input.sessionId,
    precomputedOutputs,
  });
}
