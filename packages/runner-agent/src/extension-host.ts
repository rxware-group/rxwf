import {
  createExecutorRegistry,
  type NodeExecutionContext,
  type ExecutorRegistry,
} from '@rxwf/node-runner';
import { E2016 } from '@rxwf/runner-protocol';
import type { RemoteNodeRunJob, RemoteNodeRunResult } from '@rxwf/runner-protocol';
import {
  validateExtensionManifest,
  type AgentConfig,
  type RunnerExtension,
  type RunnerExtensionContext,
  type RunnerLogger,
} from '@rxwf/runner-sdk';

import { registerCoreExecutors } from './builtin/register-core.js';

const RUNNER_SDK_VERSION = '1.0.0';
const CORE_CAPABILITIES = ['code', 'shell', 'http', 'file', 'web_search'] as const;

const noopLogger: RunnerLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

const defaultAgentConfig: AgentConfig = {
  serverUrl: '',
  runnerId: '',
  name: '',
  maxConcurrent: 1,
  labels: [],
  logLevel: 'info',
};

async function loadExtensions(
  paths: string[],
  registry: ExecutorRegistry,
  capabilities: Set<string>,
): Promise<void> {
  for (const spec of paths) {
    const mod = (await import(spec)) as { default?: RunnerExtension };
    const extension = mod.default;
    if (!extension?.manifest) {
      throw new Error(`Extension ${spec} must export a default RunnerExtension`);
    }

    const validation = validateExtensionManifest(extension.manifest, RUNNER_SDK_VERSION);
    if (!validation.ok) {
      throw new Error(`Extension ${spec}: ${validation.reason}`);
    }

    for (const capability of extension.manifest.capabilities ?? []) {
      capabilities.add(capability);
    }

    if (extension.register) {
      const ctx: RunnerExtensionContext = {
        config: defaultAgentConfig,
        logger: noopLogger,
        registerExecutor: (executor) => {
          registry.register(executor);
        },
        registerCapability: (name) => {
          capabilities.add(name);
        },
      };
      await extension.register(ctx);
    }
  }
}

function toExecutionContext(job: RemoteNodeRunJob): NodeExecutionContext {
  return {
    config: job.nodeConfig,
    inputItems: job.inputItems,
    inputBranches: job.inputBranches,
    env: job.env,
    vars: job.vars,
    executionId: job.executionId,
    nodeId: job.nodeRunId,
  };
}

export function createExtensionHost(opts?: { extensions?: string[] }): {
  capabilities: string[];
  ready: Promise<void>;
  execute(job: RemoteNodeRunJob): Promise<RemoteNodeRunResult>;
} {
  const registry = createExecutorRegistry();
  registerCoreExecutors(registry);

  const capabilities = new Set<string>(CORE_CAPABILITIES);
  const extensionsReady =
    opts?.extensions && opts.extensions.length > 0
      ? loadExtensions(opts.extensions, registry, capabilities)
      : Promise.resolve();

  return {
    get capabilities(): string[] {
      return [...capabilities];
    },
    ready: extensionsReady,
    async execute(job: RemoteNodeRunJob): Promise<RemoteNodeRunResult> {
      await extensionsReady;
      const startedAt = Date.now();

      if (!registry.has(job.nodeType)) {
        return {
          jobId: job.jobId,
          status: 'failed',
          errorCode: E2016,
          errorMessage: `Node type not supported by runner: ${job.nodeType}`,
          durationMs: Date.now() - startedAt,
        };
      }

      const result = await registry.execute(job.nodeType, toExecutionContext(job));
      const durationMs = Date.now() - startedAt;

      if (result.status === 'failed') {
        return {
          jobId: job.jobId,
          status: 'failed',
          outputItems: result.outputItems,
          errorCode: result.errorCode ?? 'E2002',
          errorMessage: result.errorMessage ?? 'Execution failed',
          durationMs,
        };
      }

      if (result.status === 'waiting') {
        return {
          jobId: job.jobId,
          status: 'failed',
          errorCode: 'E2002',
          errorMessage: 'waiting status is not supported on remote runner jobs',
          durationMs,
        };
      }

      return {
        jobId: job.jobId,
        status: result.status === 'skipped' ? 'skipped' : 'success',
        outputItems: result.outputItems,
        metadata: result.metadata as Record<string, unknown> | undefined,
        durationMs,
      };
    },
  };
}
