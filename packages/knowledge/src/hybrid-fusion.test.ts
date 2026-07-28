import { describe, it, expect } from 'vitest';
import { fuseRrf } from './hybrid-fusion.js';
import type { ScoredChunk } from '@rxwf/providers-contracts';

function chunk(id: string, score: number): ScoredChunk {
  return {
    id,
    knowledgeBaseId: 'kb',
    documentId: 'd',
    documentName: 'doc',
    chunkIndex: 0,
    text: id,
    score,
    metadata: {},
  };
}

describe('fuseRrf', () => {
  it('merges two ranked lists', () => {
    const a = [chunk('x', 0.9), chunk('y', 0.8)];
    const b = [chunk('y', 0.95), chunk('z', 0.7)];
    const fused = fuseRrf([a, b], 2);
    expect(fused.map((c) => c.id)).toContain('y');
    expect(fused.length).toBe(2);
  });
});
