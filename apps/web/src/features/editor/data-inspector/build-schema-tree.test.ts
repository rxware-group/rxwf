import { describe, expect, it } from 'vitest';
import { buildSchemaTree } from './build-schema-tree.js';

describe('buildSchemaTree', () => {
  it('builds nested object and array nodes from first item', () => {
    const tree = buildSchemaTree([{ json: { a: 1, items: [{ b: 2 }] } }]);
    expect(tree).toMatchObject([
      { key: 'a', type: 'number', path: ['a'] },
      { key: 'items', type: 'array', path: ['items'], children: expect.any(Array) },
    ]);
  });
});
