import type { AwfCrewIrV1 } from '@rxwf/workflow';
import type { AiStreamChunk } from '@rxwf/ai-runtime-stub';

export interface CrewAiKickoffResult {
  status: 'success' | 'failed';
  answer?: string;
  crewSteps?: unknown[];
  agentSteps?: unknown[];
  crewEval?: import('@rxwf/workflow').AwfCrewEvalIr;
  error?: { code?: string; message?: string };
  code?: string;
  message?: string;
}

export interface CrewAiClient {
  kickoff(ir: AwfCrewIrV1, opts?: { signal?: AbortSignal }): Promise<CrewAiKickoffResult>;
  kickoffStream(
    ir: AwfCrewIrV1,
    onChunk: (chunk: AiStreamChunk) => void,
    opts?: { signal?: AbortSignal },
  ): Promise<CrewAiKickoffResult>;
  health(): Promise<boolean>;
}

export class CrewAiKickoffError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CrewAiKickoffError';
    this.code = code;
  }
}

function mapSseToChunk(event: string, data: Record<string, unknown>): AiStreamChunk | null {
  if (event === 'token' && typeof data.content === 'string') {
    return { type: 'token', content: data.content };
  }
  if (event === 'tool_start' && typeof data.tool === 'string') {
    return { type: 'tool_start', tool: data.tool, input: data.input };
  }
  if (event === 'tool_end' && typeof data.tool === 'string') {
    return { type: 'tool_end', tool: data.tool, output: data.output };
  }
  if (event === 'agent_step') {
    return { type: 'agent_step', step: data };
  }
  return null;
}

function parseSseBlock(block: string): { event: string; data: Record<string, unknown> } | null {
  let event = 'message';
  let dataLine = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLine += line.slice(5).trim();
    }
  }
  if (!dataLine) return null;
  try {
    return { event, data: JSON.parse(dataLine) as Record<string, unknown> };
  } catch {
    return null;
  }
}

async function readSseKickoffStream(
  body: ReadableStream<Uint8Array> | null,
  onChunk: (chunk: AiStreamChunk) => void,
): Promise<CrewAiKickoffResult> {
  if (!body) {
    throw new CrewAiKickoffError('E1042', 'CrewAI stream response has no body');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: CrewAiKickoffResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');

      const parsed = parseSseBlock(block);
      if (!parsed) continue;

      const { event, data } = parsed;
      if (event === 'done') {
        finalResult = {
          status: 'success',
          answer: String(data.answer ?? ''),
          crewSteps: Array.isArray(data.crewSteps) ? data.crewSteps : [],
          agentSteps: Array.isArray(data.agentSteps) ? data.agentSteps : [],
          crewEval: data.crewEval as CrewAiKickoffResult['crewEval'],
        };
        continue;
      }
      if (event === 'error') {
        const code = String(data.code ?? 'E1042');
        const message = String(data.message ?? 'CrewAI stream failed');
        throw new CrewAiKickoffError(code, message);
      }

      const chunk = mapSseToChunk(event, data);
      if (chunk) onChunk(chunk);
    }
  }

  if (!finalResult) {
    throw new CrewAiKickoffError('E1042', 'CrewAI stream ended without done event');
  }
  return finalResult;
}

export function createResolvableCrewAiClient(config: {
  envBaseUrl?: string;
  getRemoteBaseUrls?: () => string[];
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}): CrewAiClient {
  const timeoutMs = config.timeoutMs ?? 300_000;
  const fetchFn = config.fetchFn ?? fetch;
  const getRemoteBaseUrls = config.getRemoteBaseUrls ?? (() => []);

  async function pickBaseUrl(): Promise<string | null> {
    const candidates: string[] = [];
    const envUrl = config.envBaseUrl?.trim();
    if (envUrl) candidates.push(envUrl);
    for (const url of getRemoteBaseUrls()) {
      const trimmed = url.trim();
      if (trimmed && !candidates.includes(trimmed)) {
        candidates.push(trimmed);
      }
    }
    for (const baseUrl of candidates) {
      const probe = createCrewAiClient({ baseUrl, timeoutMs, fetchFn });
      if (await probe.health()) return baseUrl;
    }
    return null;
  }

  return {
    async health(): Promise<boolean> {
      return (await pickBaseUrl()) !== null;
    },

    async kickoff(ir, opts) {
      const baseUrl = await pickBaseUrl();
      if (!baseUrl) {
        throw new CrewAiKickoffError('E1042', 'No CrewAI sidecar available');
      }
      return createCrewAiClient({ baseUrl, timeoutMs, fetchFn }).kickoff(ir, opts);
    },

    async kickoffStream(ir, onChunk, opts) {
      const baseUrl = await pickBaseUrl();
      if (!baseUrl) {
        throw new CrewAiKickoffError('E1042', 'No CrewAI sidecar available');
      }
      return createCrewAiClient({ baseUrl, timeoutMs, fetchFn }).kickoffStream(
        ir,
        onChunk,
        opts,
      );
    },
  };
}

export function createCrewAiClient(config: {
  baseUrl: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}): CrewAiClient {
  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const timeoutMs = config.timeoutMs ?? 300_000;
  const fetchFn = config.fetchFn ?? fetch;

  return {
    async health(): Promise<boolean> {
      try {
        const res = await fetchFn(`${baseUrl}/health`, { method: 'GET' });
        if (!res.ok) return false;
        const body = (await res.json()) as { status?: string };
        return body.status === 'ok';
      } catch {
        return false;
      }
    },

    async kickoff(ir, opts) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const signal = opts?.signal ?? controller.signal;

      try {
        const res = await fetchFn(`${baseUrl}/v1/kickoff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ir),
          signal,
        });

        const data = (await res.json()) as CrewAiKickoffResult;

        if (!res.ok) {
          return {
            status: 'failed',
            error: {
              code: data.code ?? data.error?.code ?? 'E1042',
              message: data.message ?? data.error?.message ?? res.statusText,
            },
          };
        }

        return data;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw new CrewAiKickoffError('E1043', 'CrewAI sidecar kickoff timed out');
        }
        const message = err instanceof Error ? err.message : String(err);
        throw new CrewAiKickoffError('E1042', message || 'CrewAI sidecar kickoff failed');
      } finally {
        clearTimeout(timeout);
      }
    },

    async kickoffStream(ir, onChunk, opts) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const signal = opts?.signal ?? controller.signal;

      try {
        const res = await fetchFn(`${baseUrl}/v1/kickoff/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(ir),
          signal,
        });

        if (!res.ok) {
          let message = res.statusText;
          try {
            const data = (await res.json()) as CrewAiKickoffResult;
            message = data.message ?? data.error?.message ?? message;
          } catch {
            // ignore JSON parse errors on error responses
          }
          return {
            status: 'failed',
            error: { code: 'E1042', message },
          };
        }

        return await readSseKickoffStream(res.body, onChunk);
      } catch (err) {
        if (err instanceof CrewAiKickoffError) throw err;
        if (err instanceof Error && err.name === 'AbortError') {
          throw new CrewAiKickoffError('E1043', 'CrewAI sidecar kickoff timed out');
        }
        const message = err instanceof Error ? err.message : String(err);
        throw new CrewAiKickoffError('E1042', message || 'CrewAI sidecar stream failed');
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
