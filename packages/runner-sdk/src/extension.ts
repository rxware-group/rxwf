import type { NodeExecutionContext, NodeExecutor, NodeRunResult } from '@rxwf/node-runner';

import type { RunnerExtensionManifest } from './manifest.js';

export interface AgentConfig {
  serverUrl: string;
  runnerId: string;
  name: string;
  maxConcurrent: number;
  labels: string[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  extensionsDir?: string;
}

export interface RunnerLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface RunnerExtensionContext {
  registerExecutor(executor: NodeExecutor): void;
  registerCapability(name: string, probe: () => Promise<boolean>): void;
  readonly config: Readonly<AgentConfig>;
  readonly logger: RunnerLogger;
}

export interface RunnerJobContext {
  jobId: string;
  executionId: string;
  nodeRunId: string;
  nodeType: string;
  startedAt: Date;
}

export interface RunnerLifecycleHooks {
  onAgentStart?(ctx: RunnerExtensionContext): void | Promise<void>;
  onJobStart?(job: RunnerJobContext, ctx: RunnerExtensionContext): void | Promise<void>;
  onJobEnd?(
    job: RunnerJobContext,
    result: { status: 'success' | 'failed' | 'skipped'; durationMs: number },
    ctx: RunnerExtensionContext,
  ): void | Promise<void>;
  onAgentStop?(ctx: RunnerExtensionContext): void | Promise<void>;
}

export type RunnerNext = () => Promise<NodeRunResult>;

export interface RunnerMiddleware {
  readonly id: string;
  execute(
    ctx: NodeExecutionContext,
    next: RunnerNext,
    meta: { jobId: string; nodeType: string },
  ): Promise<NodeRunResult>;
}

export interface RunnerExtension {
  manifest: RunnerExtensionManifest;
  register?(ctx: RunnerExtensionContext): void | Promise<void>;
  lifecycle?: RunnerLifecycleHooks;
  middleware?: RunnerMiddleware[];
}
