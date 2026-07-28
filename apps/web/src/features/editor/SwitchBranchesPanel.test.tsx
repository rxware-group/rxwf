import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getLocaleBundle } from '@rxwf/i18n-catalog';
import { LabelsProvider } from '../../i18n/labels.js';
import { SwitchBranchesPanel } from './SwitchBranchesPanel.js';
import type { WorkflowDefinition } from '../../api/client.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const labels = getLocaleBundle('zh-CN');

type WorkflowNode = WorkflowDefinition['nodes'][number];

function makeSwitchNode(
  branches: Array<{ id: string; label: string; condition: string }>,
): WorkflowNode {
  return {
    id: 'switch-1',
    type: 'switch',
    name: 'Switch',
    position: { x: 0, y: 0 },
    parameters: { branches },
  };
}

function renderPanel(
  node: WorkflowNode,
  onUpdateParameters = vi.fn(),
  onPatchWorkflow = vi.fn(),
) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <LabelsProvider labels={labels}>
        <SwitchBranchesPanel
          node={node}
          onUpdateParameters={onUpdateParameters}
          onPatchWorkflow={onPatchWorkflow}
        />
      </LabelsProvider>,
    );
  });

  return { host, root, onUpdateParameters, onPatchWorkflow };
}

describe('SwitchBranchesPanel', () => {
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

  it('renders dynamic branch rules UI with condition fields', () => {
    const branchId = 'branch-a';
    const { host, root } = renderPanel(
      makeSwitchNode([
        { id: branchId, label: '端口1', condition: '{{ $json.status === "paid" }}' },
      ]),
    );
    roots.push({ root, host });

    expect(host.querySelector('.switch-branches-panel')).toBeTruthy();
    expect(host.textContent).toContain('条件表达式');
    expect(host.textContent).toContain('添加分支');

    const conditionField = host.querySelector(
      'textarea.param-template-field',
    ) as HTMLTextAreaElement | null;
    expect(conditionField).toBeTruthy();
    expect(conditionField!.value).toBe('{{ $json.status === "paid" }}');
  });

  it('preserves branches when saving parameter updates', () => {
    const branchId = 'branch-save-test';
    const onUpdateParameters = vi.fn();
    const { host, root } = renderPanel(
      makeSwitchNode([
        { id: branchId, label: '端口1', condition: '{{ true }}' },
        { id: 'branch-b', label: '端口2', condition: '{{ false }}' },
      ]),
      onUpdateParameters,
    );
    roots.push({ root, host });

    const addBtn = host.querySelector('.switch-branch-add') as HTMLButtonElement;
    expect(addBtn).toBeTruthy();

    act(() => {
      addBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onUpdateParameters).toHaveBeenCalled();
    const lastCall = onUpdateParameters.mock.calls.at(-1)?.[0] as {
      branches: Array<{ id: string; label: string; condition: string }>;
    };
    expect(Array.isArray(lastCall.branches)).toBe(true);
    expect(lastCall.branches).toHaveLength(3);
    expect(lastCall.branches[0]).toMatchObject({
      id: branchId,
      label: '端口1',
      condition: '{{ true }}',
    });
    expect(lastCall.branches[1]).toMatchObject({
      id: 'branch-b',
      label: '端口2',
      condition: '{{ false }}',
    });
    expect(lastCall.branches[2]?.id).toBeTruthy();
    expect(lastCall.branches[2]?.condition).toBeTruthy();
  });
});
