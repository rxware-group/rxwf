import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { getLocaleBundle } from '@rxwf/i18n-catalog';
import { LabelsProvider } from '../i18n/labels.js';
import { ConfirmDialog } from './ConfirmDialog.js';

const labels = getLocaleBundle('zh-CN');

describe('ConfirmDialog', () => {
  it('renders title, close button, and invokes onConfirm', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        <LabelsProvider labels={labels}>
        <ConfirmDialog
          open
          title="删除工作流"
          message="此操作不可撤销"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
        </LabelsProvider>,
      );
    });

    expect(document.body.textContent).toContain('删除工作流');
    expect(document.body.querySelector('.rxwf-modal-close')).toBeTruthy();

    const confirmBtn = document.body.querySelector('.btn-primary') as HTMLButtonElement | null;
    expect(confirmBtn).toBeTruthy();
    act(() => {
      confirmBtn!.click();
    });
    expect(onConfirm).toHaveBeenCalledOnce();

    root.unmount();
    host.remove();
  });

  it('places danger confirm left of primary cancel for danger dialogs', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        <LabelsProvider labels={labels}>
        <ConfirmDialog
          open
          danger
          title="删除"
          message="确认删除"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
        </LabelsProvider>,
      );
    });

    const footerButtons = document.body.querySelectorAll(
      '.rxwf-modal-footer-right .rxwf-modal-footer-btn',
    );
    expect(footerButtons.length).toBe(2);
    expect(footerButtons[0]?.classList.contains('btn-danger')).toBe(true);
    expect(footerButtons[1]?.classList.contains('btn-primary')).toBe(true);

    root.unmount();
    host.remove();
  });
});
