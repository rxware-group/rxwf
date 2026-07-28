import type { WorkflowItem } from '@rxwf/shared';
import type { WorkflowDefinition } from '@rxwf/workflow';
import { toWorkflowGraph } from '../graph/to-workflow-graph.js';
import {
  createExecutionEngine,
  type ExecutionEngineDeps,
  type RunExecutionResult,
} from '../engine/execution-engine.js';
import { buildPrecomputedOutputsFromNodeRuns } from './resume-hitl.js';

export interface GroupChatWaitingNodeRun {
  id: string;
  nodeId: string;
  nodeType: string;
  status: string;
  outputData: unknown[][] | null;
  metadata: Record<string, unknown> | null;
  durationMs?: number | null;
}

export interface ResumeGroupChatAfterUserInputInput {
  executionId: string;
  definition: WorkflowDefinition;
  nodeRuns: GroupChatWaitingNodeRun[];
  waitingNodeRun: GroupChatWaitingNodeRun;
  supplement?: string;
  mode: 'production' | 'manual' | 'partial';
  workflowSettings?: Record<string, unknown>;
  env?: Record<string, string>;
  vars?: Record<string, string>;
  workflowId?: string;
  sessionId?: string;
  inputItems: WorkflowItem[];
  executeGroupChat: (input: {
    nodeConfig: Record<string, unknown>;
    orchestrationResume: {
      kind: 'groupChat';
      checkpoint: Record<string, unknown>;
      userMessage: string;
    };
  }) => Promise<{
    status: 'success' | 'failed' | 'waiting';
    outputItems?: WorkflowItem[][];
    metadata?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
  }>;
}

export async function resumeGroupChatAfterUserInput(
  deps: ExecutionEngineDeps,
  input: ResumeGroupChatAfterUserInputInput,
): Promise<
  RunExecutionResult & {
    groupChatStatus?: 'waiting' | 'failed' | 'continued';
  }
> {
  const checkpoint = (
    input.waitingNodeRun.metadata?.groupChat as
      | { checkpoint?: Record<string, unknown> }
      | undefined
  )?.checkpoint;
  if (!checkpoint) {
    throw new Error('E1051: Group chat checkpoint missing or corrupt');
  }

  const gcNode = input.definition.nodes.find(
    (n) => n.id === input.waitingNodeRun.nodeId,
  );
  if (!gcNode || gcNode.type !== 'groupChat') {
    throw new Error('E1051: Group chat node not found for resume');
  }

  const gcResult = await input.executeGroupChat({
    nodeConfig: gcNode.parameters,
    orchestrationResume: {
      kind: 'groupChat',
      checkpoint,
      userMessage: input.supplement?.trim() ?? '',
    },
  });

  if (gcResult.status === 'waiting') {
    return {
      status: 'waiting',
      waitingNodeId: input.waitingNodeRun.nodeId,
      groupChatStatus: 'waiting',
    };
  }

  if (gcResult.status === 'failed') {
    return {
      status: 'failed',
      failedNodeId: input.waitingNodeRun.nodeId,
      groupChatStatus: 'failed',
    };
  }

  const precomputedOutputs = buildPrecomputedOutputsFromNodeRuns(
    input.nodeRuns
      .filter((nr) => nr.nodeId !== input.waitingNodeRun.nodeId)
      .map((nr) => ({
        id: nr.id,
        nodeId: nr.nodeId,
        nodeType: nr.nodeType,
        status: nr.status,
        outputData: nr.outputData,
        metadata: nr.metadata,
      })),
  );
  precomputedOutputs.set(
    input.waitingNodeRun.nodeId,
    gcResult.outputItems ?? [[{ json: {} }]],
  );

  const { graph, startNodeId } = toWorkflowGraph(input.definition);
  const engine = createExecutionEngine(deps);
  const result = await engine.run({
    executionId: input.executionId,
    graph,
    startNodeId,
    initialItems: input.inputItems,
    mode: input.mode,
    workflowSettings: input.workflowSettings,
    env: input.env,
    vars: input.vars,
    workflowDefinition: input.definition,
    workflowId: input.workflowId,
    sessionId: input.sessionId,
    precomputedOutputs,
  });

  return { ...result, groupChatStatus: 'continued' };
}
