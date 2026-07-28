import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { FormField } from './FormField.js';

describe('FormField', () => {
  it('renders label row above control row', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        <FormField label="版本号">
          <input type="text" defaultValue="1.0.0" />
        </FormField>,
      );
    });

    const field = document.body.querySelector('.rxwf-form-field');
    expect(field).toBeTruthy();

    const label = field!.querySelector('.rxwf-form-field-label');
    const control = field!.querySelector('.rxwf-form-field-control input');
    expect(label?.textContent).toBe('版本号');
    expect(control).toBeTruthy();
    expect(field!.querySelector('.rxwf-form-field-label-row')!.compareDocumentPosition(control!) &
      Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    root.unmount();
    host.remove();
  });

  it('applies compact variant class', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        <FormField label="状态" variant="compact">
          <select defaultValue="">
            <option value="">全部</option>
          </select>
        </FormField>,
      );
    });

    expect(document.body.querySelector('.rxwf-form-field--compact')).toBeTruthy();

    root.unmount();
    host.remove();
  });
});
