import { describe, it, expect, vi } from 'vitest';
import type {
  RunnerGatewayPort,
  RunnerRepositoryPort,
  RunnerRecord,
} from '@rxwf/providers-contracts';
import { E2010 } from '@rxwf/runner-protocol';
import { AwfError } from '@rxwf/shared';
import { createNodeRunnerFacade } from './node-runner-facade.js';
import { DEFAULT_REMOTE_JOB_TIMEOUT_MS } from './to-remote-job.js';

function embedded(): RunnerRecord {
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
    runningJobs: 0,
    ...overrides,
  };
}

function mockRepo(overrides: Partial<RunnerRepositoryPort> = {}): RunnerRepositoryPort {
  const emb = embedded();
  return {
    ensureEmbedded: vi.fn(),
    listOnline: vi.fn(async (filter) => {
      if (filter?.kind === 'embedded') return [emb];
      return [emb, agentRunner()];
    }),
    listAll: vi.fn(async () => [emb]),
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
    dispatchAndWait: vi.fn(async () => ({
      jobId: 'remote-job-1',
      status: 'success' as const,
      outputItems: [[{ json: { remote: true } }]],
      durationMs: 42,
    })),
    notifyDrain: vi.fn(),
    kickConnection: vi.fn(),
    listOnlineCrewAiSidecarUrls: vi.fn(() => []),
    getCrewAiSidecarUrl: vi.fn(),
    invokeTool: vi.fn(async () => ({
      invokeId: 'tool-1',
      status: 'success' as const,
      result: '',
      durationMs: 1,
    })),
  };
}

describe('NodeRunnerFacade', () => {
  it('executeNodeRun writes runner id from resolved runner', async () => {
    const repo = mockRepo();
    const facade = createNodeRunnerFacade({ runnerRepository: repo });
    const resolved = await facade.resolveRunner({
      effectivePolicy: { mode: 'embedded' },
    });
    const stubExecute = vi.fn(async () => ({
      status: 'success' as const,
      outputItems: [[{ json: { ok: true } }]],
    }));
    const registry = { execute: stubExecute, register: vi.fn() };
    const result = await facade.executeNodeRun(
      {
        executionId: 'ex-1',
        nodeRunId: 'nr-1',
        nodeType: 'set',
        nodeConfig: { fields: { a: 1 } },
        inputItems: [{ json: {} }],
        workflowSettings: {},
        mode: 'production',
      },
      { registry: registry as never, resolvedRunner: resolved },
    );
    expect(result.runnerId).toBe('emb-1');
    expect(result.runnerPlatform.os).toBe('linux');
    expect(stubExecute).toHaveBeenCalledWith('set', expect.any(Object));
  });

  it('code + agent runner dispatches remotely and tracks running jobs', async () => {
    const agent = agentRunner();
    const repo = mockRepo({
      listOnline: vi.fn(async () => [embedded(), agent]),
    });
    const gateway = mockGateway(['agent-1']);
    const facade = createNodeRunnerFacade({
      runnerRepository: repo,
      runnerGateway: gateway,
    });
    const stubExecute = vi.fn();
    const registry = { execute: stubExecute, register: vi.fn() };

    const result = await facade.executeNodeRun(
      {
        executionId: 'ex-1',
        nodeRunId: 'nr-1',
        nodeType: 'code',
        nodeConfig: { jsCode: 'return items;' },
        inputItems: [{ json: {} }],
        workflowSettings: {},
        mode: 'production',
        effectivePolicy: { mode: 'auto', fallback: 'fail' },
      },
      { registry: registry as never },
    );

    expect(result.runnerId).toBe('agent-1');
    expect(result.status).toBe('success');
    expect(result.outputItems).toEqual([[{ json: { remote: true } }]]);
    expect(stubExecute).not.toHaveBeenCalled();
    expect(gateway.dispatchAndWait).toHaveBeenCalledOnce();
    expect(gateway.dispatchAndWait).toHaveBeenCalledWith(
      'agent-1',
      expect.objectContaining({
        executionId: 'ex-1',
        nodeRunId: 'nr-1',
        nodeType: 'code',
        timeoutMs: DEFAULT_REMOTE_JOB_TIMEOUT_MS,
      }),
      { timeoutMs: DEFAULT_REMOTE_JOB_TIMEOUT_MS },
    );
    expect(repo.incrementRunningJobs).toHaveBeenCalledWith('agent-1', +1);
    expect(repo.incrementRunningJobs).toHaveBeenCalledWith('agent-1', -1);
  });

  it('httpRequest with agent policy dispatches remotely', async () => {
    const agent = agentRunner({ capabilities: ['code', 'shell', 'http'] });
    const repo = mockRepo({
      listOnline: vi.fn(async () => [embedded(), agent]),
    });
    const gateway = mockGateway(['agent-1']);
    const facade = createNodeRunnerFacade({
      runnerRepository: repo,
      runnerGateway: gateway,
    });
    const stubExecute = vi.fn();
    const registry = { execute: stubExecute, register: vi.fn() };

    const result = await facade.executeNodeRun(
      {
        executionId: 'ex-1',
        nodeRunId: 'nr-1',
        nodeType: 'httpRequest',
        nodeConfig: { url: 'https://example.com' },
        inputItems: [{ json: {} }],
        workflowSettings: {},
        mode: 'production',
        effectivePolicy: { mode: 'auto', fallback: 'fail' },
        runnerRequirements: { capabilities: ['http'] },
      },
      { registry: registry as never },
    );

    expect(result.runnerId).toBe('agent-1');
    expect(result.status).toBe('success');
    expect(stubExecute).not.toHaveBeenCalled();
    expect(gateway.dispatchAndWait).toHaveBeenCalledOnce();
    expect(gateway.dispatchAndWait).toHaveBeenCalledWith(
      'agent-1',
      expect.objectContaining({
        nodeType: 'httpRequest',
        nodeConfig: expect.not.objectContaining({ credentialId: expect.anything() }),
      }),
      { timeoutMs: DEFAULT_REMOTE_JOB_TIMEOUT_MS },
    );
    expect(repo.incrementRunningJobs).toHaveBeenCalledWith('agent-1', +1);
    expect(repo.incrementRunningJobs).toHaveBeenCalledWith('agent-1', -1);
  });

  it('readWriteFile with agent policy dispatches remotely', async () => {
    const agent = agentRunner({ capabilities: ['code', 'shell', 'http', 'file'] });
    const repo = mockRepo({
      listOnline: vi.fn(async () => [embedded(), agent]),
    });
    const gateway = mockGateway(['agent-1']);
    const facade = createNodeRunnerFacade({
      runnerRepository: repo,
      runnerGateway: gateway,
    });
    const stubExecute = vi.fn();
    const registry = { execute: stubExecute, register: vi.fn() };

    const result = await facade.executeNodeRun(
      {
        executionId: 'ex-1',
        nodeRunId: 'nr-1',
        nodeType: 'readWriteFile',
        nodeConfig: { operation: 'read', path: '/tmp/example.txt' },
        inputItems: [{ json: {} }],
        workflowSettings: {},
        mode: 'production',
        effectivePolicy: { mode: 'auto', fallback: 'fail' },
        runnerRequirements: { capabilities: ['file'] },
      },
      { registry: registry as never },
    );

    expect(result.runnerId).toBe('agent-1');
    expect(result.status).toBe('success');
    expect(stubExecute).not.toHaveBeenCalled();
    expect(gateway.dispatchAndWait).toHaveBeenCalledOnce();
    expect(gateway.dispatchAndWait).toHaveBeenCalledWith(
      'agent-1',
      expect.objectContaining({
        nodeType: 'readWriteFile',
        nodeConfig: { operation: 'read', path: '/tmp/example.txt' },
      }),
      { timeoutMs: DEFAULT_REMOTE_JOB_TIMEOUT_MS },
    );
  });

  it('node pinned offline agent throws E2010 (forced fail fallback)', async () => {
    const offlineAgent = agentRunner({ id: 'agent-off', status: 'offline' });
    const repo = mockRepo({
      listOnline: vi.fn(async () => [embedded()]),
      findById: vi.fn(async (id: string) =>
        id === 'agent-off' ? offlineAgent : null,
      ),
    });
    const gateway = mockGateway([]);
    const facade = createNodeRunnerFacade({
      runnerRepository: repo,
      runnerGateway: gateway,
    });
    const stubExecute = vi.fn();
    const registry = { execute: stubExecute, register: vi.fn() };

    await expect(
      facade.executeNodeRun(
        {
          executionId: 'ex-1',
          nodeRunId: 'nr-1',
          nodeType: 'code',
          nodeConfig: { jsCode: 'return items;' },
          inputItems: [{ json: {} }],
          workflowSettings: {},
          mode: 'production',
          effectivePolicy: { mode: 'pinned', runnerId: 'agent-off', fallback: 'fail' },
        },
        { registry: registry as never },
      ),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof AwfError && err.code === E2010,
    );
    expect(stubExecute).not.toHaveBeenCalled();
    expect(gateway.dispatchAndWait).not.toHaveBeenCalled();
  });

  it('falls back to embedded for set when agent has no matching capability requirement', async () => {
    const agent = agentRunner({ capabilities: ['shell'] });
    const emb = embedded();
    const repo = mockRepo({
      listOnline: vi.fn(async () => [emb, agent]),
    });
    const gateway = mockGateway(['agent-1']);
    const facade = createNodeRunnerFacade({
      runnerRepository: repo,
      runnerGateway: gateway,
    });
    const stubExecute = vi.fn(async () => ({
      status: 'success' as const,
      outputItems: [[{ json: { ok: true } }]],
    }));
    const registry = { execute: stubExecute, register: vi.fn() };

    const result = await facade.executeNodeRun(
      {
        executionId: 'ex-1',
        nodeRunId: 'nr-1',
        nodeType: 'set',
        nodeConfig: {},
        inputItems: [{ json: {} }],
        workflowSettings: {},
        mode: 'production',
        effectivePolicy: { mode: 'auto', fallback: 'fail' },
      },
      { registry: registry as never },
    );

    expect(result.status).toBe('success');
    expect(stubExecute).toHaveBeenCalled();
    expect(gateway.dispatchAndWait).not.toHaveBeenCalled();
  });
});
