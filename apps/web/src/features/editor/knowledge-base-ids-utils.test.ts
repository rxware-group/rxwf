import { describe, expect, it } from 'vitest';
import { normalizeKnowledgeBaseIds } from './knowledge-base-ids-utils.js';

describe('normalizeKnowledgeBaseIds', () => {
  it('accepts string arrays', () => {
    expect(normalizeKnowledgeBaseIds(['kb-1', 'kb-2'])).toEqual(['kb-1', 'kb-2']);
  });

  it('parses comma-separated strings', () => {
    expect(normalizeKnowledgeBaseIds('kb-1, kb-2')).toEqual(['kb-1', 'kb-2']);
  });

  it('returns empty for missing values', () => {
    expect(normalizeKnowledgeBaseIds(undefined)).toEqual([]);
    expect(normalizeKnowledgeBaseIds([])).toEqual([]);
  });
});
