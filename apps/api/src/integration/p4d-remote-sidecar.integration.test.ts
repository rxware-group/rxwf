/**
 * P4-D+ remote CrewAI sidecar discovery via runner gateway presence
 */
import { describe, it, expect, vi } from 'vitest';
import { createResolvableCrewAiClient } from '@rxwf/node-runner';
import { createInMemoryRunnerGateway } from '../runners/runner-gateway.js';

describe('P4-D remote sidecar discovery', () => {
  it('createResolvableCrewAiClient uses remote url when env sidecar is absent', async () => {
    const gateway = createInMemoryRunnerGateway();
    gateway.registerConnection('agent-1', {
      send: () => {},
      close: () => {},
    });
    gateway.handleIncomingMessage('agent-1', {
      type: 'presence',
      payload: {
        runningJobs: 0,
        crewaiSidecarUrl: 'http://remote-host:8071',
      },
    });

    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      const href = typeof url === 'string' ? url : url.toString();
      if (href.endsWith('/health')) {
        return { ok: true, json: async () => ({ status: 'ok' }) };
      }
      return {
        ok: true,
        json: async () => ({ status: 'success', answer: 'ok', crewSteps: [], agentSteps: [] }),
      };
    }) as unknown as typeof fetch;

    const client = createResolvableCrewAiClient({
      getRemoteBaseUrls: () => gateway.listOnlineCrewAiSidecarUrls(),
      timeoutMs: 5000,
      fetchFn,
    });

    expect(await client.health()).toBe(true);
    const result = await client.kickoff({ irVersion: 1 } as never);
    expect(result.answer).toBe('ok');
    expect(fetchFn).toHaveBeenCalledWith(
      'http://remote-host:8071/v1/kickoff',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('gateway getCrewAiSidecarUrl returns url only while connected', () => {
    const gateway = createInMemoryRunnerGateway();
    gateway.registerConnection('agent-1', { send: () => {}, close: () => {} });
    gateway.handleIncomingMessage('agent-1', {
      type: 'presence',
      payload: { runningJobs: 0, crewaiSidecarUrl: 'http://127.0.0.1:8071' },
    });

    expect(gateway.getCrewAiSidecarUrl('agent-1')).toBe('http://127.0.0.1:8071');
    gateway.unregisterConnection('agent-1');
    expect(gateway.getCrewAiSidecarUrl('agent-1')).toBeUndefined();
  });
});
