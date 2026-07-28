import { describe, expect, it } from 'vitest';

import { JobPool } from './job-pool.js';

describe('JobPool', () => {
  it('maxConcurrent=2: third accept waits until release', async () => {
    const pool = new JobPool(2);

    await pool.accept();
    await pool.accept();
    expect(pool.inUse).toBe(2);

    let thirdAccepted = false;
    const thirdPromise = pool.accept().then(() => {
      thirdAccepted = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(thirdAccepted).toBe(false);
    expect(pool.waiting).toBe(1);

    pool.release();
    await thirdPromise;
    expect(thirdAccepted).toBe(true);
    expect(pool.inUse).toBe(2);
  });

  it('tryAccept returns false when at capacity', async () => {
    const pool = new JobPool(1);
    expect(pool.tryAccept()).toBe(true);
    expect(pool.tryAccept()).toBe(false);
    pool.release();
    expect(pool.tryAccept()).toBe(true);
    pool.release();
  });
});
