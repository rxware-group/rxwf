import type {
  RemoteNodeRunJob,
  RemoteNodeRunResult,
  RunnerToolInvokeRequest,
  RunnerToolInvokeResult,
} from '@rxwf/runner-protocol';

export interface RunnerConnectionHandle {
  send(envelope: unknown): void;
  close(code?: number, reason?: string): void;
}

export interface RunnerGatewayPort {
  registerConnection(runnerId: string, conn: RunnerConnectionHandle): void;
  unregisterConnection(runnerId: string): void;
  isConnected(runnerId: string): boolean;
  dispatchAndWait(
    runnerId: string,
    job: RemoteNodeRunJob,
    options?: { timeoutMs?: number },
  ): Promise<RemoteNodeRunResult>;
  notifyDrain(runnerId: string): void;
  kickConnection(runnerId: string, reason: string): void;
  listOnlineCrewAiSidecarUrls(): string[];
  getCrewAiSidecarUrl(runnerId: string): string | undefined;
  invokeTool(
    runnerId: string,
    request: RunnerToolInvokeRequest,
    options?: { timeoutMs?: number },
  ): Promise<RunnerToolInvokeResult>;
}
