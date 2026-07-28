import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    env: {
      RXWF_EXPR_POOL_DISABLED: '1',
    },
  },
});
