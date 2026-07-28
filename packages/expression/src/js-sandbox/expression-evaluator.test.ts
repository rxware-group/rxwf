import { describe, expect, it } from 'vitest';
import { ExpressionEvaluator } from './expression-evaluator.js';

describe('ExpressionEvaluator', () => {
  it('reuses session for multiple template segments', async () => {
    const session = await ExpressionEvaluator.open({ json: { a: 1, b: 2 } });
    try {
      const { resolveTemplateString } = await import('../resolve-template.js');
      const out = await resolveTemplateString(
        '{{ $json.a }}-{{ $json.b }}',
        session.frozenContext,
        session,
      );
      expect(out).toBe('1-2');
    } finally {
      await session.close();
    }
  });

  it('$now is stable within session', async () => {
    const session = await ExpressionEvaluator.open({
      json: {},
      nowIso: '2026-06-04T12:00:00.000Z',
    });
    const a = await session.evaluate('$now');
    const b = await session.evaluate('$now');
    expect(a).toBe('2026-06-04T12:00:00.000Z');
    expect(b).toBe(a);
    await session.close();
  });
});
