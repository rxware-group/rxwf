import { describe, it, expect } from 'vitest';
import { buildBootstrapData } from './build-globals.js';
import {
  createIsolateSlot,
  resetIsolateContext,
  runSourcesInSlot,
} from './run-expression-in-isolate.js';

describe('buildBootstrapData', () => {
  it('indexes nodes by display name', () => {
    const data = buildBootstrapData({
      json: {},
      nodes: [
        {
          name: 'HTTP',
          json: { status: 200 },
          items: [{ json: { status: 200 } }],
        },
      ],
    });
    expect(data.nodesByName.HTTP?.json).toEqual({ status: 200 });
  });

  it('bootstrap script can run twice on the same isolate context', async () => {
    const slot = createIsolateSlot();
    try {
      const first = buildBootstrapData({ json: { n: 1 } });
      const second = buildBootstrapData({ json: { n: 2 } });
      await resetIsolateContext(slot, first);
      await resetIsolateContext(slot, second);
      const [value] = await runSourcesInSlot(slot, second, ['$json.n']);
      expect(value).toBe(2);
    } finally {
      slot.isolate.dispose();
    }
  });
});
