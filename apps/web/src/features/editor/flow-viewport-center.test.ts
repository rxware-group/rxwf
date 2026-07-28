import { describe, expect, it } from 'vitest';
import { nodePositionAtViewportCenter } from './flow-viewport-center.js';

describe('nodePositionAtViewportCenter', () => {
  it('centers node on viewport flow coordinates and snaps to grid', () => {
    expect(nodePositionAtViewportCenter({ x: 400, y: 300 }, 0)).toEqual({
      x: 352,
      y: 256,
    });
  });

  it('offsets slightly when adding multiple nodes and snaps to grid', () => {
    expect(nodePositionAtViewportCenter({ x: 100, y: 100 }, 2)).toEqual({
      x: 80,
      y: 80,
    });
  });
});
