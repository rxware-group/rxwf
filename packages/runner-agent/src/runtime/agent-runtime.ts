import { readFileSync } from 'node:fs';

import type {
  RunnerPingPayload,
  RunnerWsEnvelope,
} from '@rxwf/runner-protocol';

import type { RunnerAgentConfig } from '../config.js';
import { createExtensionHost } from '../extension-host.js';
import { createJobLoop } from '../job-loop.js';
import { JobPool } from '../job-pool.js';
import { JobTracker } from '../job-tracker.js';
import type { RunnerCredentialFile } from '../register.js';
import { handleSkillToolInvoke, setWebSearchCredentialFilePath } from '../skill-tool-handler.js';
import { WsSession } from '../ws-session.js';

const DEFAULT_HEARTBEAT_MS = 30_000;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_CONCURRENT = 1;
const AGENT_VERSION = '1.0.0';

function readCredential(path: string): RunnerCredentialFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read credential file at ${path}: ${message}`);
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Credential file at ${path} must be a JSON object`);
  }

  const raw = parsed as Record<string, unknown>;
  if (typeof raw.runnerId !== 'string' || raw.runnerId.trim() === '') {
    throw new Error(`Credential file at ${path} is missing runnerId`);
  }
  if (typeof raw.runnerCredential !== 'string' || raw.runnerCredential.trim() === '') {
    throw new Error(`Credential file at ${path} is missing runnerCredential`);
  }

  return {
    runnerId: raw.runnerId.trim(),
    runnerCredential: raw.runnerCredential.trim(),
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class AgentRuntime {
  private wsSession: WsSession | null = null;
  private presenceTimer: ReturnType<typeof setInterval> | undefined;
  private heartbeatIntervalMs = DEFAULT_HEARTBEAT_MS;
  private draining = false;
  private stopped = false;
  private jobLoopHandle: ((envelope: RunnerWsEnvelope) => void) | null = null;
  private pool: JobPool | null = null;
  private tracker: JobTracker | null = null;

  constructor(private readonly config: RunnerAgentConfig) {}

  async start(): Promise<void> {
    const credential = readCredential(this.config.credentialFile);
    setWebSearchCredentialFilePath(this.config.credentialFile);
    const runnerId = this.config.runnerId ?? credential.runnerId;

    const maxConcurrent = this.config.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
    this.pool = new JobPool(maxConcurrent);
    this.tracker = new JobTracker();

    const host = createExtensionHost({ extensions: this.config.extensions });
    await host.ready;

    const session = new WsSession({
      serverUrl: this.config.serverUrl,
      runnerId,
      runnerCredential: credential.runnerCredential,
      onMessage: (envelope) => {
        this.handleMessage(envelope);
      },
    });

    this.wsSession = session;
    await session.connect();

    const jobLoop = createJobLoop({
      pool: this.pool,
      tracker: this.tracker,
      host,
      send: (envelope) => {
        session.send(envelope);
      },
    });
    this.jobLoopHandle = jobLoop.handleMessage;

    this.startPresenceInterval();
  }

  async drain(): Promise<void> {
    if (this.draining) {
      return;
    }
    this.draining = true;
    this.stopPresenceInterval();

    const timeoutMs = this.config.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;

    while (this.tracker && this.tracker.size > 0 && Date.now() < deadline) {
      await sleep(100);
    }

    this.stop();
  }

  stop(): void {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    this.stopPresenceInterval();
    this.wsSession?.close();
    this.wsSession = null;
  }

  private handleMessage(envelope: RunnerWsEnvelope): void {
    if (envelope.type === 'ping') {
      const payload = envelope.payload as RunnerPingPayload | undefined;
      this.wsSession?.send({
        type: 'pong',
        ts: nowIso(),
        payload: { echoId: payload?.echoId ?? '' },
      });
      return;
    }

    if (envelope.type === 'config.update') {
      const status = (envelope.payload as { status?: string } | undefined)?.status;
      if (status === 'draining') {
        void this.drain();
      }
      return;
    }

    if (envelope.type === 'tool.invoke') {
      const request = envelope.payload as import('@rxwf/runner-protocol').RunnerToolInvokeRequest | undefined;
      if (!request?.invokeId || !this.wsSession) return;
      void handleSkillToolInvoke(request).then((result) => {
        this.wsSession?.send({
          type: 'tool.result',
          id: request.invokeId,
          ts: nowIso(),
          payload: result,
        });
      });
      return;
    }

    if (this.draining && envelope.type === 'job.assign') {
      return;
    }

    this.jobLoopHandle?.(envelope);
  }

  private startPresenceInterval(): void {
    this.sendPresence();
    this.presenceTimer = setInterval(() => {
      this.sendPresence();
    }, this.heartbeatIntervalMs);
  }

  private sendPresence(): void {
    if (!this.wsSession) {
      return;
    }
    try {
      this.wsSession.send({
        type: 'presence',
        ts: nowIso(),
        payload: {
          runningJobs: this.tracker?.size ?? 0,
          agentVersion: AGENT_VERSION,
          ...(this.config.crewaiSidecarUrl?.trim()
            ? { crewaiSidecarUrl: this.config.crewaiSidecarUrl.trim() }
            : {}),
        },
      });
    } catch {
      // disconnected; WsSession reconnects when applicable
    }
  }

  private stopPresenceInterval(): void {
    if (this.presenceTimer !== undefined) {
      clearInterval(this.presenceTimer);
      this.presenceTimer = undefined;
    }
  }
}
