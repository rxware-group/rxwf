import type { WorkflowItem } from '@rxwf/shared';
import type { RemoteNodeRunJob } from './remote-job.js';
import type { RunnerToolInvokeRequest, RunnerToolInvokeResult } from './tool-invoke.js';

export interface RunnerWsEnvelope<T = unknown> {
  type: string;
  id?: string;
  ts?: string;
  payload?: T;
}

export type RunnerWsMessageType =
  | 'auth'
  | 'auth.ok'
  | 'auth.fail'
  | 'presence'
  | 'ping'
  | 'pong'
  | 'job.assign'
  | 'job.accept'
  | 'job.progress'
  | 'job.result'
  | 'job.failed'
  | 'job.cancel'
  | 'config.update'
  | 'tool.invoke'
  | 'tool.result';

export interface RunnerAuthPayload {
  runnerCredential: string;
}

export interface RunnerAuthOkPayload {
  serverTime: string;
  heartbeatIntervalMs: number;
  maxConcurrent: number;
}

export interface RunnerAuthFailPayload {
  errorCode: string;
  message: string;
}

export interface RunnerPresencePayload {
  runningJobs: number;
  agentVersion?: string;
  /** Remote CrewAI sidecar base URL advertised by runner-agent (v1.1+) */
  crewaiSidecarUrl?: string;
}

export interface RunnerPingPayload {
  echoId: string;
}

export interface RunnerPongPayload {
  echoId: string;
}

export type RunnerJobAssignPayload = RemoteNodeRunJob;

export interface RunnerJobAcceptPayload {
  jobId: string;
}

export interface RunnerJobProgressPayload {
  jobId: string;
  percent?: number;
  message?: string;
}

export interface RunnerJobResultPayload {
  jobId: string;
  status: 'success' | 'failed' | 'skipped';
  outputItems?: WorkflowItem[][];
  metadata?: Record<string, unknown>;
  durationMs: number;
}

export interface RunnerJobFailedPayload {
  jobId: string;
  errorCode: string;
  errorMessage: string;
  durationMs: number;
}

export interface RunnerJobCancelPayload {
  jobId: string;
  reason: string;
}

export interface RunnerConfigUpdatePayload {
  status: 'draining';
}

export type RunnerToolInvokeMessage = RunnerWsEnvelope<RunnerToolInvokeRequest> & {
  type: 'tool.invoke';
};
export type RunnerToolResultMessage = RunnerWsEnvelope<RunnerToolInvokeResult> & {
  type: 'tool.result';
};

export type RunnerAuthMessage = RunnerWsEnvelope<RunnerAuthPayload> & { type: 'auth' };
export type RunnerAuthOkMessage = RunnerWsEnvelope<RunnerAuthOkPayload> & { type: 'auth.ok' };
export type RunnerAuthFailMessage = RunnerWsEnvelope<RunnerAuthFailPayload> & { type: 'auth.fail' };
export type RunnerPresenceMessage = RunnerWsEnvelope<RunnerPresencePayload> & { type: 'presence' };
export type RunnerPingMessage = RunnerWsEnvelope<RunnerPingPayload> & { type: 'ping' };
export type RunnerPongMessage = RunnerWsEnvelope<RunnerPongPayload> & { type: 'pong' };
export type RunnerJobAssignMessage = RunnerWsEnvelope<RunnerJobAssignPayload> & { type: 'job.assign' };
export type RunnerJobAcceptMessage = RunnerWsEnvelope<RunnerJobAcceptPayload> & { type: 'job.accept' };
export type RunnerJobProgressMessage = RunnerWsEnvelope<RunnerJobProgressPayload> & { type: 'job.progress' };
export type RunnerJobResultMessage = RunnerWsEnvelope<RunnerJobResultPayload> & { type: 'job.result' };
export type RunnerJobFailedMessage = RunnerWsEnvelope<RunnerJobFailedPayload> & { type: 'job.failed' };
export type RunnerJobCancelMessage = RunnerWsEnvelope<RunnerJobCancelPayload> & { type: 'job.cancel' };
export type RunnerConfigUpdateMessage = RunnerWsEnvelope<RunnerConfigUpdatePayload> & {
  type: 'config.update';
};

export type RunnerWsMessage =
  | RunnerAuthMessage
  | RunnerAuthOkMessage
  | RunnerAuthFailMessage
  | RunnerPresenceMessage
  | RunnerPingMessage
  | RunnerPongMessage
  | RunnerJobAssignMessage
  | RunnerJobAcceptMessage
  | RunnerJobProgressMessage
  | RunnerJobResultMessage
  | RunnerJobFailedMessage
  | RunnerJobCancelMessage
  | RunnerConfigUpdateMessage
  | RunnerToolInvokeMessage
  | RunnerToolResultMessage;
