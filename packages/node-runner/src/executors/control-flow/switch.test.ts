import { describe, it, expect } from 'vitest';
import { createExecutorRegistry } from '../../registry/executor-registry.js';
import { registerBuiltinExecutors } from '../register-builtin.js';
import { switchExecutor } from './switch.js';

describe('switchExecutor', () => {
  it('is registered in the builtin executor registry', () => {
    const registry = createExecutorRegistry();
    registerBuiltinExecutors(registry);
    expect(registry.has('switch')).toBe(true);
  });
  it('when multiple branches match, routes item only to the first true branch', async () => {
    const result = await switchExecutor.execute({
      config: {
        branches: [
          { id: 'a', label: 'A', condition: '{{ $json.n > 0 }}' },
          { id: 'b', label: 'B', condition: '{{ true }}' },
          { id: 'c', label: 'C', condition: '{{ true }}' },
        ],
      },
      inputItems: [{ json: { n: 5 } }],
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]).toEqual([{ json: { n: 5 } }]);
    expect(result.outputItems?.[1]).toEqual([]);
    expect(result.outputItems?.[2]).toEqual([]);
  });

  it('routes items to the first matching branch in order', async () => {
    const result = await switchExecutor.execute({
      config: {
        branches: [
          { id: 'a', label: 'A', condition: '{{ $json.kind === "a" }}' },
          { id: 'b', label: 'B', condition: '{{ $json.kind === "b" }}' },
          { id: 'c', label: 'C', condition: '{{ true }}' },
        ],
      },
      inputItems: [
        { json: { kind: 'a' } },
        { json: { kind: 'b' } },
        { json: { kind: 'other' } },
      ],
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]).toEqual([{ json: { kind: 'a' } }]);
    expect(result.outputItems?.[1]).toEqual([{ json: { kind: 'b' } }]);
    expect(result.outputItems?.[2]).toEqual([{ json: { kind: 'other' } }]);
  });

  it('discards items when no branch matches', async () => {
    const result = await switchExecutor.execute({
      config: {
        branches: [{ id: 'a', label: 'A', condition: '{{ $json.ok === true }}' }],
      },
      inputItems: [{ json: { ok: false } }, { json: {} }],
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]).toEqual([]);
  });

  it('fails when branches is empty', async () => {
    const result = await switchExecutor.execute({
      config: { branches: [] },
      inputItems: [{ json: {} }],
    });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E2003');
  });
});
