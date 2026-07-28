import { describe, expect, it } from 'vitest';
import { buildBootstrapData } from './build-globals.js';
import {
  buildInputProxy,
  buildNodesProxy,
  createExpressionGlobals,
} from './expression-globals-runtime.js';

describe('expression globals runtime', () => {
  it('buildInputProxy exposes all/first/last and numeric index', () => {
    const proxy = buildInputProxy(
      [{ json: { id: 1 } }, { json: { id: 2 } }],
      1,
    );
    expect(proxy.itemIndex).toBe(1);
    expect(proxy.item.json).toEqual({ id: 2 });
    expect(proxy.all()).toHaveLength(2);
    expect(proxy.first()?.json).toEqual({ id: 1 });
    expect(proxy.last()?.json).toEqual({ id: 2 });
    expect(proxy[0]?.json).toEqual({ id: 1 });
    expect(proxy[1]?.json).toEqual({ id: 2 });
  });

  it('buildNodesProxy indexes by display name with binary shortcut', () => {
    const attachment = {
      data: 'x',
      mimeType: 'image/png',
      fileSize: 1,
    };
    const nodes = buildNodesProxy({
      HTTP: {
        name: 'HTTP',
        json: { ok: true },
        binary: { data: attachment },
        items: [{ json: { ok: true }, binary: { data: attachment } }],
      },
    });
    expect(nodes.HTTP?.json).toEqual({ ok: true });
    expect(nodes.HTTP?.binary?.data).toEqual(attachment);
    expect(nodes.HTTP?.all()).toHaveLength(1);
  });

  it('createExpressionGlobals matches bootstrap fields', () => {
    const data = buildBootstrapData({
      json: { id: 1 },
      binary: { data: { data: 'x', mimeType: 'text/plain', fileSize: 1 } },
      input: [{ json: { id: 1 } }],
      itemIndex: 0,
      env: { API_URL: 'https://example.com' },
      vars: { REGION: 'eu' },
      execution: { id: 'exec-1', mode: 'manual', environment: 'test' },
      workflow: { id: 'wf-1', name: 'Demo' },
      nodes: [
        {
          name: 'HTTP',
          json: { status: 200 },
          items: [{ json: { status: 200 } }],
        },
      ],
    });
    const globals = createExpressionGlobals(data);
    expect(globals.$json).toEqual({ id: 1 });
    expect(globals.$env.API_URL).toBe('https://example.com');
    expect(globals.$execution?.id).toBe('exec-1');
    expect(globals.$workflow?.name).toBe('Demo');
    expect(globals.$input.all()).toHaveLength(1);
    expect(globals.$nodes.HTTP?.json).toEqual({ status: 200 });
  });

  it('exposes $now and $today on globals', () => {
    const fixed = new Date('2026-06-04T15:30:00.000Z');
    const globals = createExpressionGlobals(
      buildBootstrapData({
        json: {},
        nowIso: fixed.toISOString(),
        todayIso: '2026-06-04T00:00:00.000Z',
      }),
    );
    expect(globals.$now).toBe(fixed.toISOString());
    expect(globals.$today).toBe('2026-06-04T00:00:00.000Z');
  });
});
