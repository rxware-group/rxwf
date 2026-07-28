import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getLocaleBundle } from '@rxwf/i18n-catalog';
import { LabelsProvider } from '../../../i18n/labels.js';
import { getBasicParamSchema } from '../node-param-schemas.js';
import { applyJsonDraftsToDefinition } from '../editor-json-params.js';
import { SetParamsPanel } from './set.js';
import type { WorkflowDefinition } from '../../../api/client.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const labels = getLocaleBundle('zh-CN');

function makeSetNode(parameters: Record<string, unknown>) {
  return {
    id: 'set-1',
    type: 'set' as const,
    name: 'Set',
    position: { x: 0, y: 0 },
    parameters,
  };
}

function renderPanel(
  parameters: Record<string, unknown>,
  onChange = vi.fn(),
  jsonDrafts: Record<string, string> = {},
  onJsonDraftChange = vi.fn(),
) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <LabelsProvider labels={labels}>
        <SetParamsPanel
          parameters={parameters}
          onChange={onChange}
          jsonDrafts={jsonDrafts}
          onJsonDraftChange={onJsonDraftChange}
        />
      </LabelsProvider>,
    );
  });

  return { host, root, onChange, onJsonDraftChange };
}

describe('set param schema', () => {
  it('exposes mode and fields for the property panel', () => {
    const fields = getBasicParamSchema('set');
    expect(fields.map((f) => f.key)).toEqual(['mode', 'fields']);
    expect(fields.find((f) => f.key === 'mode')?.type).toBe('select');
    expect(fields.find((f) => f.key === 'fields')?.type).toBe('json');
  });
});

describe('set fields json validation', () => {
  it('rejects invalid fields JSON on save merge', () => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'set-validation',
      nodes: [makeSetNode({ mode: 'manual', fields: { ok: true } })],
      connections: [],
      settings: {},
    };
    const result = applyJsonDraftsToDefinition(labels, definition, 'set-1', {
      fields: '{ invalid',
    });
    expect(result.error).toBeTruthy();
    expect(result.definition.nodes[0]?.parameters.fields).toEqual({ ok: true });
  });
});

describe('SetParamsPanel', () => {
  let roots: Array<{ root: Root; host: HTMLDivElement }> = [];

  afterEach(() => {
    for (const { root, host } of roots) {
      act(() => {
        root.unmount();
      });
      host.remove();
    }
    roots = [];
  });

  it('renders mode select and fields JSON editor', () => {
    const { host, root } = renderPanel({
      mode: 'manual',
      fields: { status: 'ready' },
    });
    roots.push({ root, host });

    expect(host.querySelector('.set-params-panel')).toBeTruthy();
    expect(host.textContent).toContain('模式');
    expect(host.textContent).toContain('字段');
    expect(host.querySelector('.json-param-form-field')).toBeTruthy();
  });
});
