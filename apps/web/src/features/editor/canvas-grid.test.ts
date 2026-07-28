import { describe, expect, it } from 'vitest';
import { CANVAS_GRID_SIZE, snapAxisToGrid, snapPointToGrid } from './canvas-grid.js';

describe('snapAxisToGrid', () => {
  it('snaps to nearest grid line', () => {
    expect(snapAxisToGrid(0)).toBe(0);
    expect(snapAxisToGrid(8)).toBe(16);
    expect(snapAxisToGrid(7)).toBe(0);
    expect(snapAxisToGrid(24)).toBe(32);
    expect(snapAxisToGrid(25)).toBe(32);
  });

  it('handles negative coordinates', () => {
    expect(snapAxisToGrid(-8)).toBe(0);
    expect(snapAxisToGrid(-9)).toBe(-16);
    expect(snapAxisToGrid(-24)).toBe(-16);
  });

  it('respects custom grid size', () => {
    expect(snapAxisToGrid(13, 10)).toBe(10);
    expect(snapAxisToGrid(14, 10)).toBe(10);
    expect(snapAxisToGrid(15, 10)).toBe(20);
  });
});

describe('snapPointToGrid', () => {
  it('snaps both axes using default grid size', () => {
    expect(snapPointToGrid({ x: 100, y: 50 })).toEqual({ x: 96, y: 48 });
  });

  it('uses CANVAS_GRID_SIZE constant', () => {
    expect(CANVAS_GRID_SIZE).toBe(16);
    expect(snapPointToGrid({ x: 17, y: 17 })).toEqual({ x: 16, y: 16 });
  });
});
