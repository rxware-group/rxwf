import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type WebSocket from 'ws';

import {
  WsSession,
  buildAuthEnvelope,
  buildRunnerStreamUrl,
} from './ws-session.js';

class MockWebSocket extends EventEmitter {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = MockWebSocket.OPEN;
  sent: string[] = [];

  constructor(public url: string) {
    super();
    queueMicrotask(() => this.emit('open'));
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close');
  }

  simulateMessage(msg: unknown): void {
    this.emit('message', JSON.stringify(msg));
  }
}

describe('buildRunnerStreamUrl', () => {
  it('maps http to ws and https to wss', () => {
    expect(buildRunnerStreamUrl('http://localhost:3000', 'id-1')).toBe(
      'ws://localhost:3000/api/runners/id-1/stream',
    );
    expect(buildRunnerStreamUrl('https://rxwf.example.com/', 'id/2')).toBe(
      'wss://rxwf.example.com/api/runners/id%2F2/stream',
    );
  });
});

describe('buildAuthEnvelope', () => {
  it('matches runner-protocol auth shape', () => {
    const envelope = buildAuthEnvelope('cred-xyz');
    expect(envelope.type).toBe('auth');
    expect(envelope.payload).toEqual({ runnerCredential: 'cred-xyz' });
    expect(envelope.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('WsSession', () => {
  it('connect sends auth and resolves on auth.ok', async () => {
    const onMessage = vi.fn();
    const session = new WsSession({
      serverUrl: 'http://localhost:3000',
      runnerId: 'runner-1',
      runnerCredential: 'secret',
      onMessage,
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });

    const connectPromise = session.connect();

    const ws = (session as unknown as { ws: MockWebSocket }).ws;
    expect(ws.url).toBe('ws://localhost:3000/api/runners/runner-1/stream');
    await Promise.resolve();
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0]!)).toMatchObject({
      type: 'auth',
      payload: { runnerCredential: 'secret' },
    });

    ws.simulateMessage({
      type: 'auth.ok',
      payload: {
        serverTime: new Date().toISOString(),
        heartbeatIntervalMs: 30000,
        maxConcurrent: 2,
      },
    });

    await connectPromise;

    ws.simulateMessage({ type: 'ping', payload: { echoId: '1' } });
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ping', payload: { echoId: '1' } }),
    );

    session.close();
  });

  it('connect rejects on auth.fail', async () => {
    const session = new WsSession({
      serverUrl: 'http://localhost:3000',
      runnerId: 'runner-1',
      runnerCredential: 'bad',
      onMessage: vi.fn(),
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });

    const connectPromise = session.connect();
    const ws = (session as unknown as { ws: MockWebSocket }).ws;
    ws.simulateMessage({
      type: 'auth.fail',
      payload: { errorCode: 'E2013', message: 'Runner authentication failed' },
    });

    await expect(connectPromise).rejects.toThrow('Runner authentication failed');
  });

  it('send throws when not connected', () => {
    const session = new WsSession({
      serverUrl: 'http://localhost:3000',
      runnerId: 'r1',
      runnerCredential: 'c',
      onMessage: vi.fn(),
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });

    expect(() => session.send({ type: 'presence', payload: { runningJobs: 0 } })).toThrow(
      'WebSocket is not connected',
    );
  });
});
