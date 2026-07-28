import { describe, it, expect, vi } from 'vitest';
import { createExecutionEngine, type NodeRunJob } from './execution-engine.js';

describe('createExecutionEngine', () => {
  it('runs nodes in topological order via NodeRunnerFacade', async () => {
    const order: string[] = [];
    const executeNodeRun = vi.fn(async (job: NodeRunJob) => {
      order.push(job.nodeRunId);
      return {
        status: 'success' as const,
        outputItems: [[{ json: { node: job.nodeRunId } }]],
        runnerId: 'emb-1',
        runnerPlatform: { os: 'linux', arch: 'x64' },
      };
    });
    const engine = createExecutionEngine({ executeNodeRun });
    const result = await engine.run({
      executionId: 'ex-1',
      mode: 'production',
      startNodeId: 'a',
      graph: {
        nodes: [
          { id: 'a', name: 'A', type: 'set', config: {} },
          { id: 'b', name: 'B', type: 'set', config: {} },
        ],
        edges: [{ from: 'a', to: 'b' }],
        startNodeId: 'a',
      },
      initialItems: [{ json: { seed: true } }],
    });
    expect(result.status).toBe('success');
    expect(order).toEqual(['a', 'b']);
    expect(executeNodeRun).toHaveBeenCalledTimes(2);
    const secondCall = executeNodeRun.mock.calls[1]![0];
    expect(secondCall.inputItems).toEqual([{ json: { node: 'a' } }]);
    expect(secondCall.nodes).toEqual([
      { name: 'A', json: { node: 'a' }, items: [{ json: { node: 'a' } }] },
    ]);
  });

  it('stops with failed when a node returns failed', async () => {
    const executeNodeRun = vi.fn(async (job: NodeRunJob) => {
      if (job.nodeRunId === 'b') {
        return {
          status: 'failed' as const,
          errorCode: 'E2003',
          errorMessage: 'boom',
          runnerId: 'emb-1',
          runnerPlatform: { os: 'linux', arch: 'x64' },
        };
      }
      return {
        status: 'success' as const,
        outputItems: [[{ json: {} }]],
        runnerId: 'emb-1',
        runnerPlatform: { os: 'linux', arch: 'x64' },
      };
    });
    const engine = createExecutionEngine({ executeNodeRun });
    const result = await engine.run({
      executionId: 'ex-1',
      mode: 'production',
      startNodeId: 'a',
      graph: {
        nodes: [
          { id: 'a', name: 'A', type: 'set', config: {} },
          { id: 'b', name: 'B', type: 'set', config: {} },
        ],
        edges: [{ from: 'a', to: 'b' }],
        startNodeId: 'a',
      },
      initialItems: [{ json: {} }],
    });
    expect(result.status).toBe('failed');
    expect(executeNodeRun).toHaveBeenCalledTimes(2);
  });

  it('skips downstream when upstream main output has zero items', async () => {
    const executeNodeRun = vi.fn(async (job: NodeRunJob) => {
      if (job.nodeRunId === 'set1') {
        return {
          status: 'success' as const,
          outputItems: [[]],
          runnerId: 'emb-1',
          runnerPlatform: { os: 'linux', arch: 'x64' },
        };
      }
      return {
        status: 'success' as const,
        outputItems: [[{ json: { shouldNotRun: true } }]],
        runnerId: 'emb-1',
        runnerPlatform: { os: 'linux', arch: 'x64' },
      };
    });
    const engine = createExecutionEngine({ executeNodeRun });
    const result = await engine.run({
      executionId: 'ex-1',
      mode: 'production',
      startNodeId: 'set1',
      graph: {
        nodes: [
          { id: 'set1', name: 'Set', type: 'set', config: {} },
          { id: 'http1', name: 'HTTP', type: 'httpRequest', config: {} },
        ],
        edges: [{ from: 'set1', to: 'http1' }],
        startNodeId: 'set1',
      },
      initialItems: [{ json: { seed: true } }],
    });
    expect(result.status).toBe('success');
    expect(executeNodeRun).toHaveBeenCalledTimes(1);
    expect(executeNodeRun.mock.calls[0]![0].nodeRunId).toBe('set1');
  });

  it('skips downstream on empty if branch only', async () => {
    const executeNodeRun = vi.fn(async (job: NodeRunJob) => {
      if (job.nodeRunId === 'if1') {
        return {
          status: 'success' as const,
          outputItems: [[], [{ json: { onFalse: true } }]],
          runnerId: 'emb-1',
          runnerPlatform: { os: 'linux', arch: 'x64' },
        };
      }
      return {
        status: 'success' as const,
        outputItems: [[{ json: { ran: job.nodeRunId } }]],
        runnerId: 'emb-1',
        runnerPlatform: { os: 'linux', arch: 'x64' },
      };
    });
    const engine = createExecutionEngine({ executeNodeRun });
    await engine.run({
      executionId: 'ex-1',
      mode: 'production',
      startNodeId: 't1',
      graph: {
        nodes: [
          { id: 't1', name: 'Start', type: 'manualTrigger', config: {} },
          { id: 'if1', name: 'IF', type: 'if', config: {} },
          { id: 'trueDown', name: 'TrueDown', type: 'set', config: {} },
          { id: 'falseDown', name: 'FalseDown', type: 'set', config: {} },
        ],
        edges: [
          { from: 't1', to: 'if1' },
          { from: 'if1', to: 'trueDown', outputIndex: 0 },
          { from: 'if1', to: 'falseDown', outputIndex: 1 },
        ],
        startNodeId: 't1',
      },
      initialItems: [{ json: { x: 1 } }],
    });
    const ranIds = executeNodeRun.mock.calls.map((c) => c[0].nodeRunId);
    expect(ranIds).toContain('t1');
    expect(ranIds).toContain('if1');
    expect(ranIds).not.toContain('trueDown');
    expect(ranIds).toContain('falseDown');
  });

  it('runs independent branches concurrently before merge', async () => {
    let bStart = 0;
    let bEnd = 0;
    let cStart = 0;
    const executeNodeRun = vi.fn(async (job: NodeRunJob) => {
      if (job.nodeRunId === 'b') {
        bStart = Date.now();
        await new Promise((r) => setTimeout(r, 60));
        bEnd = Date.now();
      }
      if (job.nodeRunId === 'c') {
        cStart = Date.now();
        await new Promise((r) => setTimeout(r, 60));
      }
      return {
        status: 'success' as const,
        outputItems: [[{ json: { node: job.nodeRunId } }]],
        runnerId: 'emb-1',
        runnerPlatform: { os: 'linux', arch: 'x64' },
      };
    });
    const engine = createExecutionEngine({ executeNodeRun });
    const result = await engine.run({
      executionId: 'ex-concurrent',
      mode: 'production',
      startNodeId: 'a',
      graph: {
        nodes: [
          { id: 'a', name: 'A', type: 'set', config: {} },
          { id: 'b', name: 'B', type: 'set', config: {} },
          { id: 'c', name: 'C', type: 'set', config: {} },
          { id: 'd', name: 'D', type: 'merge', config: {} },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'a', to: 'c' },
          { from: 'b', to: 'd' },
          { from: 'c', to: 'd' },
        ],
        startNodeId: 'a',
      },
      initialItems: [{ json: { seed: true } }],
    });
    expect(result.status).toBe('success');
    expect(executeNodeRun).toHaveBeenCalledTimes(4);
    // c 在 b 完成前已开始，说明分支并发执行
    expect(cStart).toBeGreaterThan(0);
    expect(bEnd).toBeGreaterThan(0);
    expect(cStart).toBeLessThan(bEnd);
  });

  it('runs loop body once per input item and aggregates on done output', async () => {
    const callCounts = new Map<string, number>();
    const executeNodeRun = vi.fn(async (job: NodeRunJob) => {
      callCounts.set(job.nodeRunId, (callCounts.get(job.nodeRunId) ?? 0) + 1);
      const item = job.inputItems[0]?.json ?? {};
      return {
        status: 'success' as const,
        outputItems: [[{ json: { ...item, via: job.nodeRunId } }]],
        runnerId: 'emb-1',
        runnerPlatform: { os: 'linux', arch: 'x64' },
      };
    });
    const engine = createExecutionEngine({ executeNodeRun });
    const result = await engine.run({
      executionId: 'ex-loop',
      mode: 'production',
      startNodeId: 'loop1',
      graph: {
        nodes: [
          { id: 'loop1', name: 'Loop', type: 'loop', config: { batchSize: 1 } },
          { id: 'setA', name: 'A', type: 'set', config: {} },
          { id: 'setB', name: 'B', type: 'set', config: {} },
          { id: 'setDone', name: 'Done', type: 'set', config: {} },
        ],
        edges: [
          { from: 'loop1', to: 'setA', outputIndex: 0 },
          { from: 'setA', to: 'setB' },
          { from: 'loop1', to: 'setDone', outputIndex: 1 },
        ],
        startNodeId: 'loop1',
      },
      initialItems: [{ json: { i: 1 } }, { json: { i: 2 } }],
    });
    expect(result.status).toBe('success');
    expect(callCounts.get('setA')).toBe(2);
    expect(callCounts.get('setB')).toBe(2);
    expect(callCounts.get('setDone')).toBe(1);
    const doneCall = executeNodeRun.mock.calls.find((c) => c[0].nodeRunId === 'setDone');
    expect(doneCall?.[0].inputItems).toHaveLength(2);
  });

  it('loop with empty input produces empty done branch', async () => {
    const executeNodeRun = vi.fn(async (job: NodeRunJob) => ({
      status: 'success' as const,
      outputItems: [[{ json: { node: job.nodeRunId } }]],
      runnerId: 'emb-1',
      runnerPlatform: { os: 'linux', arch: 'x64' },
    }));
    const engine = createExecutionEngine({ executeNodeRun });
    await engine.run({
      executionId: 'ex-loop-empty',
      mode: 'production',
      startNodeId: 'loop1',
      graph: {
        nodes: [
          { id: 'loop1', name: 'Loop', type: 'loop', config: {} },
          { id: 'setA', name: 'A', type: 'set', config: {} },
          { id: 'setDone', name: 'Done', type: 'set', config: {} },
        ],
        edges: [
          { from: 'loop1', to: 'setA', outputIndex: 0 },
          { from: 'loop1', to: 'setDone', outputIndex: 1 },
        ],
        startNodeId: 'loop1',
      },
      initialItems: [],
    });
    const ranIds = executeNodeRun.mock.calls.map((c) => c[0].nodeRunId);
    expect(ranIds).not.toContain('setA');
    expect(ranIds).not.toContain('setDone');
  });
});
