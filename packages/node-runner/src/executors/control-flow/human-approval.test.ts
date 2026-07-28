import { describe, expect, it } from 'vitest';
import { createExecutorRegistry } from '../../registry/executor-registry.js';
import { registerBuiltinExecutors } from '../register-builtin.js';
import { humanApprovalExecutor } from './human-approval.js';

describe('humanApprovalExecutor', () => {
  it('throws E2003 when humanApproval is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('humanApproval', {
        config: { prompt: 'Review' },
        inputItems: [{ json: {} }],
      }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('registers humanApproval in builtin executor registry', () => {
    const registry = createExecutorRegistry();
    registerBuiltinExecutors(registry);
    expect(registry.has('humanApproval')).toBe(true);
  });

  it('returns waiting with hitl metadata', async () => {
    const result = await humanApprovalExecutor.execute({
      config: { prompt: 'Review {{ $json.title }}', allowReject: true },
      inputItems: [{ json: { title: 'Deploy v2' } }],
    });
    expect(result.status).toBe('waiting');
    expect(result.metadata?.hitl).toMatchObject({
      prompt: 'Review Deploy v2',
      allowReject: true,
    });
  });

  it('sets expiresAt and timeoutAction when timeoutMs is configured', async () => {
    const result = await humanApprovalExecutor.execute({
      config: {
        prompt: 'Review',
        timeoutMs: 60_000,
        timeoutAction: 'approve',
      },
      inputItems: [{ json: {} }],
    });
    const hitl = result.metadata?.hitl as Record<string, unknown>;
    expect(hitl.timeoutMs).toBe(60_000);
    expect(hitl.timeoutAction).toBe('approve');
    expect(hitl.expiresAt).toBeTruthy();
    expect(Date.parse(String(hitl.expiresAt))).toBeGreaterThan(
      Date.parse(String(hitl.requestedAt)),
    );
  });

  it('parses allowReject string false as false', async () => {
    const result = await humanApprovalExecutor.execute({
      config: { prompt: 'Review', allowReject: 'false' },
      inputItems: [{ json: {} }],
    });
    expect(result.metadata?.hitl).toMatchObject({ allowReject: false });
  });

  it('parses allowSupplement string true as true', async () => {
    const result = await humanApprovalExecutor.execute({
      config: { prompt: 'Review', allowSupplement: 'true' },
      inputItems: [{ json: {} }],
    });
    expect(result.metadata?.hitl).toMatchObject({ allowSupplement: true });
  });

  it('builds summary from summaryField expression', async () => {
    const result = await humanApprovalExecutor.execute({
      config: { prompt: 'Review', summaryField: '{{ $json.title }}' },
      inputItems: [{ json: { title: 'Deploy v2' } }],
    });
    expect(result.metadata?.hitl).toMatchObject({ summary: 'Deploy v2' });
  });
});
