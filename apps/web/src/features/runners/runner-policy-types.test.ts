import { describe, expect, it } from 'vitest';
import {
  applyRunnerPolicyToSettings,
  isDefaultEmbeddedPolicy,
  isRemoteV11NodeType,
  nodeRunnerOverrideToNodePatch,
  nodeHasRunnerRequirementHints,
  nodeSupportsRunnerOverride,
  parseNodeRunnerOverride,
  parseRunnerPolicy,
  resolveEffectiveRunnerPolicy,
  runnerPolicyToSettings,
} from './runner-policy-types.js';

describe('runner-policy-types', () => {
  it('omits runnerPolicy from settings when embedded default', () => {
    const policy = { mode: 'embedded' as const };
    expect(isDefaultEmbeddedPolicy(policy)).toBe(true);
    expect(runnerPolicyToSettings(policy)).toEqual({});
    expect(applyRunnerPolicyToSettings({ foo: 1 }, policy)).toEqual({ foo: 1 });
  });

  it('persists non-default runnerPolicy with fail fallback for remote modes', () => {
    const policy = {
      mode: 'pinned' as const,
      runnerId: 'agent-1',
      fallback: 'embedded' as const,
    };
    expect(runnerPolicyToSettings(policy)).toEqual({
      runnerPolicy: {
        mode: 'pinned',
        runnerId: 'agent-1',
        fallback: 'fail',
      },
    });
  });

  it('node override inherit clears runner field', () => {
    expect(nodeRunnerOverrideToNodePatch({ mode: 'inherit' })).toEqual({
      runner: undefined,
    });
  });

  it('node pinned overrides workflow pinned with fail fallback', () => {
    const effective = resolveEffectiveRunnerPolicy({
      workflowRunnerPolicy: { mode: 'pinned', runnerId: 'agent-1', fallback: 'embedded' },
      nodeRunner: { mode: 'pinned', runnerId: 'agent-2' },
    });
    expect(effective.runnerId).toBe('agent-2');
    expect(effective.mode).toBe('pinned');
    expect(effective.fallback).toBe('fail');
  });

  it('node auto merges platform and labels over workflow when set', () => {
    const effective = resolveEffectiveRunnerPolicy({
      workflowRunnerPolicy: {
        mode: 'auto',
        platform: 'linux',
        labels: ['prod'],
        fallback: 'fail',
      },
      nodeRunner: { mode: 'auto', platform: 'windows', labels: ['ci'] },
    });
    expect(effective).toEqual({
      mode: 'auto',
      platform: 'windows',
      labels: ['ci'],
      fallback: 'fail',
    });
  });

  it('normalizes legacy label mode to auto on parse', () => {
    expect(parseRunnerPolicy({ runnerPolicy: { mode: 'label', labels: ['ci'] } })).toEqual({
      mode: 'auto',
      labels: ['ci'],
      fallback: 'fail',
    });
  });

  it('nodeRunnerOverrideToNodePatch writes auto for legacy label mode', () => {
    expect(
      nodeRunnerOverrideToNodePatch({ mode: 'label', labels: ['ci'] }),
    ).toEqual({ runner: { mode: 'auto', labels: ['ci'] } });
  });

  it('parseRunnerPolicy defaults to embedded', () => {
    expect(parseRunnerPolicy(undefined)).toEqual({ mode: 'embedded' });
    expect(parseNodeRunnerOverride({})).toEqual({ mode: 'inherit' });
  });

  it('nodeSupportsRunnerOverride excludes triggers and satellites', () => {
    expect(nodeSupportsRunnerOverride('code')).toBe(true);
    expect(nodeSupportsRunnerOverride('executeCommand')).toBe(true);
    expect(nodeSupportsRunnerOverride('manualTrigger')).toBe(false);
    expect(nodeSupportsRunnerOverride('aiChatModel')).toBe(false);
  });

  it('isRemoteV11NodeType reflects node capability hints', () => {
    expect(isRemoteV11NodeType('code')).toBe(true);
    expect(isRemoteV11NodeType('httpRequest')).toBe(true);
    expect(isRemoteV11NodeType('toolWebSearch')).toBe(true);
    expect(isRemoteV11NodeType('set')).toBe(false);
  });

  it('nodeHasRunnerRequirementHints reflects built-in node requirements', () => {
    expect(nodeHasRunnerRequirementHints('code')).toBe(true);
    expect(nodeHasRunnerRequirementHints('executeCommand')).toBe(true);
    expect(nodeHasRunnerRequirementHints('httpRequest')).toBe(true);
    expect(nodeHasRunnerRequirementHints('readWriteFile')).toBe(true);
    expect(nodeHasRunnerRequirementHints('toolWebSearch')).toBe(true);
    expect(nodeHasRunnerRequirementHints('set')).toBe(false);
  });
});
