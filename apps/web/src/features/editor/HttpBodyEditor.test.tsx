import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { getLocaleBundle } from '@rxwf/i18n-catalog';
import { LabelsProvider } from '../../i18n/labels.js';
import { HttpBodyEditor } from './HttpBodyEditor.js';
import { defaultNodeParameters } from './node-port-defs.js';
import { normalizeHttpKeyValueRows } from './http-request-types.js';

const labels = getLocaleBundle('zh-CN');

describe('HttpBodyEditor', () => {
  it('renders form-data body type without crashing', () => {
    const onChange = vi.fn();
    const params = defaultNodeParameters('httpRequest');
    const bodyParameters = normalizeHttpKeyValueRows(params.bodyParameters);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        <LabelsProvider labels={labels}>
          <HttpBodyEditor
            bodyContentType="none"
            rawContentType="json"
            body={String(params.body ?? '')}
            bodyParameters={bodyParameters}
            onChange={onChange}
          />
        </LabelsProvider>,
      );
    });

    const formDataRadio = host.querySelector(
      'input[type="radio"][value="form-data"]',
    ) as HTMLInputElement | null;
    expect(formDataRadio).toBeTruthy();

    act(() => {
      formDataRadio!.click();
    });

    expect(onChange).toHaveBeenCalledWith({ bodyContentType: 'form-data' });
    expect(host.querySelector('.http-kv-table')).toBeNull();

    act(() => {
      root.render(
        <LabelsProvider labels={labels}>
          <HttpBodyEditor
            bodyContentType="form-data"
            rawContentType="json"
            body={String(params.body ?? '')}
            bodyParameters={bodyParameters}
            onChange={onChange}
          />
        </LabelsProvider>,
      );
    });

    expect(host.querySelector('.http-kv-table')).toBeTruthy();
    expect(document.body.textContent).toContain('表单数据');

    act(() => {
      root.unmount();
    });
    host.remove();
  });
});
