import { describe, expect, it, vi } from 'vitest';
import { createCrewAiClient, createResolvableCrewAiClient } from './crewai-client.js';

describe('createCrewAiClient', () => {
  it('posts IR to /v1/kickoff and returns answer', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: 'success', answer: 'done', crewSteps: [], agentSteps: [] }),
    })) as unknown as typeof fetch;
    const client = createCrewAiClient({ baseUrl: 'http://127.0.0.1:8071', fetchFn });
    const res = await client.kickoff({ irVersion: 1 } as never);
    expect(res.answer).toBe('done');
    expect(fetchFn).toHaveBeenCalledWith(
      'http://127.0.0.1:8071/v1/kickoff',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('kickoffStream parses SSE done event', async () => {
    const sseBody =
      'event: agent_step\ndata: {"crewMember":"Writer","status":"running"}\n\n' +
      'event: done\ndata: {"answer":"streamed","crewSteps":[],"agentSteps":[]}\n\n';

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseBody));
        controller.close();
      },
    });

    const fetchFn = vi.fn(async () => ({
      ok: true,
      body: stream,
    })) as unknown as typeof fetch;

    const client = createCrewAiClient({ baseUrl: 'http://127.0.0.1:8071', fetchFn });
    const chunks: unknown[] = [];
    const res = await client.kickoffStream({ irVersion: 1 } as never, (chunk) => {
      chunks.push(chunk);
    });

    expect(res.answer).toBe('streamed');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      type: 'agent_step',
      step: { crewMember: 'Writer', status: 'running' },
    });
    expect(fetchFn).toHaveBeenCalledWith(
      'http://127.0.0.1:8071/v1/kickoff/stream',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('createResolvableCrewAiClient prefers env then remote urls', async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      const href = typeof url === 'string' ? url : url.toString();
      if (href.endsWith('/health')) {
        return {
          ok: true,
          json: async () => ({ status: 'ok' }),
        };
      }
      return {
        ok: true,
        json: async () => ({ status: 'success', answer: 'remote', crewSteps: [], agentSteps: [] }),
      };
    }) as unknown as typeof fetch;

    const client = createResolvableCrewAiClient({
      getRemoteBaseUrls: () => ['http://remote-agent:8071'],
      timeoutMs: 5000,
      fetchFn,
    });

    expect(await client.health()).toBe(true);
    const res = await client.kickoff({ irVersion: 1 } as never);
    expect(res.answer).toBe('remote');
    expect(fetchFn).toHaveBeenCalledWith(
      'http://remote-agent:8071/v1/kickoff',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
