import { describe, expect, it, beforeAll } from 'vitest';

describe('expression-pool', () => {
  beforeAll(() => {
    process.env.RXWF_EXPR_POOL_DISABLED = '1';
  });

  it('evaluates $json field via pool API (direct fallback)', async () => {
    const { evaluateViaPool } = await import('./expression-pool.js');
    const v = await evaluateViaPool('$json.id', { json: { id: 'abc' } });
    expect(v).toBe('abc');
  });

  it('batch evaluates multiple sources in one reset', async () => {
    const { evaluateViaPoolBatch } = await import('./expression-pool.js');
    const [a, b] = await evaluateViaPoolBatch(['$json.a', '$json.b'], {
      json: { a: 1, b: 2 },
    });
    expect(a).toBe(1);
    expect(b).toBe(2);
  });
});
