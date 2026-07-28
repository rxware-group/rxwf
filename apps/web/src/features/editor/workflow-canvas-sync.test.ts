import { describe, expect, it } from 'vitest';
import { resolveFlowNodePositionAfterDefinitionUpdate } from './workflow-canvas-sync.js';

describe('resolveFlowNodePositionAfterDefinitionUpdate', () => {
  it('follows definition position after external load', () => {
    expect(
      resolveFlowNodePositionAfterDefinitionUpdate(
        { x: 400, y: 120 },
        { x: 120, y: 160 },
        false,
      ),
    ).toEqual({ x: 400, y: 120 });
  });

  it('keeps flow position while dragging even if definition is stale', () => {
    expect(
      resolveFlowNodePositionAfterDefinitionUpdate(
        { x: 120, y: 160 },
        { x: 300, y: 200 },
        true,
      ),
    ).toEqual({ x: 300, y: 200 });
  });

  it('keeps flow position when definition matches', () => {
    expect(
      resolveFlowNodePositionAfterDefinitionUpdate(
        { x: 200, y: 100 },
        { x: 200, y: 100 },
        false,
      ),
    ).toEqual({ x: 200, y: 100 });
  });
});
