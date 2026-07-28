import { describe, it, expect } from 'vitest';
import { resolveCodeSandboxTimeoutMs } from './resolve-code-sandbox-timeout.js';

describe('resolveCodeSandboxTimeoutMs', () => {
  it('prefers node config over env', () => {
    expect(
      resolveCodeSandboxTimeoutMs({ timeoutMs: 5000 }, { SANDBOX_CODE_TIMEOUT_MS: '2000' }),
    ).toBe(5000);
  });

  it('uses RXWF_SANDBOX_CODE_TIMEOUT_MS from env', () => {
    expect(
      resolveCodeSandboxTimeoutMs({}, { RXWF_SANDBOX_CODE_TIMEOUT_MS: '2000' }),
    ).toBe(2000);
  });

  it('prefers RXWF key over legacy SANDBOX key', () => {
    expect(
      resolveCodeSandboxTimeoutMs(
        {},
        { RXWF_SANDBOX_CODE_TIMEOUT_MS: '3000', SANDBOX_CODE_TIMEOUT_MS: '2000' },
      ),
    ).toBe(3000);
  });

  it('node -1 disables timeout even if env is positive', () => {
    expect(
      resolveCodeSandboxTimeoutMs({ timeoutMs: -1 }, { SANDBOX_CODE_TIMEOUT_MS: '2000' }),
    ).toBe(-1);
  });

  it('falls back to -1 when both invalid', () => {
    expect(
      resolveCodeSandboxTimeoutMs({ timeoutMs: 'abc' }, { SANDBOX_CODE_TIMEOUT_MS: 'nope' }),
    ).toBe(-1);
  });

  it('normalizes zero and negative to -1', () => {
    expect(resolveCodeSandboxTimeoutMs({ timeoutMs: 0 }, {})).toBe(-1);
    expect(resolveCodeSandboxTimeoutMs({ timeoutMs: -5 }, {})).toBe(-1);
  });

  it('floors positive decimals', () => {
    expect(resolveCodeSandboxTimeoutMs({ timeoutMs: 1500.9 }, {})).toBe(1500);
  });
});
