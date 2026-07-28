import { describe, expect, it, vi } from 'vitest';
import { runDebugExecution } from './run-debug-execution.js';

describe('runDebugExecution', () => {
  it('runs upstream chain to target node', async () => {
    const executeNodeRun = vi.fn(async (job: { nodeRunId: string }) => ({
      status: 'success' as const,
      outputItems: [[{ json: { node: job.nodeRunId } }]],
      runnerId: 'embedded',
      runnerPlatform: { os: 'linux', arch: 'x64' },
    }));

    const result = await runDebugExecution({
      definition: {
        schemaVersion: 1,
        name: 't',
        nodes: [
          {
            id: 't1',
            type: 'manualTrigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 's1',
            type: 'set',
            name: 'Set',
            position: { x: 200, y: 0 },
            parameters: {},
          },
        ],
        connections: [{ from: 't1', to: 's1' }],
      },
      targetNodeId: 's1',
      executeNodeRun,
    });

    expect(result.status).toBe('success');
    expect(executeNodeRun).toHaveBeenCalledTimes(2);
    expect(result.nodeResults.s1?.itemCount).toBe(1);
    expect(result.nodeResults.s1?.durationMs).toEqual(expect.any(Number));
    expect(result.nodeResults.t1?.durationMs).toEqual(expect.any(Number));
  });

  it('returns upstream success when a later node throws', async () => {
    const executeNodeRun = vi.fn(async (job: { nodeRunId: string }) => {
      if (job.nodeRunId === 'bad') {
        throw new Error("model 'llama3' not found");
      }
      return {
        status: 'success' as const,
        outputItems: [[{ json: { node: job.nodeRunId } }]],
        runnerId: 'embedded',
        runnerPlatform: { os: 'linux', arch: 'x64' },
      };
    });

    const result = await runDebugExecution({
      definition: {
        schemaVersion: 1,
        name: 't',
        nodes: [
          {
            id: 't1',
            type: 'manualTrigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'bad',
            type: 'llm',
            name: 'LLM',
            position: { x: 200, y: 0 },
            parameters: {},
          },
        ],
        connections: [{ from: 't1', to: 'bad' }],
      },
      targetNodeId: 'bad',
      executeNodeRun,
    });

    expect(result.status).toBe('failed');
    expect(result.failedNodeId).toBe('bad');
    expect(result.nodeResults.t1?.status).toBe('success');
    expect(result.nodeResults.bad?.status).toBe('failed');
    expect(result.nodeResults.bad?.errorMessage).toContain('llama3');
  });

  it('calls onNodeResult for each executed node in order', async () => {
    const order: string[] = [];
    const executeNodeRun = vi.fn(async (job: { nodeRunId: string }) => ({
      status: 'success' as const,
      outputItems: [[{ json: { node: job.nodeRunId } }]],
      runnerId: 'embedded',
      runnerPlatform: { os: 'linux', arch: 'x64' },
    }));

    await runDebugExecution({
      definition: {
        schemaVersion: 1,
        name: 't',
        nodes: [
          {
            id: 't1',
            type: 'manualTrigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 's1',
            type: 'set',
            name: 'Set',
            position: { x: 200, y: 0 },
            parameters: {},
          },
          {
            id: 's2',
            type: 'set',
            name: 'Set2',
            position: { x: 400, y: 0 },
            parameters: {},
          },
        ],
        connections: [
          { from: 't1', to: 's1' },
          { from: 's1', to: 's2' },
        ],
      },
      targetNodeId: 's2',
      executeNodeRun,
      onNodeResult: (nodeId) => {
        order.push(nodeId);
      },
    });

    expect(order).toEqual(['t1', 's1', 's2']);
  });

  it('calls onNodeResult for upstream success when later node throws', async () => {
    const callbacks: Array<{ nodeId: string; status: string }> = [];
    const executeNodeRun = vi.fn(async (job: { nodeRunId: string }) => {
      if (job.nodeRunId === 'bad') {
        throw new Error('boom');
      }
      return {
        status: 'success' as const,
        outputItems: [[{ json: {} }]],
        runnerId: 'embedded',
        runnerPlatform: { os: 'linux', arch: 'x64' },
      };
    });

    await runDebugExecution({
      definition: {
        schemaVersion: 1,
        name: 't',
        nodes: [
          {
            id: 't1',
            type: 'manualTrigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'bad',
            type: 'llm',
            name: 'LLM',
            position: { x: 200, y: 0 },
            parameters: {},
          },
        ],
        connections: [{ from: 't1', to: 'bad' }],
      },
      targetNodeId: 'bad',
      executeNodeRun,
      onNodeResult: (nodeId, result) => {
        callbacks.push({ nodeId, status: result.status });
      },
    });

    expect(callbacks).toEqual([
      { nodeId: 't1', status: 'success' },
      { nodeId: 'bad', status: 'failed' },
    ]);
  });

  it('skips downstream when upstream outputs zero items and reports skipped', async () => {
    const executeNodeRun = vi.fn(async (job: { nodeRunId: string }) => {
      if (job.nodeRunId === 'empty') {
        return {
          status: 'success' as const,
          outputItems: [[]],
          runnerId: 'embedded',
          runnerPlatform: { os: 'linux', arch: 'x64' },
        };
      }
      return {
        status: 'success' as const,
        outputItems: [[{ json: {} }]],
        runnerId: 'embedded',
        runnerPlatform: { os: 'linux', arch: 'x64' },
      };
    });

    const result = await runDebugExecution({
      definition: {
        schemaVersion: 1,
        name: 't',
        nodes: [
          {
            id: 't1',
            type: 'manualTrigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'empty',
            type: 'set',
            name: 'Empty',
            position: { x: 200, y: 0 },
            parameters: {},
          },
          {
            id: 'down',
            type: 'httpRequest',
            name: 'HTTP',
            position: { x: 400, y: 0 },
            parameters: {},
          },
        ],
        connections: [
          { from: 't1', to: 'empty' },
          { from: 'empty', to: 'down' },
        ],
      },
      targetNodeId: 'down',
      executeNodeRun,
    });

    expect(result.status).toBe('success');
    expect(executeNodeRun).toHaveBeenCalledTimes(2);
    expect(result.nodeResults.down?.status).toBe('skipped');
    expect(result.nodeResults.down?.itemCount).toBe(0);
  });

  it('skips true-branch target when IF is pinned with branch-aware output', async () => {
    const executeNodeRun = vi.fn(async (job: { nodeRunId: string }) => ({
      status: 'success' as const,
      outputItems: [[{ json: { node: job.nodeRunId } }]],
      runnerId: 'embedded',
      runnerPlatform: { os: 'linux', arch: 'x64' },
    }));

    const result = await runDebugExecution({
      definition: {
        schemaVersion: 1,
        name: 'if-partial',
        nodes: [
          {
            id: 't1',
            type: 'manualTrigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'if1',
            type: 'if',
            name: 'If',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'codeTrue',
            type: 'code',
            name: 'Code True',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'codeFalse',
            type: 'code',
            name: 'Code False',
            position: { x: 0, y: 0 },
            parameters: {},
          },
        ],
        connections: [
          { from: 't1', to: 'if1' },
          { from: 'if1', to: 'codeTrue', fromOutput: '0' },
          { from: 'if1', to: 'codeFalse', fromOutput: '1' },
        ],
      },
      targetNodeId: 'codeTrue',
      pinData: {
        t1: [{ json: { seed: true } }],
      },
      pinBranchData: {
        if1: [[], [{ json: { onFalse: true } }]],
      },
      executeNodeRun,
    });

    expect(result.status).toBe('success');
    expect(executeNodeRun).not.toHaveBeenCalled();
    expect(result.nodeResults.codeTrue?.status).toBe('skipped');
  });

  it('propagates skipped to off-path true branch when target is IF', async () => {
    const executeNodeRun = vi.fn(async (job: { nodeRunId: string }) => {
      if (job.nodeRunId === 'if1') {
        return {
          status: 'success' as const,
          outputItems: [[], [{ json: { onFalse: true } }]],
          runnerId: 'embedded',
          runnerPlatform: { os: 'linux', arch: 'x64' },
        };
      }
      return {
        status: 'success' as const,
        outputItems: [[{ json: { node: job.nodeRunId } }]],
        runnerId: 'embedded',
        runnerPlatform: { os: 'linux', arch: 'x64' },
      };
    });

    const callbacks: { nodeId: string; status: string }[] = [];
    const result = await runDebugExecution({
      definition: {
        schemaVersion: 1,
        name: 'if-target',
        nodes: [
          {
            id: 't1',
            type: 'manualTrigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'if1',
            type: 'if',
            name: 'If',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'codeTrue',
            type: 'code',
            name: 'Code True',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'codeFalse',
            type: 'code',
            name: 'Code False',
            position: { x: 0, y: 0 },
            parameters: {},
          },
        ],
        connections: [
          { from: 't1', to: 'if1' },
          { from: 'if1', to: 'codeTrue', fromOutput: '0' },
          { from: 'if1', to: 'codeFalse', fromOutput: '1' },
        ],
      },
      targetNodeId: 'if1',
      pinData: {
        t1: [{ json: { seed: true } }],
      },
      executeNodeRun,
      onNodeResult: (nodeId, r) => {
        callbacks.push({ nodeId, status: r.status });
      },
    });

    expect(result.status).toBe('success');
    expect(executeNodeRun).toHaveBeenCalledTimes(1);
    expect(executeNodeRun).toHaveBeenCalledWith(
      expect.objectContaining({ nodeRunId: 'if1' }),
    );
    expect(result.nodeResults.codeTrue?.status).toBe('skipped');
    expect(callbacks.some((c) => c.nodeId === 'codeTrue' && c.status === 'skipped')).toBe(
      true,
    );
  });

  it('runs loop body per input item and aggregates on done output', async () => {
    const callCounts = new Map<string, number>();
    const executeNodeRun = vi.fn(async (job: { nodeRunId: string; inputItems: { json: unknown }[] }) => {
      callCounts.set(job.nodeRunId, (callCounts.get(job.nodeRunId) ?? 0) + 1);
      const item = job.inputItems[0]?.json ?? {};
      return {
        status: 'success' as const,
        outputItems: [[{ json: { ...item, via: job.nodeRunId } }]],
        runnerId: 'embedded',
        runnerPlatform: { os: 'linux', arch: 'x64' },
      };
    });

    const result = await runDebugExecution({
      definition: {
        schemaVersion: 1,
        name: 'loop-debug',
        nodes: [
          {
            id: 't1',
            type: 'manualTrigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'loop1',
            type: 'loop',
            name: 'Loop',
            position: { x: 100, y: 0 },
            parameters: { batchSize: 1 },
          },
          {
            id: 'setA',
            type: 'set',
            name: 'A',
            position: { x: 200, y: 0 },
            parameters: {},
          },
          {
            id: 'setDone',
            type: 'set',
            name: 'Done',
            position: { x: 300, y: 0 },
            parameters: {},
          },
        ],
        connections: [
          { from: 't1', to: 'loop1' },
          { from: 'loop1', to: 'setA', fromOutput: '0' },
          { from: 'setA', to: 'setDone' },
          { from: 'loop1', to: 'setDone', fromOutput: '1' },
        ],
      },
      targetNodeId: 'loop1',
      pinData: {
        t1: [{ json: { a: 0 } }, { json: { a: 1 } }],
      },
      executeNodeRun,
    });

    expect(result.status).toBe('success');
    expect(callCounts.get('setA')).toBe(2);
    expect(result.nodeResults.loop1?.outputItems?.[1]).toHaveLength(2);
    expect(result.nodeResults.loop1?.loopIterationCount).toBe(2);
    expect(result.nodeResults.loop1?.loopBatchItemCount).toBe(1);
    expect(result.nodeResults.loop1?.outputItems?.[1]?.[0]?.json).toMatchObject({
      a: 0,
      via: 'setA',
    });
    expect(executeNodeRun).not.toHaveBeenCalledWith(
      expect.objectContaining({ nodeRunId: 'loop1' }),
    );
  });

  it('emits loopIteration metadata for each loop body execution', async () => {
    const callbacks: Array<{ nodeId: string; loopIteration?: { round: number } }> = [];
    const executeNodeRun = vi.fn(async () => ({
      status: 'success' as const,
      outputItems: [[{ json: { ok: true } }]],
      runnerId: 'embedded',
      runnerPlatform: { os: 'linux', arch: 'x64' },
    }));

    await runDebugExecution({
      definition: {
        schemaVersion: 1,
        name: 'loop-debug',
        nodes: [
          {
            id: 't1',
            type: 'manualTrigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'loop1',
            type: 'loop',
            name: 'Loop',
            position: { x: 100, y: 0 },
            parameters: { batchSize: 1 },
          },
          {
            id: 'setA',
            type: 'set',
            name: 'A',
            position: { x: 200, y: 0 },
            parameters: {},
          },
        ],
        connections: [
          { from: 't1', to: 'loop1' },
          { from: 'loop1', to: 'setA', fromOutput: '0' },
        ],
      },
      targetNodeId: 'loop1',
      pinData: {
        t1: [{ json: { a: 0 } }, { json: { a: 1 } }],
      },
      executeNodeRun,
      onNodeResult: (nodeId, result) => {
        if (result.loopIteration) {
          callbacks.push({ nodeId, loopIteration: result.loopIteration });
        }
      },
    });

    expect(callbacks).toEqual([
      { nodeId: 'setA', loopIteration: expect.objectContaining({ round: 1, totalRounds: 2 }) },
      { nodeId: 'setA', loopIteration: expect.objectContaining({ round: 2, totalRounds: 2 }) },
    ]);
  });

  it('targets done-branch node when loop body connects back to loop (no stack overflow)', async () => {
    const executeNodeRun = vi.fn(async (job: { nodeRunId: string }) => ({
      status: 'success' as const,
      outputItems: [[{ json: { node: job.nodeRunId } }]],
      runnerId: 'embedded',
      runnerPlatform: { os: 'linux', arch: 'x64' },
    }));

    const result = await runDebugExecution({
      definition: {
        schemaVersion: 1,
        name: 'loop-back-edge',
        nodes: [
          {
            id: 'm1',
            type: 'manualTrigger',
            name: 'Manual',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'l1',
            type: 'loop',
            name: 'Loop',
            position: { x: 200, y: 0 },
            parameters: { batchSize: 1 },
          },
          {
            id: 'ec1',
            type: 'executeCommand',
            name: 'Execute Command',
            position: { x: 400, y: 100 },
            parameters: { command: 'echo', args: ['loop'] },
          },
          {
            id: 'ec2',
            type: 'executeCommand',
            name: 'Execute Command 2',
            position: { x: 400, y: -100 },
            parameters: { command: 'echo', args: ['done'] },
          },
        ],
        connections: [
          { from: 'm1', to: 'l1' },
          { from: 'l1', to: 'ec1', fromOutput: '0' },
          { from: 'ec1', to: 'l1' },
          { from: 'l1', to: 'ec2', fromOutput: '1' },
        ],
      },
      targetNodeId: 'ec2',
      executeNodeRun,
    });

    expect(result.status).toBe('success');
    expect(result.nodeResults.ec2?.status).toBe('success');
    expect(result.nodeResults.l1?.status).toBe('success');
    expect(executeNodeRun).toHaveBeenCalled();
    const calledIds = executeNodeRun.mock.calls.map((c) => c[0].nodeRunId);
    expect(calledIds).toContain('m1');
    expect(calledIds).toContain('ec2');
    expect(calledIds).toContain('ec1');
  });

  it('runs loop body twice when manual has 2 items and body feeds back to loop', async () => {
    const bodyCallCounts = { ec1: 0 };
    const executeNodeRun = vi.fn(async (job: { nodeRunId: string }) => {
      if (job.nodeRunId === 'ec1') bodyCallCounts.ec1 += 1;
      return {
        status: 'success' as const,
        outputItems: [[{ json: { node: job.nodeRunId } }]],
        runnerId: 'embedded',
        runnerPlatform: { os: 'linux', arch: 'x64' },
      };
    });

    const result = await runDebugExecution({
      definition: {
        schemaVersion: 1,
        name: 'loop-back-edge-2-items',
        nodes: [
          {
            id: 'm1',
            type: 'manualTrigger',
            name: 'Manual',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'l1',
            type: 'loop',
            name: 'Loop',
            position: { x: 200, y: 0 },
            parameters: { batchSize: 1 },
          },
          {
            id: 'ec1',
            type: 'executeCommand',
            name: 'Execute Command',
            position: { x: 400, y: 100 },
            parameters: { command: 'echo', args: ['loop'] },
          },
          {
            id: 'ec2',
            type: 'executeCommand',
            name: 'Execute Command 2',
            position: { x: 400, y: -100 },
            parameters: { command: 'echo', args: ['done'] },
          },
        ],
        connections: [
          { from: 'm1', to: 'l1' },
          { from: 'l1', to: 'ec1', fromOutput: '0' },
          { from: 'ec1', to: 'l1' },
          { from: 'l1', to: 'ec2', fromOutput: '1' },
        ],
      },
      targetNodeId: 'ec2',
      pinData: {
        m1: [{ json: { a: 0 } }, { json: { a: 1 } }],
        ec1: [{ json: { stdout: 'pinned-body-output' } }],
      },
      executeNodeRun,
    });

    expect(result.status).toBe('success');
    expect(result.nodeResults.l1?.loopIterationCount).toBe(2);
    expect(bodyCallCounts.ec1).toBe(2);
  });
});
