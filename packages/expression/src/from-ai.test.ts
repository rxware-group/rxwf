import { describe, expect, it } from 'vitest';
import {
  buildJsonSchemaFromFromAiSpecs,
  collectFromAiSpecsFromToolParams,
  formatFromAiCall,
  parseFromAiCalls,
  substituteFromAiInString,
} from './from-ai.js';

describe('parseFromAiCalls', () => {
  it('parses bare and embedded calls', () => {
    const specs = parseFromAiCalls(
      'https://api?q={{ $fromAI("query", "Search query", "string") }}',
    );
    expect(specs).toHaveLength(1);
    expect(specs[0]).toMatchObject({
      key: 'query',
      description: 'Search query',
      type: 'string',
    });
  });

  it('parses number and boolean types', () => {
    const specs = parseFromAiCalls('$fromAI("limit", "Max results", "number", 10)');
    expect(specs[0]?.type).toBe('number');
    expect(specs[0]?.defaultValue).toBe(10);
  });
});

describe('collectFromAiSpecsFromToolParams', () => {
  it('reads fromAi field mode as key shorthand', () => {
    const specs = collectFromAiSpecsFromToolParams({
      body: 'query',
      _fieldModes: { body: 'fromAi' },
    });
    expect(specs).toEqual([{ key: 'query', type: 'string' }]);
  });

  it('deduplicates keys across fields', () => {
    const specs = collectFromAiSpecsFromToolParams({
      url: '{{ $fromAI("q") }}',
      body: '{"term":"{{ $fromAI("q", "term") }}"}',
    });
    expect(specs).toHaveLength(1);
    expect(specs[0]?.key).toBe('q');
  });
});

describe('buildJsonSchemaFromFromAiSpecs', () => {
  it('builds required object schema', () => {
    const schema = buildJsonSchemaFromFromAiSpecs([
      { key: 'query', description: 'Search', type: 'string' },
    ]);
    expect(schema).toMatchObject({
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'Search' },
      },
    });
  });
});

describe('substituteFromAiInString', () => {
  it('replaces embedded fromAI with llm args', () => {
    const out = substituteFromAiInString(
      '{"q":"{{ $fromAI("query") }}"}',
      { query: 'hello' },
    );
    expect(out).toBe('{"q":"hello"}');
  });

  it('uses default when arg missing', () => {
    const out = substituteFromAiInString('$fromAI("limit", "", "number", 5)', {});
    expect(out).toBe('5');
  });
});

describe('formatFromAiCall', () => {
  it('round-trips through parser', () => {
    const formatted = formatFromAiCall({
      key: 'email',
      description: 'User email',
      type: 'string',
    });
    const specs = parseFromAiCalls(formatted);
    expect(specs[0]?.key).toBe('email');
    expect(specs[0]?.description).toBe('User email');
  });
});
