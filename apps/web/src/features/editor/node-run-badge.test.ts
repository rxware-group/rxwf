import { describe, expect, it } from 'vitest';
import { getLocaleBundle } from '@rxwf/i18n-catalog';
import { resolveEdgeOutputBadge, resolveNodeBodyBadge } from './node-run-badge.js';

const labels = getLocaleBundle('zh-CN');

describe('node-run-badge', () => {
  it('resolveNodeBodyBadge shows running but not item count on success', () => {
    expect(resolveNodeBodyBadge(labels, 'manualTrigger', { status: 'running' })).toBeTruthy();
    expect(
      resolveNodeBodyBadge(labels, 'code', {
        status: 'success',
        itemCount: 2,
        outputItems: [[{ json: {} }, { json: {} }]],
      }),
    ).toBeNull();
  });

  it('resolveEdgeOutputBadge shows item count for main flow success', () => {
    const badge = resolveEdgeOutputBadge(labels, 'manualTrigger', 't', 'main', {
      t: {
        status: 'success',
        itemCount: 1,
        outputItems: [[{ json: { x: 1 } }]],
      },
    });
    expect(badge?.text).toContain('1');
  });

  it('resolveEdgeOutputBadge uses branch item count for IF outputs', () => {
    const badge = resolveEdgeOutputBadge(labels, 'if', 'if1', 'true', {
      if1: {
        status: 'success',
        outputItems: [[{ json: { ok: true } }], []],
      },
    }, { nodeType: 'if', parameters: {} });
    expect(badge?.text).toContain('1');
  });

  it('resolveEdgeOutputBadge shows batch size on Loop loop branch', () => {
    const badge = resolveEdgeOutputBadge(labels, 'loop', 'loop1', '0', {
      loop1: {
        status: 'success',
        outputItems: [[], [{ json: { a: 0 } }, { json: { a: 1 } }]],
        loopBatchItemCount: 1,
      },
    }, { nodeType: 'loop', parameters: { batchSize: 1 } });
    expect(badge?.text).toContain('1');
  });
});
