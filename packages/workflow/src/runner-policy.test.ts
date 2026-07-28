import { describe, expect, it } from 'vitest';
import {
  GLOBAL_DEFAULT_RUNNER_POLICY,
  resolveEffectiveRunnerPolicy,
} from './runner-policy.js';

describe('resolveEffectiveRunnerPolicy', () => {
  it('defaults to embedded when workflow and node unset', () => {
    expect(resolveEffectiveRunnerPolicy({})).toEqual({ mode: 'embedded' });
    expect(GLOBAL_DEFAULT_RUNNER_POLICY).toEqual({ mode: 'embedded' });
  });

  it('inherits workflow pinned when node mode is inherit', () => {
    expect(
      resolveEffectiveRunnerPolicy({
        workflowRunnerPolicy: { mode: 'pinned', runnerId: 'agent-1' },
        nodeRunner: { mode: 'inherit' },
      }),
    ).toEqual({ mode: 'pinned', runnerId: 'agent-1' });
  });

  it('node pinned overrides workflow pinned with fail fallback', () => {
    expect(
      resolveEffectiveRunnerPolicy({
        workflowRunnerPolicy: { mode: 'pinned', runnerId: 'agent-1', fallback: 'embedded' },
        nodeRunner: { mode: 'pinned', runnerId: 'agent-2' },
      }),
    ).toEqual({ mode: 'pinned', runnerId: 'agent-2', fallback: 'fail' });
  });

  it('node auto merges platform and labels over workflow when set', () => {
    expect(
      resolveEffectiveRunnerPolicy({
        workflowRunnerPolicy: {
          mode: 'auto',
          platform: 'linux',
          labels: ['prod'],
          fallback: 'fail',
        },
        nodeRunner: { mode: 'auto', platform: 'windows', labels: ['ci'] },
      }),
    ).toEqual({
      mode: 'auto',
      platform: 'windows',
      labels: ['ci'],
      fallback: 'fail',
    });
  });

  it('node auto inherits workflow platform and labels when unset', () => {
    expect(
      resolveEffectiveRunnerPolicy({
        workflowRunnerPolicy: { mode: 'auto', platform: 'linux', labels: ['prod'] },
        nodeRunner: { mode: 'auto' },
      }),
    ).toEqual({ mode: 'auto', platform: 'linux', labels: ['prod'], fallback: 'embedded' });
  });

  it('normalizes legacy node label mode to auto', () => {
    expect(
      resolveEffectiveRunnerPolicy({
        workflowRunnerPolicy: { mode: 'auto', fallback: 'fail' },
        nodeRunner: { mode: 'label', labels: ['ci'] },
      }),
    ).toEqual({ mode: 'auto', labels: ['ci'], fallback: 'fail' });
  });

  it('inherits workflow auto labels when node mode is inherit', () => {
    expect(
      resolveEffectiveRunnerPolicy({
        workflowRunnerPolicy: { mode: 'auto', labels: ['ci'] },
        nodeRunner: { mode: 'inherit' },
      }),
    ).toEqual({ mode: 'auto', labels: ['ci'] });
  });

  it('node embedded overrides workflow auto with fallback from workflow', () => {
    expect(
      resolveEffectiveRunnerPolicy({
        workflowRunnerPolicy: { mode: 'auto', fallback: 'fail' },
        nodeRunner: { mode: 'embedded' },
      }),
    ).toEqual({ mode: 'embedded', fallback: 'fail' });
  });
});
