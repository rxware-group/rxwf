import type {
  RunnerConnectionHandle,
  RunnerGatewayPort,
} from "@rxwf/providers-contracts";
import {
  E2011,
  E2012,
  type RemoteNodeRunJob,
  type RemoteNodeRunResult,
  type RunnerJobFailedPayload,
  type RunnerJobResultPayload,
  type RunnerToolInvokeRequest,
  type RunnerToolInvokeResult,
  type RunnerWsEnvelope,
} from "@rxwf/runner-protocol";
import { AwfError } from "@rxwf/shared";

const DEFAULT_DISPATCH_TIMEOUT_MS = 300_000;

type PendingJob = {
  resolve: (result: RemoteNodeRunResult) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type PendingToolInvoke = {
  resolve: (result: RunnerToolInvokeResult) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type ConnectionEntry = {
  conn: RunnerConnectionHandle;
  send: (envelope: RunnerWsEnvelope) => void;
};

export function createInMemoryRunnerGateway(): RunnerGatewayPort & {
  handleIncomingMessage(runnerId: string, envelope: RunnerWsEnvelope): void;
} {
  const connections = new Map<string, ConnectionEntry>();
  const pendingByRunner = new Map<string, Map<string, PendingJob>>();
  const pendingToolByRunner = new Map<string, Map<string, PendingToolInvoke>>();
  const crewaiSidecarByRunner = new Map<string, string>();

  function getPendingTools(runnerId: string): Map<string, PendingToolInvoke> {
    let pending = pendingToolByRunner.get(runnerId);
    if (!pending) {
      pending = new Map();
      pendingToolByRunner.set(runnerId, pending);
    }
    return pending;
  }

  function getPending(runnerId: string): Map<string, PendingJob> {
    let pending = pendingByRunner.get(runnerId);
    if (!pending) {
      pending = new Map();
      pendingByRunner.set(runnerId, pending);
    }
    return pending;
  }

  function resolvePending(
    runnerId: string,
    jobId: string,
    result: RemoteNodeRunResult,
  ): void {
    const pending = getPending(runnerId).get(jobId);
    if (!pending) return;
    clearTimeout(pending.timer);
    getPending(runnerId).delete(jobId);
    pending.resolve(result);
  }

  function kickConnectionInternal(
    runnerId: string,
    entry: ConnectionEntry,
    reason: string,
  ): void {
    entry.send({
      type: "auth.fail",
      ts: new Date().toISOString(),
      payload: { errorCode: "E2013", message: reason },
    });
    entry.conn.close(1000, reason);
    if (connections.get(runnerId) === entry) {
      connections.delete(runnerId);
      crewaiSidecarByRunner.delete(runnerId);
    }
  }

  return {
    registerConnection(runnerId: string, conn: RunnerConnectionHandle): void {
      const existing = connections.get(runnerId);
      if (existing) {
        kickConnectionInternal(
          runnerId,
          existing,
          "Replaced by new connection",
        );
      }
      const send = (envelope: RunnerWsEnvelope) => {
        conn.send(envelope);
      };
      connections.set(runnerId, { conn, send });
    },

    unregisterConnection(runnerId: string): void {
      connections.delete(runnerId);
      crewaiSidecarByRunner.delete(runnerId);
    },

    isConnected(runnerId: string): boolean {
      return connections.has(runnerId);
    },

    dispatchAndWait(
      runnerId: string,
      job: RemoteNodeRunJob,
      options?: { timeoutMs?: number },
    ): Promise<RemoteNodeRunResult> {
      const entry = connections.get(runnerId);
      if (!entry) {
        throw new AwfError(E2012, "Runner is offline");
      }

      const timeoutMs = options?.timeoutMs ?? DEFAULT_DISPATCH_TIMEOUT_MS;
      const jobId = job.jobId;

      return new Promise<RemoteNodeRunResult>((resolve, reject) => {
        const timer = setTimeout(() => {
          getPending(runnerId).delete(jobId);
          reject(new AwfError(E2011, "Runner queue timeout"));
        }, timeoutMs);

        getPending(runnerId).set(jobId, { resolve, reject, timer });

        entry.send({
          type: "job.assign",
          id: jobId,
          ts: new Date().toISOString(),
          payload: job,
        });
      });
    },

    notifyDrain(runnerId: string): void {
      const entry = connections.get(runnerId);
      if (!entry) return;
      entry.send({
        type: "config.update",
        ts: new Date().toISOString(),
        payload: { status: "draining" },
      });
    },

    kickConnection(runnerId: string, reason: string): void {
      const entry = connections.get(runnerId);
      if (!entry) return;
      kickConnectionInternal(runnerId, entry, reason);
    },

    listOnlineCrewAiSidecarUrls(): string[] {
      const urls: string[] = [];
      for (const [runnerId, url] of crewaiSidecarByRunner) {
        if (!connections.has(runnerId)) continue;
        const trimmed = url.trim();
        if (trimmed && !urls.includes(trimmed)) {
          urls.push(trimmed);
        }
      }
      return urls;
    },

    getCrewAiSidecarUrl(runnerId: string): string | undefined {
      if (!connections.has(runnerId)) return undefined;
      const url = crewaiSidecarByRunner.get(runnerId)?.trim();
      return url || undefined;
    },

    invokeTool(
      runnerId: string,
      request: RunnerToolInvokeRequest,
      options?: { timeoutMs?: number },
    ): Promise<RunnerToolInvokeResult> {
      const entry = connections.get(runnerId);
      if (!entry) {
        throw new AwfError(E2012, "Runner is offline");
      }
      const timeoutMs = options?.timeoutMs ?? request.timeoutMs ?? 60_000;
      const invokeId = request.invokeId;

      return new Promise<RunnerToolInvokeResult>((resolve, reject) => {
        const timer = setTimeout(() => {
          getPendingTools(runnerId).delete(invokeId);
          reject(new AwfError("E1061", "runner.tool.invoke timeout"));
        }, timeoutMs);

        getPendingTools(runnerId).set(invokeId, { resolve, reject, timer });

        entry.send({
          type: "tool.invoke",
          id: invokeId,
          ts: new Date().toISOString(),
          payload: request,
        });
      });
    },

    handleIncomingMessage(runnerId: string, envelope: RunnerWsEnvelope): void {
      switch (envelope.type) {
        case "job.result": {
          const payload = envelope.payload as RunnerJobResultPayload | undefined;
          if (!payload?.jobId) return;
          resolvePending(runnerId, payload.jobId, {
            jobId: payload.jobId,
            status: payload.status,
            outputItems: payload.outputItems,
            metadata: payload.metadata,
            durationMs: payload.durationMs,
          });
          break;
        }
        case "job.failed": {
          const payload = envelope.payload as RunnerJobFailedPayload | undefined;
          if (!payload?.jobId) return;
          resolvePending(runnerId, payload.jobId, {
            jobId: payload.jobId,
            status: "failed",
            errorCode: payload.errorCode,
            errorMessage: payload.errorMessage,
            durationMs: payload.durationMs,
          });
          break;
        }
        case "pong":
          break;
        case "presence": {
          const payload = envelope.payload as
            | { crewaiSidecarUrl?: string }
            | undefined;
          const sidecarUrl = payload?.crewaiSidecarUrl?.trim();
          if (sidecarUrl) {
            crewaiSidecarByRunner.set(runnerId, sidecarUrl);
          } else {
            crewaiSidecarByRunner.delete(runnerId);
          }
          break;
        }
        case "tool.result": {
          const payload = envelope.payload as RunnerToolInvokeResult | undefined;
          if (!payload?.invokeId) return;
          const pending = getPendingTools(runnerId).get(payload.invokeId);
          if (!pending) return;
          clearTimeout(pending.timer);
          getPendingTools(runnerId).delete(payload.invokeId);
          pending.resolve(payload);
          break;
        }
        default:
          break;
      }
    },
  };
}
