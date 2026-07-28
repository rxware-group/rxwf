import { describe, expect, it, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getLocaleBundle } from '@rxwf/i18n-catalog';
import { LabelsProvider } from '../../../i18n/labels.js';
import { IfConditionPanel, validateIfParameters } from './if.js';
import type { WorkflowDefinition } from '../../../api/client.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const labels = getLocaleBundle('zh-CN');

type WorkflowNode = WorkflowDefinition['nodes'][number];

function makeIfNode(condition = '{{ $json.active === true }}'): WorkflowNode {
  return {
    id: 'if-1',
    type: 'if',
    name: 'IF',
    position: { x: 0, y: 0 },
    parameters: { condition },
  };
}

function renderPanel(node: WorkflowNode, onUpdateParameters = vi.fn()) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <LabelsProvider labels={labels}>
        <IfConditionPanel node={node} onUpdateParameters={onUpdateParameters} />
      </LabelsProvider>,
    );
  });

  return { host, root, onUpdateParameters };
}

describe('validateIfParameters', () => {
  it('rejects empty condition expression', () => {
    expect(validateIfParameters({ condition: '' })).toEqual({
      code: 'E2003',
      message: 'if requires a non-empty {{ }} condition expression',
    });
  });

  it('rejects condition without {{ }} wrapper', () => {
    expect(validateIfParameters({ condition: '$json.active === true' })).toEqual({
      code: 'E2003',
      message: 'if condition must be a {{ }} expression',
    });
  });

  it('accepts valid {{ }} condition', () => {
    expect(
      validateIfParameters({ condition: '{{ $json.active === true }}' }),
    ).toBeNull();
  });

  it('allows legacy field/expected mode without condition', () => {
    expect(validateIfParameters({ field: 'active', expected: true })).toBeNull();
  });
});

describe('IfConditionPanel', () => {
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

  it('renders condition expression field in if-condition-panel', () => {
    const { host, root } = renderPanel(makeIfNode());
    roots.push({ root, host });

    expect(host.querySelector('.if-condition-panel')).toBeTruthy();
    expect(host.querySelector('.if-condition-form-field')).toBeTruthy();
    expect(host.textContent).toContain('条件');

    const conditionField = host.querySelector(
      'textarea.param-template-field',
    ) as HTMLTextAreaElement | null;
    expect(conditionField).toBeTruthy();
    expect(conditionField!.value).toBe('{{ $json.active === true }}');
  });
});
