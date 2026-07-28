import WebSocket from 'ws';
import type {
  RunnerAuthFailMessage,
  RunnerAuthMessage,
  RunnerWsEnvelope,
} from '@rxwf/runner-protocol';

const AUTH_TIMEOUT_MS = 5_000;
const INITIAL_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 60_000;

export function buildRunnerStreamUrl(serverUrl: string, runnerId: string): string {
  const base = serverUrl.replace(/\/$/, '');
  const wsBase = base.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
  return `${wsBase}/api/runners/${encodeURIComponent(runnerId)}/stream`;
}

export function buildAuthEnvelope(runnerCredential: string): RunnerAuthMessage {
  return {
    type: 'auth',
    ts: new Date().toISOString(),
    payload: { runnerCredential },
  };
}

function parseEnvelope(raw: WebSocket.RawData): RunnerWsEnvelope | null {
  try {
    const text = typeof raw === 'string' ? raw : raw.toString();
    const parsed = JSON.parse(text) as RunnerWsEnvelope;
    if (!parsed || typeof parsed.type !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export type WsSessionOptions = {
  serverUrl: string;
  runnerId: string;
  runnerCredential: string;
  onMessage: (envelope: RunnerWsEnvelope) => void;
  onClose?: () => void;
  /** Injectable WebSocket constructor (tests). */
  WebSocketImpl?: typeof WebSocket;
};

export class WsSession {
  private ws: WebSocket | null = null;
  private intentionalClose = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly WebSocketImpl: typeof WebSocket;

  constructor(private readonly opts: WsSessionOptions) {
    this.WebSocketImpl = opts.WebSocketImpl ?? WebSocket;
  }

  connect(): Promise<void> {
    return this.openAndAuthenticate();
  }

  send(envelope: RunnerWsEnvelope): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }
    this.ws.send(JSON.stringify(envelope));
  }

  close(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.ws?.close();
    this.ws = null;
  }

  private openAndAuthenticate(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = buildRunnerStreamUrl(this.opts.serverUrl, this.opts.runnerId);
      const ws = new this.WebSocketImpl(url);
      this.ws = ws;

      let settled = false;

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(authTimer);
        ws.removeAllListeners();
        ws.close();
        reject(error);
      };

      const authTimer = setTimeout(() => {
        fail(new Error('Authentication timeout'));
      }, AUTH_TIMEOUT_MS);

      ws.on('error', (err) => {
        fail(err instanceof Error ? err : new Error(String(err)));
      });

      ws.on('open', () => {
        ws.send(JSON.stringify(buildAuthEnvelope(this.opts.runnerCredential)));
      });

      ws.on('message', (raw) => {
        const envelope = parseEnvelope(raw);
        if (!envelope) return;

        if (envelope.type === 'auth.ok') {
          if (settled) return;
          settled = true;
          clearTimeout(authTimer);
          this.reconnectAttempt = 0;
          this.attachSessionHandlers(ws);
          resolve();
          return;
        }

        if (envelope.type === 'auth.fail') {
          const payload = (envelope as RunnerAuthFailMessage).payload;
          fail(new Error(payload?.message ?? 'Runner authentication failed'));
        }
      });

      ws.on('close', () => {
        if (!settled) {
          fail(new Error('WebSocket closed before authentication'));
        }
      });
    });
  }

  private attachSessionHandlers(ws: WebSocket): void {
    ws.removeAllListeners('message');
    ws.removeAllListeners('close');
    ws.removeAllListeners('error');

    ws.on('message', (raw) => {
      const envelope = parseEnvelope(raw);
      if (envelope) this.opts.onMessage(envelope);
    });

    ws.on('close', () => {
      this.ws = null;
      this.opts.onClose?.();
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    });

    ws.on('error', () => {
      if (!this.intentionalClose && ws.readyState === WebSocket.CLOSED) {
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose || this.reconnectTimer !== undefined) return;

    const delay = Math.min(
      INITIAL_RECONNECT_MS * 2 ** this.reconnectAttempt,
      MAX_RECONNECT_MS,
    );
    this.reconnectAttempt += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.openAndAuthenticate()
        .then(() => {
          this.reconnectAttempt = 0;
        })
        .catch(() => {
          this.scheduleReconnect();
        });
    }, delay);
  }
}
