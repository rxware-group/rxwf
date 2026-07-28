import { describe, it, expect } from 'vitest';
import { buildNodesContext } from './named-node-context.js';

describe('buildNodesContext', () => {
  it('includes only nodes before current in topological order', () => {
    const order = ['a', 'b', 'c'];
    const idToName = new Map([
      ['a', 'Start'],
      ['b', 'Middle'],
      ['c', 'End'],
    ]);
    const outputs = new Map([
      ['a', [[{ json: { x: 1 } }]]],
      ['b', [[{ json: { y: 2 } }]]],
    ]);
    expect(buildNodesContext(order, 'c', idToName, outputs)).toEqual([
      { name: 'Start', json: { x: 1 }, items: [{ json: { x: 1 } }] },
      { name: 'Middle', json: { y: 2 }, items: [{ json: { y: 2 } }] },
    ]);
  });

  it('uses first item json shortcut and keeps full items on main branch', () => {
    const order = ['a', 'b'];
    const outputs = new Map([
      [
        'a',
        [
          [
            { json: { first: true } },
            { json: { second: true } },
          ],
        ],
      ],
    ]);
    expect(buildNodesContext(order, 'b', new Map([['a', 'A']]), outputs)).toEqual([
      {
        name: 'A',
        json: { first: true },
        items: [{ json: { first: true } }, { json: { second: true } }],
      },
    ]);
  });
});
