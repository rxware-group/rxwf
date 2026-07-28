import type { NodeOutputEntry } from '@rxwf/expression';
import type { WorkflowDefinition } from '@rxwf/workflow';
import type { AiStreamChunk } from '@rxwf/ai-runtime-stub';
import type { RunnerGatewayPort, RunnerRepositoryPort } from '@rxwf/providers-contracts';
import { getNodeRunnerRequirements } from '../node-runner-requirements.js';
import { AwfError } from '@rxwf/shared';
import {
  GLOBAL_DEFAULT_RUNNER_POLICY,
  type RunnerPolicy,
} from '@rxwf/workflow';
import {
  createRunnerDispatcher,
  type ResolveRunnerInput,
  type ResolveRunnerRequirements,
  type ResolvedRunner,
} from '../dispatch/runner-dispatcher.js';
import { createExecutorRegistry, type ExecutorRegistry } from '../registry/executor-registry.js';
import { registerBuiltinExecutors, type BuiltinExecutorDeps } from '../executors/register-builtin.js';
import { registerPlusExecutors, type PlusExecutorDeps } from '../executors/register-plus.js';
import type { NodeRunResult } from '../types/node-executor.js';
import { toRemoteJob } from './to-remote-job.js';

export interface NodeRunJob {
  executionId: string;
  nodeRunId: string;
  nodeType: string;
  nodeConfig: Record<string, unknown>;
  inputItems: import('@rxwf/shared').WorkflowItem[];
  workflowSettings: Record<string, unknown>;
  mode: 'production' | 'manual' | 'partial';
  inputBranches?: import('@rxwf/shared').WorkflowItem[][];
  errorPayload?: import('../types/node-executor.js').ErrorWorkflowPayload;
  parentExecutionId?: string;
  subworkflowDepth?: number;
  env?: Record<string, string>;
  vars?: Record<string, string>;
  nodes?: NodeOutputEntry[];
  workflowDefinition?: WorkflowDefinition;
  workflowId?: string;
  workflowVersionId?: string;
  executionEnvironment?: 'test' | 'prod';
  executionStartedAt?: string;
  sessionId?: string;
  onAgentStream?: (chunk: AiStreamChunk) => void;
  onSatelliteStream?: (
    satelliteNodeId: string,
    chunk: AiStreamChunk,
  ) => void;
  orchestrationResume?: import('../types/node-executor.js').OrchestrationResume;
  locale?: string;
  effectivePolicy?: RunnerPolicy;
  runnerRequirements?: ResolveRunnerRequirements;
}

export type FacadeNodeRunResult = NodeRunResult & {
  runnerId: string;
  runnerPlatform: { os: string; arch: string };
};

export interface ExecuteNodeRunOverrides {
  registry?: ExecutorRegistry;
  resolvedRunner?: ResolvedRunner;
  effectivePolicy?: RunnerPolicy;
  requirements?: ResolveRunnerRequirements;
}

export function createNodeRunnerFacade(deps: {
  runnerRepository: RunnerRepositoryPort;
  runnerGateway?: RunnerGatewayPort;
  registry?: ExecutorRegistry;
  builtinDeps?: BuiltinExecutorDeps;
  plusDeps?: PlusExecutorDeps;
}) {
  const dispatcher = createRunnerDispatcher({
    runnerRepository: deps.runnerRepository,
    runnerGateway: deps.runnerGateway,
  });
  const registry = deps.registry ?? createExecutorRegistry();
  if (!deps.registry) {
    registerBuiltinExecutors(registry, deps.builtinDeps);
    if (deps.plusDeps) {
      registerPlusExecutors(registry, deps.plusDeps);
    }
  }

  async function resolveEmbeddedRunner(): Promise<ResolvedRunner> {
    return dispatcher.resolve({ effectivePolicy: { mode: 'embedded' } });
  }

  async function executeEmbedded(
    job: NodeRunJob,
    resolved: ResolvedRunner,
    reg: ExecutorRegistry,
  ): Promise<FacadeNodeRunResult> {
    const result = await reg.execute(job.nodeType, {
      config: job.nodeConfig,
      env: job.env,
      vars: job.vars,
      nodes: job.nodes,
      inputItems: job.inputItems,
      inputBranches: job.inputBranches,
      errorPayload: job.errorPayload,
      parentExecutionId: job.parentExecutionId,
      subworkflowDepth: job.subworkflowDepth,
      executionId: job.executionId,
      executionMode: job.mode,
      executionEnvironment: job.executionEnvironment,
      executionStartedAt: job.executionStartedAt,
      workflowId: job.workflowId,
      workflowVersionId: job.workflowVersionId,
      nodeId: job.nodeRunId,
      sessionId: job.sessionId,
      workflowDefinition: job.workflowDefinition,
      onAgentStream: job.onAgentStream,
      onSatelliteStream: job.onSatelliteStream,
      orchestrationResume: job.orchestrationResume,
      locale: job.locale,
    });
    return {
      ...result,
      status: result.status,
      runnerId: resolved.id,
      runnerPlatform: {
        os: resolved.platform.os,
        arch: resolved.platform.arch,
      },
    };
  }

  return {
    resolveRunner(input: ResolveRunnerInput): Promise<ResolvedRunner> {
      return dispatcher.resolve(input);
    },

    async executeNodeRun(
      job: NodeRunJob,
      overrides?: ExecuteNodeRunOverrides,
    ): Promise<FacadeNodeRunResult> {
      const effectivePolicy =
        overrides?.effectivePolicy ??
        job.effectivePolicy ??
        GLOBAL_DEFAULT_RUNNER_POLICY;
      const requirements = overrides?.requirements ?? job.runnerRequirements;

      let resolved =
        overrides?.resolvedRunner ??
        (await dispatcher.resolve({ effectivePolicy, requirements }));

      if (resolved.kind === 'agent') {
        const remoteReqs =
          requirements ?? getNodeRunnerRequirements(job.nodeType);
        if (!remoteReqs?.capabilities?.length) {
          resolved = await resolveEmbeddedRunner();
        }
      }

      const reg = overrides?.registry ?? registry;

      if (resolved.kind === 'embedded') {
        return executeEmbedded(job, resolved, reg);
      }

      await deps.runnerRepository.incrementRunningJobs(resolved.id, +1);
      try {
        const remoteJob = await toRemoteJob(job, {
          resolveCredentialForAuth: deps.builtinDeps?.resolveCredentialForAuth,
        });
        const remoteResult = await deps.runnerGateway!.dispatchAndWait(
          resolved.id,
          remoteJob,
          { timeoutMs: remoteJob.timeoutMs },
        );
        return {
          status: remoteResult.status,
          outputItems: remoteResult.outputItems,
          errorCode: remoteResult.errorCode,
          errorMessage: remoteResult.errorMessage,
          metadata: remoteResult.metadata as NodeRunResult['metadata'],
          runnerId: resolved.id,
          runnerPlatform: {
            os: resolved.platform.os,
            arch: resolved.platform.arch,
          },
        };
      } finally {
        await deps.runnerRepository.incrementRunningJobs(resolved.id, -1);
      }
    },
  };
}
