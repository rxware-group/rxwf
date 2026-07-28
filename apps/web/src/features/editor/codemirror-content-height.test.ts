import { describe, expect, it } from 'vitest';
import { clampEditorHeightPx, estimateHeightFromLines } from './codemirror-content-height.js';

describe('codemirror content height', () => {
  it('estimates height from line count', () => {
    expect(estimateHeightFromLines('a\nb\nc')).toBe(3 * 19 + 8);
  });

  it('clamps editor height between min and available space', () => {
    expect(clampEditorHeightPx(1200, 400, 80)).toBe(400);
    expect(clampEditorHeightPx(120, 400, 80)).toBe(120);
    expect(clampEditorHeightPx(40, 400, 80)).toBe(80);
  });
});
