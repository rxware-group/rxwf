import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { AiRuntime } from '@rxwf/ai-runtime-stub';
import { SATELLITE_NODE_TYPES } from '@rxwf/workflow';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import type { NodeExecutionContext } from '../types/node-executor.js';
import type { PlusExecutorDeps } from './register-plus.js';
import { runSkillTool, skillToolDefinition } from './run-skill-tool.js';

describe('toolSkill satellite registry', () => {
  it('has no standalone executor (satellite only)', async () => {
    const registry = createExecutorRegistry();
    expect(SATELLITE_NODE_TYPES.has('toolSkill')).toBe(true);
    expect(registry.has('toolSkill')).toBe(false);
    await expect(
      registry.execute('toolSkill', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });
});

describe('skillToolDefinition', () => {
  it('builds skill source with path and mode', () => {
    const def = skillToolDefinition(
      {
        id: 'ts1',
        name: 'run_skill',
        parameters: {
          skillPath: 'hello',
          mode: 'single-shot',
          toolDescription: 'Run hello skill',
        },
      },
      {
        skillPath: 'hello',
        mode: 'single-shot',
        toolDescription: 'Run hello skill',
      },
    );
    expect(def.source).toEqual({
      type: 'skill',
      skillPath: 'hello',
      mode: 'single-shot',
    });
    expect(def.description).toBe('Run hello skill');
  });
});

describe('runSkillTool', () => {
  const baseCtx: NodeExecutionContext = {
    config: { workspaceRoot: '/tmp' },
    inputItems: [{ json: {} }],
    executionId: 'exec-1',
    workflowId: 'wf-1',
    nodeId: 'ts1',
  };

  it('throws E3001 when AI runtime is not configured', async () => {
    const deps: PlusExecutorDeps = {};
    await expect(
      runSkillTool(baseCtx, deps, { skillPath: 'hello' }, { task: 'go' }),
    ).rejects.toMatchObject({
      code: 'E3001',
      message: expect.stringContaining('AI runtime'),
    });
  });

  it('throws E1040 when skillPath is missing', async () => {
    const ai = { chat: async function* () {}, runAgent: vi.fn() } as unknown as AiRuntime;
    const deps: PlusExecutorDeps = { ai };
    await expect(
      runSkillTool(baseCtx, deps, { skillPath: '' }, { task: 'go' }),
    ).rejects.toMatchObject({
      code: 'E1040',
      message: expect.stringContaining('skillPath'),
    });
  });

  it('loads skill from workspace and returns agent answer', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rxwf-tool-skill-'));
    const pkg = join(root, '.rxwf', 'skills', 'demo');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, 'SKILL.md'),
      '---\nname: demo\npermissions:\n  - filesystem:read\n---\n\nDo the task.\n',
    );

    const runAgent = vi.fn(async () => ({
      items: [{ json: { answer: 'skill-tool-ok' } }],
    }));
    const ai = { chat: async function* () {}, runAgent } as unknown as AiRuntime;
    const deps: PlusExecutorDeps = { ai };
    const ctx: NodeExecutionContext = {
      ...baseCtx,
      config: { workspaceRoot: root },
    };

    const text = await runSkillTool(
      ctx,
      deps,
      { skillPath: 'demo', mode: 'single-shot' },
      { task: 'run demo skill' },
    );

    expect(text).toBe('skill-tool-ok');
    expect(runAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: 'run demo skill',
        maxIterations: 1,
      }),
      expect.any(Object),
    );
  });
});
