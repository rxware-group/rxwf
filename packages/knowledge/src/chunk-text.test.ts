import { describe, it, expect } from 'vitest';
import { chunkText } from './chunk-text.js';

describe('chunkText', () => {
  it('returns empty for blank input', () => {
    expect(chunkText('   ')).toEqual([]);
  });

  it('splits with overlap', () => {
    const text = 'a'.repeat(2500);
    const chunks = chunkText(text, 1000, 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.length).toBe(1000);
  });
});
