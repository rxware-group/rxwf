import { describe, it, expect } from 'vitest';
import { createExecutorRegistry } from '../../registry/executor-registry.js';
import { registerBuiltinExecutors } from '../register-builtin.js';
import { ifExecutor } from './if.js';

describe('ifExecutor registry', () => {
  it('throws E2003 when if executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('if', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered via registerBuiltinExecutors', () => {
    const registry = createExecutorRegistry();
    registerBuiltinExecutors(registry);
    expect(registry.has('if')).toBe(true);
  });
});

describe('ifExecutor', () => {
  it('sends items to output 0 when field equals expected value (legacy)', async () => {
    const result = await ifExecutor.execute({
      config: { field: 'active', expected: true },
      inputItems: [{ json: { active: true, id: 1 } }],
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]).toEqual([{ json: { active: true, id: 1 } }]);
    expect(result.outputItems?.[1]).toEqual([]);
  });

  it('sends items to output 1 when condition is false (legacy)', async () => {
    const result = await ifExecutor.execute({
      config: { field: 'active', expected: true },
      inputItems: [{ json: { active: false } }],
    });
    expect(result.outputItems?.[0]).toEqual([]);
    expect(result.outputItems?.[1]).toEqual([{ json: { active: false } }]);
  });

  it('evaluates {{ }} expression condition', async () => {
    const result = await ifExecutor.execute({
      config: { condition: '{{ $json.orderId === "1001" }}' },
      inputItems: [
        { json: { orderId: '1001', name: 'A' } },
        { json: { orderId: '999', name: 'B' } },
      ],
    });
    expect(result.outputItems?.[0]).toEqual([{ json: { orderId: '1001', name: 'A' } }]);
    expect(result.outputItems?.[1]).toEqual([{ json: { orderId: '999', name: 'B' } }]);
  });

  it('supports bracket path in expression', async () => {
    const result = await ifExecutor.execute({
      config: { condition: '{{ $json["active"] === true }}' },
      inputItems: [{ json: { active: true } }, { json: { active: false } }],
    });
    expect(result.outputItems?.[0]).toHaveLength(1);
    expect(result.outputItems?.[1]).toHaveLength(1);
  });

  it('evaluates n8n conditions[] with ={{ }} left value', async () => {
    const result = await ifExecutor.execute({
      config: {
        conditions: [
          { left: '={{ $json.ok }}', operator: 'equals', right: true },
        ],
      },
      inputItems: [{ json: { ok: true } }, { json: { ok: false } }],
    });
    expect(result.outputItems?.[0]).toEqual([{ json: { ok: true } }]);
    expect(result.outputItems?.[1]).toEqual([{ json: { ok: false } }]);
  });

  it('reads $env in expression condition', async () => {
    const result = await ifExecutor.execute({
      config: { condition: '{{ $env.FLAG === "yes" }}' },
      inputItems: [{ json: {} }],
      env: { FLAG: 'yes' },
    });
    expect(result.outputItems?.[0]).toHaveLength(1);
  });

  it('requires {{ }} wrapper for expression conditions', async () => {
    const result = await ifExecutor.execute({
      config: { condition: '{{ $json.active === true }}' },
      inputItems: [{ json: { active: true } }, { json: { active: false } }],
    });
    expect(result.outputItems?.[0]).toEqual([{ json: { active: true } }]);
    expect(result.outputItems?.[1]).toEqual([{ json: { active: false } }]);
  });

  it('fails with E2003 when condition expression is empty', async () => {
    const result = await ifExecutor.execute({
      config: { condition: '' },
      inputItems: [{ json: { active: true } }],
    });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E2003');
  });

  it('evaluates $binary.data.mimeType in expression condition (AC-050)', async () => {
    const textAttachment = {
      data: Buffer.from('hello').toString('base64'),
      mimeType: 'text/plain',
      fileSize: 5,
    };
    const imageAttachment = {
      data: Buffer.from('png').toString('base64'),
      mimeType: 'image/png',
      fileSize: 3,
    };
    const result = await ifExecutor.execute({
      config: {
        condition: '{{ $binary.data.mimeType === "text/plain" }}',
      },
      inputItems: [
        { json: { id: 1 }, binary: { data: textAttachment } },
        { json: { id: 2 }, binary: { data: imageAttachment } },
      ],
    });
    expect(result.outputItems?.[0]).toEqual([
      { json: { id: 1 }, binary: { data: textAttachment } },
    ]);
    expect(result.outputItems?.[1]).toEqual([
      { json: { id: 2 }, binary: { data: imageAttachment } },
    ]);
  });
});
