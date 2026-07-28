import { describe, it, expect } from 'vitest';
import { clampModalPosition } from './use-draggable-modal-panel.js';

describe('clampModalPosition', () => {
  const viewport = { width: 1000, height: 800 };
  const size = { width: 400, height: 300 };

  it('clamps position inside viewport with margin', () => {
    expect(clampModalPosition({ x: 0, y: 0 }, size, viewport)).toEqual({ x: 8, y: 8 });
    expect(clampModalPosition({ x: 900, y: 600 }, size, viewport)).toEqual({
      x: 592,
      y: 492,
    });
  });

  it('keeps valid position unchanged', () => {
    expect(clampModalPosition({ x: 100, y: 120 }, size, viewport)).toEqual({
      x: 100,
      y: 120,
    });
  });
});
