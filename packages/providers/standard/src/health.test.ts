import { describe, it, expect } from 'vitest';
import { createStandardHealthChecker } from './health.js';

describe('createStandardHealthChecker', () => {
  it('returns not ready when urls are invalid', async () => {
    const checker = createStandardHealthChecker({
      databaseUrl: 'postgres://invalid:59999/none',
      redisUrl: 'redis://invalid:59998',
    });
    const result = await checker.check();
    expect(result.ready).toBe(false);
  });
});
