import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseAntigravityWorkflowYaml } from './adapters/antigravity-workflow-adapter.js';
import { WorkflowCompiler } from './workflow-compiler.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(here, '../../../../docs/superpowers/fixtures/workflows');

describe('WorkflowCompiler', () => {
  it('parses Antigravity startcycle YAML', () => {
    const raw = readFileSync(join(fixturesRoot, 'startcycle.workflow.yaml'), 'utf8');
    const ir = parseAntigravityWorkflowYaml(raw);
    expect(ir.id).toBe('startcycle');
    expect(ir.steps).toHaveLength(4);
    expect(ir.steps[0]?.gate?.type).toBe('human_approval');
  });

  it('compileMode linear_skillRun matches fixture JSON', () => {
    const raw = readFileSync(join(fixturesRoot, 'startcycle.workflow.yaml'), 'utf8');
    const ir = parseAntigravityWorkflowYaml(raw);
    const expected = JSON.parse(
      readFileSync(join(fixturesRoot, 'startcycle.compiled.linear_skillRun.json'), 'utf8'),
    );
    const compiled = new WorkflowCompiler().compile(ir, { compileMode: 'linear_skillRun' });
    expect(compiled).toEqual(expected);
  });
});
