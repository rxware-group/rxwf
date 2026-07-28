import { describe, it, expect, vi } from 'vitest';
import type { RunnerGatewayPort, RunnerRepositoryPort, RunnerRecord } from '@rxwf/providers-contracts';
import { E2010 } from '@rxwf/runner-protocol';
import { AwfError } from '@rxwf/shared';
import { createRunnerDispatcher } from './runner-dispatcher.js';

function embeddedRunner(): RunnerRecord {
  return {
    id: 'emb-1',
    name: 'embedded',
    kind: 'embedded',
    platform: { os: 'linux', arch: 'x64' },
    status: 'online',
    capabilities: ['code'],
    maxConcurrent: 5,
    runningJobs: 0,
  };
}

function agentRunner(overrides: Partial<RunnerRecord> = {}): RunnerRecord {
  return {
    id: 'agent-1',
    name: 'agent',
    kind: 'agent',
    platform: { os: 'linux', arch: 'x64' },
    status: 'online',
    capabilities: ['code', 'shell', 'http'],
    labels: ['ci'],
    maxConcurrent: 4,
    runningJobs: 1,
    lastHeartbeatAt: new Date('2026-05-01T12:00:00Z'),
    ...overrides,
  };
}

function mockRepo(overrides: Partial<RunnerRepositoryPort>): RunnerRepositoryPort {
  return {
    ensureEmbedded: vi.fn(),
    listOnline: vi.fn(async () => []),
    listAll: vi.fn(async () => []),
    findById: vi.fn(),
    incrementRunningJobs: vi.fn(),
    registerAgent: vi.fn(),
    verifyCredential: vi.fn(),
    updatePresence: vi.fn(),
    setStatus: vi.fn(),
    revokeAgent: vi.fn(),
    rotateCredential: vi.fn(),
    ...overrides,
  };
}

function mockGateway(connectedIds: string[]): RunnerGatewayPort {
  const set = new Set(connectedIds);
  return {
    registerConnection: vi.fn(),
    unregisterConnection: vi.fn(),
    isConnected: vi.fn((id: string) => set.has(id)),
    dispatchAndWait: vi.fn(),
    notifyDrain: vi.fn(),
    kickConnection: vi.fn(),
    listOnlineCrewAiSidecarUrls: vi.fn(() => []),
    getCrewAiSidecarUrl: vi.fn(),
    invokeTool: vi.fn(),
  };
}

describe('RunnerDispatcher v1.1', () => {
  it('embedded mode returns embedded runner', async () => {
    const emb = embeddedRunner();
    const repo = mockRepo({
      listOnline: vi.fn(async (filter) => {
        expect(filter).toEqual({ kind: 'embedded' });
        return [emb];
      }),
    });
    const dispatcher = createRunnerDispatcher({ runnerRepository: repo });
    const resolved = await dispatcher.resolve({
      effectivePolicy: { mode: 'embedded' },
    });
    expect(resolved).toEqual(emb);
  });

  it('auto picks connected agent matching platform and labels', async () => {
    const emb = embeddedRunner();
    const agent = agentRunner({ id: 'agent-linux-ci' });
    const repo = mockRepo({
      listOnline: vi.fn(async () => [emb, agent]),
    });
    const gateway = mockGateway(['agent-linux-ci']);
    const dispatcher = createRunnerDispatcher({
      runnerRepository: repo,
      runnerGateway: gateway,
    });
    const resolved = await dispatcher.resolve({
      effectivePolicy: {
        mode: 'auto',
        platform: 'linux',
        labels: ['ci'],
        fallback: 'fail',
      },
      requirements: { capabilities: ['code'] },
    });
    expect(resolved.id).toBe('agent-linux-ci');
    expect(resolved.kind).toBe('agent');
  });

  it('pinned offline agent with fallback=fail throws E2010', async () => {
    const repo = mockRepo({
      findById: vi.fn(async () =>
        agentRunner({ id: 'agent-off', status: 'offline' }),
      ),
    });
    const dispatcher = createRunnerDispatcher({
      runnerRepository: repo,
      runnerGateway: mockGateway([]),
    });
    await expect(
      dispatcher.resolve({
        effectivePolicy: {
          mode: 'pinned',
          runnerId: 'agent-off',
          fallback: 'fail',
        },
      }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof AwfError && err.code === E2010,
    );
  });

  it('pinned offline agent with fallback=embedded falls back', async () => {
    const emb = embeddedRunner();
    const repo = mockRepo({
      findById: vi.fn(async () =>
        agentRunner({ id: 'agent-off', status: 'offline' }),
      ),
      listOnline: vi.fn(async (filter) => {
        if (filter?.kind === 'embedded') return [emb];
        return [];
      }),
    });
    const dispatcher = createRunnerDispatcher({ runnerRepository: repo });
    const resolved = await dispatcher.resolve({
      effectivePolicy: {
        mode: 'pinned',
        runnerId: 'agent-off',
        fallback: 'embedded',
      },
    });
    expect(resolved.kind).toBe('embedded');
    expect(resolved.id).toBe('emb-1');
  });

  it('label mode filters agents by policy labels superset', async () => {
    const emb = embeddedRunner();
    const match = agentRunner({ id: 'gpu-agent', labels: ['ci', 'gpu'] });
    const other = agentRunner({
      id: 'cpu-agent',
      labels: ['ci'],
      runningJobs: 0,
    });
    const repo = mockRepo({
      listOnline: vi.fn(async () => [emb, other, match]),
    });
    const gateway = mockGateway(['gpu-agent', 'cpu-agent']);
    const dispatcher = createRunnerDispatcher({
      runnerRepository: repo,
      runnerGateway: gateway,
    });
    const resolved = await dispatcher.resolve({
      effectivePolicy: {
        mode: 'label',
        labels: ['gpu'],
        fallback: 'fail',
      },
    });
    expect(resolved.id).toBe('gpu-agent');
  });

  it('auto picks agent with http capability when required', async () => {
    const emb = embeddedRunner();
    const agentWithHttp = agentRunner({
      id: 'agent-http',
      capabilities: ['code', 'shell', 'http'],
      runningJobs: 0,
    });
    const agentNoHttp = agentRunner({
      id: 'agent-no-http',
      capabilities: ['code', 'shell'],
      runningJobs: 0,
    });
    const repo = mockRepo({
      listOnline: vi.fn(async () => [emb, agentNoHttp, agentWithHttp]),
    });
    const gateway = mockGateway(['agent-http', 'agent-no-http']);
    const dispatcher = createRunnerDispatcher({
      runnerRepository: repo,
      runnerGateway: gateway,
    });
    const resolved = await dispatcher.resolve({
      effectivePolicy: { mode: 'auto', fallback: 'fail' },
      requirements: { capabilities: ['http'] },
    });
    expect(resolved.id).toBe('agent-http');
    expect(resolved.kind).toBe('agent');
  });

  it('excludes agent that is online in DB but not gateway-connected from auto', async () => {
    const emb = embeddedRunner();
    const disconnected = agentRunner({ id: 'agent-stale' });
    const repo = mockRepo({
      listOnline: vi.fn(async () => [emb, disconnected]),
    });
    const gateway = mockGateway([]);
    const dispatcher = createRunnerDispatcher({
      runnerRepository: repo,
      runnerGateway: gateway,
    });
    await expect(
      dispatcher.resolve({
        effectivePolicy: { mode: 'auto', fallback: 'fail' },
        requirements: { capabilities: ['shell'] },
      }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof AwfError && err.code === E2010,
    );
    expect(gateway.isConnected).toHaveBeenCalledWith('agent-stale');
  });
});
