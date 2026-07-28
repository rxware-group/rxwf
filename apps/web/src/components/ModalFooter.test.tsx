import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { getLocaleBundle } from '@rxwf/i18n-catalog';
import { LabelsProvider } from '../i18n/labels.js';
import { ModalFooter } from './ModalFooter.js';

const labels = getLocaleBundle('zh-CN');

describe('ModalFooter', () => {
  it('renders reset on the left and actions in order on the right', () => {
    const onReset = vi.fn();
    const onSave = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        <LabelsProvider labels={labels}>
        <ModalFooter
          reset={{ onClick: onReset }}
          actions={[
            { key: 'save', label: '保存', variant: 'primary', onClick: onSave },
            { key: 'cancel', label: '取消', variant: 'secondary', onClick: () => {} },
            { key: 'apply', label: '应用', variant: 'secondary', onClick: () => {} },
            { key: 'help', label: '帮助', variant: 'secondary', onClick: () => {} },
          ]}
        />
        </LabelsProvider>,
      );
    });

    const leftBtn = document.body.querySelector('.rxwf-modal-footer-left button');
    expect(leftBtn?.textContent).toBe('重置');

    const rightLabels = Array.from(
      document.body.querySelectorAll('.rxwf-modal-footer-right button'),
    ).map((btn) => btn.textContent);
    expect(rightLabels).toEqual(['保存', '取消', '应用', '帮助']);

    act(() => {
      leftBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onReset).toHaveBeenCalledOnce();

    root.unmount();
    host.remove();
  });

  it('disables action buttons when disabled is set', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        <LabelsProvider labels={labels}>
        <ModalFooter
          actions={[
            {
              key: 'ok',
              label: '确定',
              variant: 'primary',
              disabled: true,
              onClick: () => {},
            },
          ]}
        />
        </LabelsProvider>,
      );
    });

    const btn = document.body.querySelector('.rxwf-modal-footer-right button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);

    root.unmount();
    host.remove();
  });
});
