import { copyFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { createWorkflowRunExecutor } from './workflow-run.js';
import { registerSkillExecutors } from './register-skill.js';

const fixturesRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/superpowers/fixtures/workflows',
);

describe('workflow_run registry', () => {
  it('throws E2003 when workflow_run executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('workflow_run', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered when registerSkillExecutors wires createWorkflowRunExecutor', async () => {
    const registry = createExecutorRegistry();
    registerSkillExecutors(registry, {});
    expect(registry.has('workflow_run')).toBe(true);
    expect(createWorkflowRunExecutor({}).type).toBe('workflow_run');
  });
});

describe('workflow_run executor', () => {
  it('throws E1076 when template source missing workflowRelPath', async () => {
    const registry = createExecutorRegistry();
    registerSkillExecutors(registry, {});

    await expect(
      registry.execute('workflow_run', {
        config: { workflowSource: 'template', workspaceRoot: process.cwd() },
        inputItems: [],
        parentExecutionId: 'p1',
      }),
    ).rejects.toMatchObject({ code: 'E1076' });
  });

  it('throws E1076 when published source missing workflowId', async () => {
    const registry = createExecutorRegistry();
    registerSkillExecutors(registry, {
      runSubworkflow: async () => ({
        executionId: 'c1',
        outputItems: [{ json: {} }],
      }),
    });

    await expect(
      registry.execute('workflow_run', {
        config: { workflowSource: 'published' },
        inputItems: [],
        parentExecutionId: 'p1',
      }),
    ).rejects.toMatchObject({ code: 'E1076' });
  });

  it('compiles template when runCompiledWorkflow is not configured', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rxwf-wfr-'));
    const wfDir = join(root, '.rxwf', 'workflows');
    mkdirSync(wfDir, { recursive: true });
    writeFileSync(
      join(wfDir, 'mini.workflow.yaml'),
      `id: mini
name: Mini
steps:
  - id: s1
    skillRef: hello
    promptTemplate: "run"
`,
    );
    mkdirSync(join(root, '.rxwf', 'skills', 'hello'), { recursive: true });
    writeFileSync(
      join(root, '.rxwf', 'skills', 'hello', 'SKILL.md'),
      '---\nname: hello\n---\n\nbody\n',
    );
    writeFileSync(
      join(root, '.rxwf', 'rxwf.project.json'),
      JSON.stringify({ workflows: { enabled: true } }),
    );

    const registry = createExecutorRegistry();
    registerSkillExecutors(registry, {});

    const result = await registry.execute('workflow_run', {
      config: {
        workflowSource: 'template',
        workflowRelPath: 'mini',
        workspaceRoot: root,
      },
      inputItems: [],
      parentExecutionId: 'parent-1',
      workflowDefinition: {
        schemaVersion: 1,
        name: 'parent',
        nodes: [],
        connections: [],
      },
    });

    expect(result.status).toBe('success');
    const json = result.outputItems?.[0]?.[0]?.json as Record<string, unknown>;
    expect(json?.compiled).toBe(true);
  });

  it('throws E1075 when workflows disabled in manifest', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rxwf-wfr2-'));
    mkdirSync(join(root, '.rxwf', 'workflows'), { recursive: true });
    writeFileSync(
      join(root, '.rxwf', 'workflows', 'x.workflow.yaml'),
      'id: x\nname: X\nsteps: []\n',
    );
    writeFileSync(
      join(root, '.rxwf', 'rxwf.project.json'),
      JSON.stringify({ workflows: { enabled: false } }),
    );

    const registry = createExecutorRegistry();
    registerSkillExecutors(registry, {
      runCompiledWorkflow: async () => ({
        executionId: 'c1',
        outputItems: [{ json: {} }],
      }),
    });

    await expect(
      registry.execute('workflow_run', {
        config: {
          workflowSource: 'template',
          workflowRelPath: 'x',
          workspaceRoot: root,
        },
        inputItems: [],
        parentExecutionId: 'p',
      }),
    ).rejects.toMatchObject({ code: 'E1075' });
  });

  it('compiles startcycle fixture and runs via runCompiledWorkflow (AC-S3)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rxwf-wfr-sc-'));
    mkdirSync(join(root, '.rxwf', 'workflows'), { recursive: true });
    copyFileSync(
      join(fixturesRoot, 'startcycle.workflow.yaml'),
      join(root, '.rxwf', 'workflows', 'startcycle.workflow.yaml'),
    );
    writeFileSync(
      join(root, '.rxwf', 'rxwf.project.json'),
      JSON.stringify({ workflows: { enabled: true } }),
    );

    let capturedNodes = 0;
    const registry = createExecutorRegistry();
    registerSkillExecutors(registry, {
      runCompiledWorkflow: async ({ definition }) => {
        capturedNodes = definition.nodes.length;
        return {
          executionId: 'child-exec-1',
          outputItems: [{ json: { from: 'startcycle' } }],
        };
      },
    });

    const result = await registry.execute('workflow_run', {
      config: {
        workflowSource: 'template',
        workflowRelPath: 'startcycle',
        workspaceRoot: root,
      },
      inputItems: [],
      parentExecutionId: 'parent-1',
    });

    expect(result.status).toBe('success');
    expect(capturedNodes).toBe(7);
    const json = result.outputItems?.[0]?.[0]?.json as Record<string, unknown>;
    expect(json?.templateId).toBe('startcycle');
    expect(json?.childExecutionId).toBe('child-exec-1');
  });
});
