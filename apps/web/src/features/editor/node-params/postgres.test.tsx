import { describe, expect, it } from 'vitest';
import { getBasicParamSchema } from '../node-param-schemas.js';
import { validatePostgresParameters } from './postgres.js';

describe('postgres param schema', () => {
  it('exposes SQL query textarea for the property panel', () => {
    const fields = getBasicParamSchema('postgres');
    expect(fields.map((f) => f.key)).toEqual(['query']);
    expect(fields.find((f) => f.key === 'query')?.type).toBe('textarea');
    expect(fields.find((f) => f.key === 'query')?.label).toBe('SQL');
  });
});

describe('validatePostgresParameters', () => {
  it('allows empty query at save time (runtime defaults to SELECT 1)', () => {
    expect(validatePostgresParameters({})).toBeNull();
    expect(validatePostgresParameters({ query: '' })).toBeNull();
  });

  it('rejects whitespace-only query when explicitly set', () => {
    expect(validatePostgresParameters({ query: '   ' })).toEqual({
      code: 'E2002',
      message: 'postgres query must not be blank',
    });
  });
});
