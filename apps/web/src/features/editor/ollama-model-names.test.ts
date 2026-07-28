import { describe, expect, it } from 'vitest';
import {
  isLiteralHttpUrl,
  mergeModelNames,
  parseOllamaTagsResponse,
} from './ollama-model-names.js';

describe('ollama-model-names', () => {
  it('detects literal http urls without expressions', () => {
    expect(isLiteralHttpUrl('http://127.0.0.1:11434')).toBe(true);
    expect(isLiteralHttpUrl('{{ $json.baseUrl }}')).toBe(false);
    expect(isLiteralHttpUrl('')).toBe(false);
  });

  it('parses ollama tags response', () => {
    expect(
      parseOllamaTagsResponse({
        models: [{ name: 'llama3' }, { name: 'qwen3:8b' }],
      }),
    ).toEqual(['llama3', 'qwen3:8b']);
  });

  it('merges and deduplicates model names', () => {
    expect(mergeModelNames(['llama3', 'qwen3:8b'], ['llama3', 'mistral'])).toEqual([
      'llama3',
      'mistral',
      'qwen3:8b',
    ]);
  });
});
