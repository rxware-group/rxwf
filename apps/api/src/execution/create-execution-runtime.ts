import {
  createExecutionEnqueueService,
  createExecutionRunner,
  createJobProcessor,
  executionEnqueueHandler,
  planPartialExecution,
  runDebugExecution,
  toWorkflowGraph,
  buildHitlDecisionOutput,
  buildPrecomputedOutputsFromNodeRuns,
  createExecutionEngine,
  resumeHitlExecution,
  type ExecutionEnqueueJobPayload,
  type JobHandler,
  resolveErrorPayloadFromEnqueue,
  webhookIdempotencyScope,
} from '@rxwf/execution';
import {
  validateToolWorkflowTarget,
  type WorkflowDefinition,
} from '@rxwf/workflow';
import {
  createNodeRunnerFacade,
  createAgentStepsAccumulator,
  shouldPersistAgentSteps,
} from '@rxwf/node-runner';
import { createLangChainAiRuntime } from '@rxwf/ai-runtime';
import type { LiteDatabase } from '@rxwf/providers-lite';
import {
  loadResolvedEnv,
  normalizeStoredEnvironment,
} from '@rxwf/env';
import { loadResolvedVars } from '@rxwf/variables';
import { createCredentialService } from '@rxwf/credential';
import {
  createLiteEnvRepository,
  createLiteVariablesRepository,
  createLiteExecutionRepository,
  createLiteIdempotencyService,
  createLiteJobQueue,
  createLiteNodeRunRepository,
  createLiteRunnerRepository,
  createLiteSkillRepository,
  createLiteWorkflowLoader,
  createLiteWorkflowRepository,
  createLiteBinaryBlobService,
  type LiteBinaryBlobService,
} from '@rxwf/providers-lite';
import { createWorkflowService } from '@rxwf/workflow';
import {
  createStandardEnvRepository,
  createStandardVariablesRepository,
  createStandardExecutionRepository,
  createStandardWorkflowLoader,
  createStandardWorkflowRepository,
  createBullMQQueueProvider,
} from '@rxwf/providers-standard';
import type { StandardDatabase } from '@rxwf/providers-standard';
import { AwfError } from '@rxwf/shared';
import type { WorkflowItem } from '@rxwf/shared';
import {
  externalizeOutputItems,
  hydrateWorkflowItems,
} from '@rxwf/shared';
import type {
  FacadeNodeRunResult,
  NodeRunJob,
  SubworkflowRunChildInput,
} from '@rxwf/node-runner';
import { config } from '../config.js';
import { runnerGateway } from '../runners/gateway-instance.js';

export function definitionFromSnapshot(raw: string): WorkflowDefinition {
  const snap = JSON.parse(raw) as WorkflowDefinition & {
    edges?: WorkflowDefinition['connections'];
    trigger_type?: string;
  };
  return {
    schemaVersion: snap.schemaVersion ?? 1,
    name: snap.name ?? '',
    nodes: snap.nodes ?? [],
    connections: snap.connections ?? snap.edges ?? [],
    settings: snap.settings,
  };
}

export interface ExecutionRuntime {
  enqueueService: ReturnType<typeof createExecutionEnqueueService>;
  jobProcessor: ReturnType<typeof createJobProcessor>;
  executionRepo: ReturnType<typeof createLiteExecutionRepository>;
  nodeRunRepo: ReturnType<typeof createLiteNodeRunRepository>;
  runner: ReturnType<typeof createExecutionRunner>;
  debugNode: (input: {
    definition: WorkflowDefinition;
    targetNodeId: string;
    pinData?: Record<string, WorkflowItem[]>;
    pinBranchData?: Record<string, WorkflowItem[][]>;
    triggerInputs?: Record<string, WorkflowItem[]>;
    workflowId?: string;
    environment?: string;
    onNodeResult?: (nodeId: string, result: import('@rxwf/execution').DebugNodeResult) => void;
    onNodeStarted?: (nodeId: string) => void;
    onAgentStream?: (
      nodeId: string,
      chunk: import('@rxwf/ai-runtime-stub').AiStreamChunk,
    ) => void;
    locale?: string;
  }) => Promise<
    Awaited<ReturnType<typeof runDebugExecution>> & { executionId?: string }
  >;
  resolveExecutionEnv(
    workflowId: string,
    environment: string,
  ): Promise<Record<string, string>>;
  resolveExecutionVars(
    workflowId: string,
    environment: string,
  ): Promise<Record<string, string>>;
  processJobPayload: (
    payload: ExecutionEnqueueJobPayload,
  ) => Promise<{ executionId: string; status: string }>;
  resumeHitl: (input: {
    executionId: string;
    nodeId?: string;
    decision: 'approve' | 'reject';
    comment?: string;
    supplement?: string;
  }) => Promise<{ status: string; waitingNodeId?: string }>;
  close?: () => Promise<void>;
}

function buildDefinitionSnapshotJson(
  definition: WorkflowDefinition,
  version: number,
  triggerType: string,
): string {
  return JSON.stringify({
    schemaVersion: definition.schemaVersion,
    name: definition.name,
    version,
    nodes: definition.nodes,
    connections: definition.connections,
    settings: definition.settings,
    trigger_type: triggerType,
  });
}

async function persistPinnedNodeRuns(
  nodeRunRepo: ReturnType<typeof createLiteNodeRunRepository>,
  executionId: string,
  definition: WorkflowDefinition,
  pinnedOutputBranches: Map<string, WorkflowItem[][]>,
): Promise<void> {
  const nodeById = new Map(definition.nodes.map((n) => [n.id, n]));
  for (const [nodeId, branches] of pinnedOutputBranches) {
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const id = crypto.randomUUID();
    await nodeRunRepo.insertPending({
      id,
      executionId,
      nodeId,
      nodeType: node.type,
    });
    await nodeRunRepo.finish({
      id,
      status: 'success',
      durationMs: 0,
      outputData: branches,
    });
  }
}

function createPersistingNodeRunExecutor(
  execute: (job: NodeRunJob) => Promise<FacadeNodeRunResult>,
  nodeRunRepo: ReturnType<typeof createLiteNodeRunRepository>,
  blobService?: LiteBinaryBlobService,
): (job: NodeRunJob) => Promise<FacadeNodeRunResult> {
  return async (job) => {
    const nodeRunId = crypto.randomUUID();
    await nodeRunRepo.insertPending({
      id: nodeRunId,
      executionId: job.executionId,
      nodeId: job.nodeRunId,
      nodeType: job.nodeType,
    });
    const started = Date.now();
    const acc = shouldPersistAgentSteps(job.nodeType)
      ? createAgentStepsAccumulator()
      : null;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;

    const flushAgentStepsMetadata = () => {
      if (!acc) return;
      void nodeRunRepo.patchMetadata(nodeRunId, {
        agentSteps: acc.getSteps(),
      });
    };
    const scheduleAgentStepsFlush = () => {
      if (flushTimer !== undefined) clearTimeout(flushTimer);
      flushTimer = setTimeout(() => {
        flushTimer = undefined;
        flushAgentStepsMetadata();
      }, 300);
    };

    let runJob = job;
    if (blobService) {
      const load = (blobId: string) => blobService.load(blobId);
      const inputItems = await hydrateWorkflowItems(job.inputItems, load);
      const inputBranches = job.inputBranches
        ? await Promise.all(
            job.inputBranches.map((branch) => hydrateWorkflowItems(branch, load)),
          )
        : undefined;
      runJob = {
        ...job,
        inputItems,
        ...(inputBranches ? { inputBranches } : {}),
      };
    }

    try {
      const result = await execute({
        ...runJob,
        onAgentStream: (chunk) => {
          acc?.push(chunk);
          job.onAgentStream?.(chunk);
          if (acc) scheduleAgentStepsFlush();
        },
      });
      if (flushTimer !== undefined) {
        clearTimeout(flushTimer);
        flushTimer = undefined;
      }
      const status =
        result.status === 'failed'
          ? 'failed'
          : result.status === 'skipped'
            ? 'skipped'
            : result.status === 'waiting'
              ? 'waiting'
              : 'success';
      if (acc) {
        const agentSteps = acc.getSteps();
        if (agentSteps.length > 0) {
          result.metadata = {
            ...result.metadata,
            agentSteps,
          };
        }
      }
      let outputItems = result.outputItems;
      if (blobService && outputItems) {
        outputItems = await externalizeOutputItems(outputItems, {
          executionId: job.executionId,
          nodeRunId,
          store: blobService,
        });
        result.outputItems = outputItems;
      }
      const finishMetadata: Record<string, unknown> = { ...(result.metadata ?? {}) };
      if (result.logs?.length) {
        finishMetadata.logs = result.logs;
      }
      await nodeRunRepo.finish({
        id: nodeRunId,
        status,
        durationMs: Date.now() - started,
        runnerId: result.runnerId,
        runnerPlatform: result.runnerPlatform,
        errorCode: result.errorCode,
        outputData: outputItems ?? null,
        metadata: Object.keys(finishMetadata).length > 0 ? finishMetadata : null,
      });
      return result;
    } catch (err) {
      if (flushTimer !== undefined) clearTimeout(flushTimer);
      if (acc) {
        const agentSteps = acc.getSteps();
        if (agentSteps.length > 0) {
          await nodeRunRepo.patchMetadata(nodeRunId, { agentSteps });
        }
      }
      await nodeRunRepo.finish({
        id: nodeRunId,
        status: 'failed',
        durationMs: Date.now() - started,
        errorCode: err instanceof AwfError ? err.code : 'E2000',
        metadata: acc?.getSteps().length ? { agentSteps: acc.getSteps() } : null,
      });
      throw err;
    }
  };
}

export interface CreateExecutionRuntimeOptions {
  /** @deprecated Plus 门控已移除；保留字段供测试兼容 */
  featurePlus?: boolean;
  /** Lite DB for skill registry loads (skillSource=registry). */
  liteDb?: LiteDatabase;
  ollamaUrl?: string;
  ollamaModel?: string;
  getOllamaDefaults?: () => Promise<{ ollamaUrl: string; ollamaModel: string }>;
  getRuntimeConfig?: () => Promise<{ ollamaUrl: string; ollamaModel: string }>;
  /** Test override: skip LangChain factory */
  ai?: import('@rxwf/ai-runtime-stub').AiRuntime;
  callMcpTool?: import('@rxwf/node-runner').PlusExecutorDeps['callMcpTool'];
  agentMemory?: import('@rxwf/node-runner').PlusExecutorDeps['agentMemory'];
  credentialResolver?: (credentialId: string) => Promise<Record<string, string>>;
  credentialService?: ReturnType<typeof createCredentialService>;
  crewAiClient?: import('@rxwf/node-runner').PlusExecutorDeps['crewAiClient'];
  createCrewToolBridgeToken?: import('@rxwf/node-runner').PlusExecutorDeps['createCrewToolBridgeToken'];
  crewToolBridgeBaseUrl?: string;
  extraJobHandlers?: JobHandler[];
  knowledgeQuery?: import('@rxwf/node-runner').PlusExecutorDeps['knowledge'];
  webSearch?: import('@rxwf/providers-contracts').WebSearchPort;
  loadWebSearchSettings?: import('@rxwf/node-runner').PlusExecutorDeps['loadWebSearchSettings'];
  getRxwfWorkspaceRoot?: () => Promise<string>;
  getKnowledgePlatformConfig?: () => Promise<
    import('@rxwf/knowledge').KnowledgePlatformConfig
  >;
  resolveModelRef?: (modelId: string) => Promise<import('@rxwf/ai-runtime-stub').ModelRef>;
}

export interface StandardRuntimeDeps {
  liteDb: LiteDatabase;
  pgDb: StandardDatabase;
  useBullMQ: boolean;
  redisUrl: string;
  bullmqExecutionConcurrency?: number;
}

export async function createExecutionRuntimeFromDeps(
  deps: StandardRuntimeDeps,
  platform: { os: 'windows' | 'linux' | 'macos'; arch: 'x64' | 'arm64' | 'arm' },
  runtimeOptions: CreateExecutionRuntimeOptions = {},
): Promise<ExecutionRuntime> {
  const runnerRepository = createLiteRunnerRepository(deps.liteDb);
  const executionRepo = createStandardExecutionRepository(deps.pgDb);
  const nodeRunRepo = createLiteNodeRunRepository(deps.liteDb);
  const workflowLoader = createStandardWorkflowLoader(deps.pgDb);
  const idempotency = createLiteIdempotencyService(deps.liteDb);
  const envRepo = createStandardEnvRepository(deps.pgDb);
  const variablesRepo = createStandardVariablesRepository(deps.pgDb);

  let stopBullMQ: (() => Promise<void>) | undefined;

  const ephemeralWorkflowService = createWorkflowService(
    createStandardWorkflowRepository(deps.pgDb),
  );

  const core = await buildExecutionRuntimeCore({
    runnerRepository,
    executionRepo,
    nodeRunRepo,
    workflowLoader,
    idempotency,
    envRepo,
    variablesRepo,
    runtimeOptions,
    liteDb: deps.liteDb,
    persistEphemeralWorkflow: async (definition) => {
      const created = await ephemeralWorkflowService.create({
        name: `wf-run-${crypto.randomUUID().slice(0, 8)}`,
        definition,
      });
      return created.id;
    },
  });

  let jobProcessor = core.runtime.jobProcessor;
  if (deps.useBullMQ && deps.redisUrl) {
    const bull = createBullMQQueueProvider({
      redisUrl: deps.redisUrl,
      concurrency: deps.bullmqExecutionConcurrency,
    });
    stopBullMQ = await bull.startWorker((payload) => core.handleEnqueue(payload));
    jobProcessor = {
      ...core.runtime.jobProcessor,
      processOnce: async () => 0,
    };
  }

  return {
    ...core.runtime,
    jobProcessor,
    processJobPayload: core.handleEnqueue,
    close: async () => {
      await stopBullMQ?.();
    },
  };
}

export async function createExecutionRuntime(
  db: LiteDatabase,
  platform: { os: 'windows' | 'linux' | 'macos'; arch: 'x64' | 'arm64' | 'arm' } = {
    os: 'linux',
    arch: 'x64',
  },
  runtimeOptions: CreateExecutionRuntimeOptions = {},
): Promise<ExecutionRuntime> {
  const runnerRepository = createLiteRunnerRepository(db);
  await runnerRepository.ensureEmbedded(platform, ['code']);
  const executionRepo = createLiteExecutionRepository(db);
  const nodeRunRepo = createLiteNodeRunRepository(db);
  const workflowLoader = createLiteWorkflowLoader(db);
  const jobQueue = createLiteJobQueue(db);
  const idempotency = createLiteIdempotencyService(db);
  const envRepo = createLiteEnvRepository(db);
  const variablesRepo = createLiteVariablesRepository(db);

  const ephemeralWorkflowService = createWorkflowService(
    createLiteWorkflowRepository(db),
  );

  const core = await buildExecutionRuntimeCore({
    runnerRepository,
    executionRepo,
    nodeRunRepo,
    workflowLoader,
    idempotency,
    envRepo,
    variablesRepo,
    runtimeOptions: { ...runtimeOptions, liteDb: db },
    liteDb: db,
    persistEphemeralWorkflow: async (definition) => {
      const created = await ephemeralWorkflowService.create({
        name: `wf-run-${crypto.randomUUID().slice(0, 8)}`,
        definition,
      });
      return created.id;
    },
  });

  const jobProcessor = createJobProcessor({
    claimPending: (limit) => jobQueue.claimPending(limit),
    markCompleted: (id) => jobQueue.markCompleted(id),
    markFailed: (id, msg) => jobQueue.markFailed(id, msg),
    handlers: [
      executionEnqueueHandler(core.handleEnqueue),
      ...(runtimeOptions.extraJobHandlers ?? []),
    ],
    concurrency: config.liteJobConcurrency,
    onProcessed: config.jobProcessorMetrics
      ? (summary) => {
          if (summary.claimed <= 0) return;
          console.info(
            `[jobs] lite batch claimed=${summary.claimed} completed=${summary.completed} failed=${summary.failed} concurrency=${summary.concurrency} elapsedMs=${summary.elapsedMs}`,
          );
        }
      : undefined,
  });

  return {
    ...core.runtime,
    jobProcessor,
    processJobPayload: core.handleEnqueue,
  };
}

async function buildExecutionRuntimeCore(input: {
  runnerRepository: ReturnType<typeof createLiteRunnerRepository>;
  executionRepo: ReturnType<typeof createLiteExecutionRepository>;
  nodeRunRepo: ReturnType<typeof createLiteNodeRunRepository>;
  workflowLoader: Pick<
    ReturnType<typeof createLiteWorkflowLoader>,
    'loadWorkflow' | 'loadWorkflowForSource'
  >;
  idempotency: ReturnType<typeof createLiteIdempotencyService>;
  envRepo: ReturnType<typeof createLiteEnvRepository>;
  variablesRepo: ReturnType<typeof createLiteVariablesRepository>;
  runtimeOptions: CreateExecutionRuntimeOptions;
  liteDb?: LiteDatabase;
  persistEphemeralWorkflow?: (
    definition: WorkflowDefinition,
  ) => Promise<string>;
}) {
  const {
    runnerRepository,
    executionRepo,
    nodeRunRepo,
    workflowLoader,
    idempotency,
    envRepo,
    variablesRepo,
    runtimeOptions,
  } = input;

  async function resolveExecutionEnv(
    workflowId: string,
    environment: string,
  ): Promise<Record<string, string>> {
    const envName = normalizeStoredEnvironment(environment);
    return loadResolvedEnv(envRepo, { workflowId, environment: envName });
  }

  async function resolveExecutionVars(
    workflowId: string,
    environment: string,
  ): Promise<Record<string, string>> {
    const envName = normalizeStoredEnvironment(environment);
    return loadResolvedVars(variablesRepo, { workflowId, environment: envName });
  }

  const enqueueService = createExecutionEnqueueService({
    loadWorkflow: (workflowId, source) =>
      workflowLoader.loadWorkflowForSource(workflowId, source ?? 'draft'),
    insertExecution: async (record) => {
      await executionRepo.insertExecution({
        id: record.id,
        traceId: record.traceId,
        workflowId: record.workflowId,
        workflowVersionId: record.workflowVersionId,
        definitionSnapshot: record.definitionSnapshot,
        status: record.status,
        mode: record.mode,
        environment: record.environment,
        idempotencyKey: record.idempotencyKey,
        sessionId: record.sessionId,
      });
    },
  });

  let runner!: ReturnType<typeof createExecutionRunner>;

  const loadPublishedWorkflowDefinition = async (workflowId: string) => {
    const loaded = await workflowLoader.loadWorkflowForSource(workflowId, 'published');
    if (!loaded || loaded.status !== 'published') return null;
    return loaded.definition;
  };

  const runSubworkflowChild = async (
    input: SubworkflowRunChildInput,
  ): Promise<{ executionId: string; outputItems: WorkflowItem[] }> => {
    const source = input.definitionSource ?? 'published';
    const loaded = await workflowLoader.loadWorkflowForSource(
      input.workflowId,
      source,
    );
    if (!loaded) {
      throw new AwfError('E1001', `Workflow not found: ${input.workflowId}`);
    }
    if (input.requireExposeAsTool) {
      const target = {
        exists: true,
        published: loaded.status === 'published',
        exposeAsTool: Boolean(loaded.definition.settings?.exposeAsTool),
      };
      const err = validateToolWorkflowTarget(target);
      if (err) {
        throw new AwfError(err.code, err.message);
      }
    }
    const enqueued = await enqueueService.enqueue({
      workflowId: input.workflowId,
      triggerType: 'subworkflow',
      mode: source === 'draft' ? 'manual' : 'production',
      definitionSource: source,
    });
    const stored = await executionRepo.getExecution(enqueued.executionId);
    if (!stored) {
      throw new AwfError('E1001', 'Subworkflow execution not found after enqueue');
    }
    const definition = definitionFromSnapshot(stored.definitionSnapshot);
    const runResult = await runner.runStoredExecution({
      executionId: enqueued.executionId,
      definition,
      mode: 'production',
      initialItems: input.inputItems,
      parentExecutionId: input.parentExecutionId,
      subworkflowDepth: input.depth,
      env: await resolveExecutionEnv(stored.workflowId, stored.environment),
      vars: await resolveExecutionVars(stored.workflowId, stored.environment),
    });
    if (runResult.status !== 'success') {
      throw new AwfError('E2003', 'Subworkflow execution failed');
    }
    return {
      executionId: enqueued.executionId,
      outputItems: runResult.finalOutputItems ?? input.inputItems,
    };
  };

  let plusDeps: import('@rxwf/node-runner').PlusExecutorDeps | undefined;
  {
    const resolveOllamaCfg = input.runtimeOptions.getOllamaDefaults
      ? () => input.runtimeOptions.getOllamaDefaults!()
      : input.runtimeOptions.getRuntimeConfig
        ? async () => {
            const cfg = await input.runtimeOptions.getRuntimeConfig!();
            return { ollamaUrl: cfg.ollamaUrl, ollamaModel: cfg.ollamaModel };
          }
        : async () => ({
            ollamaUrl: input.runtimeOptions.ollamaUrl ?? 'http://127.0.0.1:11434',
            ollamaModel: input.runtimeOptions.ollamaModel ?? 'llama3',
          });

    const initialOllama = await resolveOllamaCfg();
    const ai =
      input.runtimeOptions.ai ??
      createLangChainAiRuntime({
        ollama: {
          baseUrl: initialOllama.ollamaUrl,
          defaultModel: initialOllama.ollamaModel,
        },
        credentialResolver: input.runtimeOptions.credentialResolver,
      });
    const resolveOllamaModelRef = async (nodeConfig: Record<string, unknown>) => {
      const cfg = await resolveOllamaCfg();
      const fromNode = String(nodeConfig.model ?? '').trim();
      const provider = String(nodeConfig.provider ?? 'ollama');
      if (provider === 'openai-compatible') {
        return {
          provider: 'openai-compatible' as const,
          model: fromNode || 'gpt-4o-mini',
          baseUrl: String(nodeConfig.baseUrl ?? '').trim() || undefined,
          credentialId: String(nodeConfig.credentialId ?? '').trim() || undefined,
        };
      }
      const fromNodeBaseUrl = String(nodeConfig.baseUrl ?? '').trim();
      if (fromNodeBaseUrl) {
        return {
          provider: 'ollama' as const,
          model: fromNode || 'llama3',
          baseUrl: fromNodeBaseUrl,
        };
      }
      return {
        provider: 'ollama' as const,
        model: fromNode || cfg.ollamaModel || 'llama3',
        baseUrl: cfg.ollamaUrl,
      };
    };
    const resolvePlatformRagModelRef =
      input.runtimeOptions.getKnowledgePlatformConfig &&
      input.runtimeOptions.resolveModelRef
        ? async () => {
            const { AwfError } = await import('@rxwf/shared');
            const cfg = await input.runtimeOptions.getKnowledgePlatformConfig!();
            const modelId = cfg.rag.defaultModelId?.trim();
            if (!modelId) {
              throw new AwfError('E1004', 'Knowledge platform RAG model not configured');
            }
            return input.runtimeOptions.resolveModelRef!(modelId);
          }
        : undefined;
    const runCompiledWorkflowChild = input.persistEphemeralWorkflow
      ? async (child: {
          definition: WorkflowDefinition;
          parentExecutionId: string;
          depth: number;
          inputItems: WorkflowItem[];
          definitionSource?: 'draft' | 'published';
        }) => {
          const wfId = await input.persistEphemeralWorkflow!(child.definition);
          return runSubworkflowChild({
            workflowId: wfId,
            parentExecutionId: child.parentExecutionId,
            depth: child.depth,
            inputItems: child.inputItems,
            definitionSource: child.definitionSource ?? 'draft',
          });
        }
      : undefined;

    const skillRepo =
      input.liteDb ?? input.runtimeOptions.liteDb
        ? createLiteSkillRepository(input.liteDb ?? input.runtimeOptions.liteDb!)
        : undefined;

    plusDeps = {
      ai,
      resolveOllamaModelRef,
      resolvePlatformRagModelRef,
      agentMemory: input.runtimeOptions.agentMemory,
      callMcpTool: input.runtimeOptions.callMcpTool,
      runSubworkflow: runSubworkflowChild,
      runCompiledWorkflow: runCompiledWorkflowChild,
      knowledge: input.runtimeOptions.knowledgeQuery,
      crewAiClient: input.runtimeOptions.crewAiClient,
      createCrewToolBridgeToken: input.runtimeOptions.createCrewToolBridgeToken,
      crewToolBridgeBaseUrl: input.runtimeOptions.crewToolBridgeBaseUrl,
      toolIntentModeAuto: true,
      webSearch: input.runtimeOptions.webSearch,
      resolveWebSearchCredential: input.runtimeOptions.credentialResolver,
      loadWebSearchSettings: input.runtimeOptions.loadWebSearchSettings,
      loadSkillFromRegistry: skillRepo
        ? async (skillId) => {
            const md = await skillRepo.getSkillMd(skillId);
            if (!md) return null;
            return { skillRelPath: md.slug, skillMd: md.content };
          }
        : undefined,
      getRxwfWorkspaceRoot: input.runtimeOptions.getRxwfWorkspaceRoot,
      loadPublishedWorkflowDefinition,
    };
  }

  const facade = createNodeRunnerFacade({
    runnerRepository,
    runnerGateway,
    builtinDeps: {
      subworkflow: {
        runChild: runSubworkflowChild,
        loadPublishedWorkflowDefinition,
      },
      resolveCredentialForAuth: input.runtimeOptions.credentialService
        ? (id) => input.runtimeOptions.credentialService!.resolveForAuth(id)
        : undefined,
    },
    plusDeps,
  });

  const liteDb = input.liteDb ?? input.runtimeOptions.liteDb;
  const blobService = liteDb
    ? createLiteBinaryBlobService(liteDb, config.dataDir)
    : undefined;

  const persistingExecute = createPersistingNodeRunExecutor(
    (job) => facade.executeNodeRun(job),
    nodeRunRepo,
    blobService,
  );

  runner = createExecutionRunner({
    executeNodeRun: persistingExecute,
    updateExecutionStatus: (id, status) =>
      executionRepo.updateExecutionStatus(id, status),
  });

  const handleEnqueue = async (payload: ExecutionEnqueueJobPayload) => {
    const mode =
      payload.mode ??
      (payload.triggerType === 'manual' ? 'manual' : 'production');
    const enqueued = await enqueueService.enqueue({
      workflowId: payload.workflowId,
      triggerType: payload.triggerType,
      mode,
      idempotencyKey: payload.idempotencyKey,
      definitionSource: payload.definitionSource,
      sessionId: payload.sessionId,
    });
    const stored = await executionRepo.getExecution(enqueued.executionId);
    if (!stored) {
      return { executionId: enqueued.executionId, status: enqueued.status };
    }
    const definition = definitionFromSnapshot(stored.definitionSnapshot);
    if (payload.triggerType === 'webhook') {
      const trigger = definition.nodes.find((n) => n.type === 'webhookTrigger');
      if (trigger) {
        if (payload.inputItems?.length) {
          trigger.parameters = {
            ...trigger.parameters,
            body: payload.inputItems[0]?.json ?? {},
          };
        } else if (payload.body) {
          try {
            trigger.parameters = {
              ...trigger.parameters,
              body: JSON.parse(payload.body) as Record<string, unknown>,
            };
          } catch {
            trigger.parameters = {
              ...trigger.parameters,
              body: { _rawBodyBase64: payload.body },
            };
          }
        }
      }
    }
    const errorPayload =
      payload.triggerType === 'error'
        ? resolveErrorPayloadFromEnqueue(payload.payload ?? payload) ?? undefined
        : undefined;
    const runResult = await runner.runStoredExecution({
      executionId: enqueued.executionId,
      definition,
      mode: stored.mode as 'production' | 'manual' | 'partial',
      env: await resolveExecutionEnv(stored.workflowId, stored.environment),
      vars: await resolveExecutionVars(stored.workflowId, stored.environment),
      initialItems:
        payload.inputItems ??
        (payload.triggerType === 'subworkflow' ? [] : undefined),
      parentExecutionId: payload.parentExecutionId,
      subworkflowDepth: payload.subworkflowDepth,
      workflowId: stored.workflowId,
      sessionId: payload.sessionId ?? stored.sessionId ?? undefined,
      errorPayload,
    });
    if (payload.idempotencyKey) {
      await idempotency.complete({
        key: payload.idempotencyKey,
        scope:
          payload.triggerType === 'webhook'
            ? webhookIdempotencyScope(
                (payload.mode ?? 'production') as 'production' | 'manual',
              )
            : 'api',
        executionId: enqueued.executionId,
      });
    }
    return {
      executionId: enqueued.executionId,
      status: runResult.status,
    };
  };

  const jobProcessor = createJobProcessor({
    claimPending: async () => [],
    markCompleted: async () => {},
    markFailed: async () => {},
    handlers: [
      executionEnqueueHandler(handleEnqueue),
      ...(runtimeOptions.extraJobHandlers ?? []),
    ],
  });

  const debugNode = async (input: {
    definition: WorkflowDefinition;
    targetNodeId: string;
    pinData?: Record<string, WorkflowItem[]>;
    pinBranchData?: Record<string, WorkflowItem[][]>;
    triggerInputs?: Record<string, WorkflowItem[]>;
    workflowId?: string;
    environment?: string;
    onNodeResult?: (nodeId: string, result: import('@rxwf/execution').DebugNodeResult) => void;
    onNodeStarted?: (nodeId: string) => void;
    onAgentStream?: (nodeId: string, chunk: import('@rxwf/ai-runtime-stub').AiStreamChunk) => void;
    locale?: string;
  }) => {
    const env =
      input.workflowId && input.workflowId !== 'new'
        ? await resolveExecutionEnv(
            input.workflowId,
            input.environment ?? 'test',
          )
        : undefined;
    const vars =
      input.workflowId && input.workflowId !== 'new'
        ? await resolveExecutionVars(
            input.workflowId,
            input.environment ?? 'test',
          )
        : undefined;

    let executionId: string | undefined;
    let persistPartial = false;

    if (input.workflowId && input.workflowId !== 'new') {
      const loaded = await workflowLoader.loadWorkflowForSource(
        input.workflowId,
        'draft',
      );
      if (loaded) {
        persistPartial = true;
        executionId = crypto.randomUUID();
        await executionRepo.insertExecution({
          id: executionId,
          traceId: crypto.randomUUID(),
          workflowId: loaded.workflowId,
          workflowVersionId: loaded.workflowVersionId,
          definitionSnapshot: buildDefinitionSnapshotJson(
            input.definition,
            loaded.version,
            'manual',
          ),
          status: 'queued',
          mode: 'partial',
          environment: input.environment ?? 'test',
        });
        await executionRepo.updateExecutionStatus(executionId, 'running');
      }
    }

    try {
      const result = await runDebugExecution({
        definition: input.definition,
        targetNodeId: input.targetNodeId,
        pinData: input.pinData,
        pinBranchData: input.pinBranchData,
        triggerInputs: input.triggerInputs,
        env,
        vars,
        executionId,
        locale: input.locale,
        onNodeResult: input.onNodeResult,
        onNodeStarted: input.onNodeStarted,
        onAgentStream: input.onAgentStream,
        executeNodeRun: persistPartial
          ? (job) => persistingExecute(job)
          : (job) => facade.executeNodeRun(job),
      });

      if (persistPartial && executionId) {
        try {
          const { graph } = toWorkflowGraph(input.definition);
          const plan = planPartialExecution({
            graph: { nodes: graph.nodes, edges: graph.edges },
            targetNodeId: input.targetNodeId,
            pinData: input.pinData,
            pinBranchData: input.pinBranchData,
          });
          const pinnedBranches = plan.pinnedOutputBranches ?? new Map();
          await persistPinnedNodeRuns(
            nodeRunRepo,
            executionId,
            input.definition,
            pinnedBranches,
          );
          await executionRepo.updateExecutionStatus(
            executionId,
            result.status === 'success' ? 'success' : 'failed',
          );
        } catch {
          // Pin persistence must not fail the debug run or mark skipped nodes as failed.
        }
      }

      return { ...result, executionId };
    } catch (err) {
      if (persistPartial && executionId) {
        await executionRepo.updateExecutionStatus(executionId, 'failed');
      }
      throw err;
    }
  };

  const resumeHitl = async (input: {
    executionId: string;
    nodeId?: string;
    decision: 'approve' | 'reject';
    comment?: string;
    supplement?: string;
  }): Promise<{ status: string; waitingNodeId?: string }> => {
    const row = await executionRepo.getExecution(input.executionId);
    if (!row) {
      throw new AwfError('E1001', 'Execution not found');
    }
    if (row.status !== 'waiting') {
      throw new AwfError('E3014', 'Execution is not waiting for human approval');
    }
    const waitingRun = await nodeRunRepo.findWaitingByExecution(input.executionId);
    if (!waitingRun) {
      throw new AwfError('E3014', 'No waiting node run for this execution');
    }
    if (input.nodeId && waitingRun.nodeId !== input.nodeId) {
      throw new AwfError('E3014', 'Specified node is not the active HITL gate');
    }

    const allRuns = await nodeRunRepo.listByExecutionId(input.executionId);
    const priorSuccess = [...allRuns]
      .reverse()
      .find((nr) => nr.status === 'success' && nr.nodeId !== waitingRun.nodeId);
    const inputItems: WorkflowItem[] =
      (priorSuccess?.outputData?.[0] as WorkflowItem[] | undefined) ?? [{ json: {} }];
    const definition = definitionFromSnapshot(row.definitionSnapshot);

    if (waitingRun.nodeType === 'groupChat') {
      const gcNode = definition.nodes.find((n) => n.id === waitingRun.nodeId);
      const checkpoint = (
        waitingRun.metadata?.groupChat as { checkpoint?: Record<string, unknown> } | undefined
      )?.checkpoint;

      if (!gcNode || gcNode.type !== 'groupChat' || !checkpoint) {
        throw new AwfError('E1051', 'Group chat checkpoint missing or corrupt');
      }

      if (input.decision === 'reject') {
        await nodeRunRepo.resumeFromWaiting({
          id: waitingRun.id,
          status: 'failed',
          outputData: buildHitlDecisionOutput('reject', inputItems, {
            comment: input.comment,
            supplement: input.supplement,
          }),
          metadata: {
            ...(waitingRun.metadata ?? {}),
            hitl: {
              decision: 'reject',
              comment: input.comment ?? '',
              supplement: input.supplement ?? '',
              resolvedAt: new Date().toISOString(),
            },
          },
          errorCode: 'E3014',
          durationMs: waitingRun.durationMs ?? 0,
        });
        await executionRepo.updateExecutionStatus(input.executionId, 'failed');
        return { status: 'failed' };
      }

      const env = await resolveExecutionEnv(row.workflowId, row.environment);
      const vars = await resolveExecutionVars(row.workflowId, row.environment);
      const gcResult = await facade.executeNodeRun({
        executionId: input.executionId,
        nodeRunId: waitingRun.nodeId,
        nodeType: 'groupChat',
        nodeConfig: gcNode.parameters,
        inputItems,
        workflowDefinition: definition,
        workflowId: row.workflowId,
        sessionId: row.sessionId ?? undefined,
        mode: row.mode as 'production' | 'manual' | 'partial',
        workflowSettings: definition.settings ?? {},
        env,
        vars,
        orchestrationResume: {
          kind: 'groupChat',
          checkpoint: checkpoint as unknown as NonNullable<NodeRunJob['orchestrationResume']>['checkpoint'],
          userMessage: input.supplement ?? '',
        },
      });

      if (gcResult.status === 'waiting') {
        await nodeRunRepo.patchMetadata(waitingRun.id, {
          ...(gcResult.metadata ?? {}),
          hitl: {
            ...((waitingRun.metadata?.hitl as Record<string, unknown> | undefined) ?? {}),
            supplement: input.supplement ?? '',
            resolvedAt: new Date().toISOString(),
          },
        });
        return { status: 'waiting', waitingNodeId: waitingRun.nodeId };
      }

      if (gcResult.status === 'failed') {
        await nodeRunRepo.resumeFromWaiting({
          id: waitingRun.id,
          status: 'failed',
          outputData: gcResult.outputItems ?? null,
          metadata: gcResult.metadata ?? null,
          errorCode: gcResult.errorCode,
          durationMs: waitingRun.durationMs ?? 0,
        });
        await executionRepo.updateExecutionStatus(input.executionId, 'failed');
        return { status: 'failed' };
      }

      const resolvedMeta = {
        ...(gcResult.metadata ?? {}),
        hitl: {
          ...((waitingRun.metadata?.hitl as Record<string, unknown> | undefined) ?? {}),
          decision: 'approve',
          comment: input.comment ?? '',
          supplement: input.supplement ?? '',
          resolvedAt: new Date().toISOString(),
        },
      };
      await nodeRunRepo.resumeFromWaiting({
        id: waitingRun.id,
        status: 'success',
        outputData: gcResult.outputItems ?? null,
        metadata: resolvedMeta,
        durationMs: waitingRun.durationMs ?? 0,
      });
      await executionRepo.updateExecutionStatus(input.executionId, 'running');

      const precomputedOutputs = buildPrecomputedOutputsFromNodeRuns(
        allRuns
          .filter((nr) => nr.nodeId !== waitingRun.nodeId)
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
        waitingRun.nodeId,
        gcResult.outputItems ?? [[{ json: {} }]],
      );

      const { graph, startNodeId } = toWorkflowGraph(definition);
      const engine = createExecutionEngine({ executeNodeRun: persistingExecute });
      const continued = await engine.run({
        executionId: input.executionId,
        graph,
        startNodeId,
        initialItems: inputItems,
        mode: row.mode as 'production' | 'manual' | 'partial',
        workflowSettings: definition.settings,
        env,
        vars,
        workflowDefinition: definition,
        workflowId: row.workflowId,
        sessionId: row.sessionId ?? undefined,
        precomputedOutputs,
      });

      if (continued.status === 'waiting') {
        await executionRepo.updateExecutionStatus(input.executionId, 'waiting');
        return { status: 'waiting', waitingNodeId: continued.waitingNodeId };
      }
      await executionRepo.updateExecutionStatus(
        input.executionId,
        continued.status === 'success' ? 'success' : 'failed',
      );
      return { status: continued.status };
    }

    const decisionOutput = buildHitlDecisionOutput(input.decision, inputItems, {
      comment: input.comment,
      supplement: input.supplement,
    });
    const hitlMeta = {
      ...(waitingRun.metadata ?? {}),
      hitl: {
        ...((waitingRun.metadata?.hitl as Record<string, unknown> | undefined) ?? {}),
        decision: input.decision,
        comment: input.comment ?? '',
        supplement: input.supplement ?? '',
        resolvedAt: new Date().toISOString(),
      },
    };

    if (input.decision === 'reject') {
      const waitingNode = definition.nodes.find((n) => n.id === waitingRun.nodeId);
      const loopOnReject = waitingNode?.parameters?.hitlLoopOnReject === true;

      if (loopOnReject) {
        const loopResult = await resumeHitlExecution(
          { executeNodeRun: persistingExecute },
          {
            executionId: input.executionId,
            definition,
            nodeRuns: allRuns.map((nr) => ({
              id: nr.id,
              nodeId: nr.nodeId,
              nodeType: nr.nodeType,
              status: nr.status,
              outputData: nr.outputData,
              metadata: nr.metadata,
            })),
            waitingNodeId: waitingRun.nodeId,
            decision: 'reject',
            comment: input.comment,
            supplement: input.supplement,
            mode: row.mode as 'production' | 'manual' | 'partial',
            workflowSettings: definition.settings,
            env: await resolveExecutionEnv(row.workflowId, row.environment),
            vars: await resolveExecutionVars(row.workflowId, row.environment),
            workflowId: row.workflowId,
            sessionId: row.sessionId ?? undefined,
          },
        );
        if (loopResult.status === 'waiting') {
          await executionRepo.updateExecutionStatus(input.executionId, 'waiting');
          return { status: 'waiting', waitingNodeId: loopResult.waitingNodeId };
        }
        await executionRepo.updateExecutionStatus(
          input.executionId,
          loopResult.status === 'success' ? 'success' : 'failed',
        );
        return { status: loopResult.status, waitingNodeId: loopResult.waitingNodeId };
      }

      await nodeRunRepo.resumeFromWaiting({
        id: waitingRun.id,
        status: 'failed',
        outputData: decisionOutput,
        metadata: hitlMeta,
        errorCode: 'E3014',
        durationMs: waitingRun.durationMs ?? 0,
      });
      await executionRepo.updateExecutionStatus(input.executionId, 'failed');
      return { status: 'failed' };
    }

    await nodeRunRepo.resumeFromWaiting({
      id: waitingRun.id,
      status: 'success',
      outputData: decisionOutput,
      metadata: hitlMeta,
      durationMs: waitingRun.durationMs ?? 0,
    });
    await executionRepo.updateExecutionStatus(input.executionId, 'running');

    const result = await resumeHitlExecution(
      { executeNodeRun: persistingExecute },
      {
        executionId: input.executionId,
        definition,
        nodeRuns: allRuns.map((nr) => ({
          id: nr.id,
          nodeId: nr.nodeId,
          nodeType: nr.nodeType,
          status: nr.nodeId === waitingRun.nodeId ? 'success' : nr.status,
          outputData: nr.nodeId === waitingRun.nodeId ? decisionOutput : nr.outputData,
          metadata: nr.nodeId === waitingRun.nodeId ? hitlMeta : nr.metadata,
        })),
        waitingNodeId: waitingRun.nodeId,
        decision: 'approve',
        comment: input.comment,
        supplement: input.supplement,
        mode: row.mode as 'production' | 'manual' | 'partial',
        workflowSettings: definition.settings,
        env: await resolveExecutionEnv(row.workflowId, row.environment),
        vars: await resolveExecutionVars(row.workflowId, row.environment),
        workflowId: row.workflowId,
        sessionId: row.sessionId ?? undefined,
      },
    );

    if (result.status === 'waiting') {
      await executionRepo.updateExecutionStatus(input.executionId, 'waiting');
      return { status: 'waiting', waitingNodeId: result.waitingNodeId };
    }
    await executionRepo.updateExecutionStatus(
      input.executionId,
      result.status === 'success' ? 'success' : 'failed',
    );
    return { status: result.status, waitingNodeId: result.waitingNodeId };
  };

  return {
    handleEnqueue,
    jobProcessor,
    runtime: {
      enqueueService,
      jobProcessor,
      executionRepo,
      nodeRunRepo,
      runner,
      debugNode,
      resolveExecutionEnv,
      resolveExecutionVars,
      processJobPayload: handleEnqueue,
      resumeHitl,
    },
  };
}
