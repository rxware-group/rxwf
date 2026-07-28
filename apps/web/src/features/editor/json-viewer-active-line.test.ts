import { describe, expect, it } from 'vitest';
import { activeLineTextRange, trimRangeToLineText } from './json-viewer-active-line.js';

describe('activeLineTextRange', () => {
  it('skips leading indentation', () => {
    expect(activeLineTextRange('    "ok": true,')).toEqual({ start: 4, end: 15 });
  });

  it('returns null for whitespace-only lines', () => {
    expect(activeLineTextRange('    ')).toBeNull();
  });

  it('returns null for empty lines', () => {
    expect(activeLineTextRange('')).toBeNull();
  });

  it('covers compact single-token lines', () => {
    expect(activeLineTextRange('{}')).toEqual({ start: 0, end: 2 });
  });
});

describe('trimRangeToLineText', () => {
  const line = '    "pragma": "no-cache",';
  const lineFrom = 100;

  it('trims leading indent from a full-line selection', () => {
    expect(trimRangeToLineText(line, lineFrom, lineFrom, lineFrom + line.length)).toEqual({
      from: lineFrom + 4,
      to: lineFrom + line.trimEnd().length,
    });
  });

  it('respects partial selection inside text', () => {
    expect(trimRangeToLineText(line, lineFrom, lineFrom + 6, lineFrom + 12)).toEqual({
      from: lineFrom + 6,
      to: lineFrom + 12,
    });
  });

  it('returns null when selection is only indentation', () => {
    expect(trimRangeToLineText(line, lineFrom, lineFrom, lineFrom + 3)).toBeNull();
  });
});
