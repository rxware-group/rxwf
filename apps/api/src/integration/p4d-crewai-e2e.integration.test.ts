/**
 * Optional real CrewAI Sidecar smoke (health + kickoff contract).
 * Run with: RXWF_TEST_CREWAI=1 pnpm --filter @rxwf/api test -- p4d-crewai-e2e
 *
 * Prerequisites: Sidecar at CREWAI_RUNNER_URL (default http://127.0.0.1:8071),
 * Ollama reachable from Sidecar (Docker: host.docker.internal:11434).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createCrewAiClient } from '@rxwf/node-runner';
import type { AwfCrewIrV1 } from '@rxwf/workflow';

const runCrewaiE2e = process.env.RXWF_TEST_CREWAI === '1';
const sidecarUrl = process.env.CREWAI_RUNNER_URL ?? 'http://127.0.0.1:8071';

function minimalSequentialIr(): AwfCrewIrV1 {
  return {
    irVersion: 1,
    process: 'sequential',
    executionBackend: 'crewai',
    inputTask: 'Say hello in one short sentence.',
    crewParams: {},
    members: [
      {
        nodeId: 'a1',
        name: 'Writer',
        role: 'Writer',
        goal: 'Write briefly',
        model: { provider: 'ollama', model: process.env.RXWF_OLLAMA_MODEL ?? 'llama3' },
        tools: [],
      },
    ],
    execution: {
      executionId: 'e2e-ex-1',
      workflowId: 'e2e-wf-1',
      crewNodeId: 'crew',
      environment: 'test',
      toolBridgeBaseUrl: process.env.RXWF_PUBLIC_URL ?? 'http://127.0.0.1:8787',
      toolBridgeToken: '',
    },
  };
}

describe.skipIf(!runCrewaiE2e)('P4-D CrewAI sidecar e2e', () => {
  const client = createCrewAiClient({
    baseUrl: sidecarUrl,
    timeoutMs: Number(process.env.CREWAI_RUNNER_TIMEOUT_MS ?? 300_000),
  });

  beforeAll(async () => {
    const ok = await client.health();
    if (!ok) {
      throw new Error(
        `CrewAI sidecar not healthy at ${sidecarUrl}. Start with: rxwf deps up --services crewai`,
      );
    }
  });

  it('GET /health returns ok', async () => {
    expect(await client.health()).toBe(true);
  });

  it('POST /v1/kickoff returns success with answer', async () => {
    const result = await client.kickoff(minimalSequentialIr());
    expect(result.status).toBe('success');
    expect(String(result.answer ?? '').length).toBeGreaterThan(0);
    expect(Array.isArray(result.crewSteps)).toBe(true);
    expect(result.crewSteps!.length).toBeGreaterThanOrEqual(1);
  }, 360_000);
});
