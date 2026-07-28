import { describe, expect, it } from 'vitest';
import { resolveSkillRunTimeoutMs } from './resolve-skill-run-timeout.js';

describe('resolveSkillRunTimeoutMs', () => {
  it('prefers node config over env', () => {
    expect(
      resolveSkillRunTimeoutMs({ timeoutMs: 5000 }, { SKILL_RUN_TIMEOUT_MS: '2000' }),
    ).toBe(5000);
  });

  it('uses env when node unset', () => {
    expect(resolveSkillRunTimeoutMs({}, { SKILL_RUN_TIMEOUT_MS: '2000' })).toBe(2000);
  });

  it('node -1 disables timeout even if env is positive', () => {
    expect(
      resolveSkillRunTimeoutMs({ timeoutMs: -1 }, { SKILL_RUN_TIMEOUT_MS: '2000' }),
    ).toBe(-1);
  });

  it('falls back to 120s when both invalid', () => {
    expect(
      resolveSkillRunTimeoutMs({ timeoutMs: 'abc' }, { SKILL_RUN_TIMEOUT_MS: 'nope' }),
    ).toBe(120_000);
  });

  it('normalizes zero and negative to -1', () => {
    expect(resolveSkillRunTimeoutMs({ timeoutMs: 0 }, {})).toBe(-1);
    expect(resolveSkillRunTimeoutMs({ timeoutMs: -5 }, {})).toBe(-1);
  });

  it('floors positive decimals', () => {
    expect(resolveSkillRunTimeoutMs({ timeoutMs: 1500.9 }, {})).toBe(1500);
  });
});
