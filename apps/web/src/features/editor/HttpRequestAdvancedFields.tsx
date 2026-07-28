import type { ReactNode } from 'react';
import { t, useLabels } from '../../i18n/labels.js';
import { FormField } from '../../components/FormField.js';
import { HttpBodyEditor } from './HttpBodyEditor.js';
import { HttpKeyValueTable } from './HttpKeyValueTable.js';
import {
  normalizeHttpKeyValueRows,
  type HttpBodyContentType,
  type HttpRawBodyContentType,
} from './http-request-types.js';

function ParamToggleField({
  label,
  checked,
  onChange,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <FormField
      label={label}
      className={checked ? 'http-param-toggle-field' : 'http-param-toggle-field http-param-toggle-field--off'}
      labelExtra={
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          className={`rxwf-toggle${checked ? ' is-on' : ''}`}
          onClick={() => onChange(!checked)}
        >
          <span className="rxwf-toggle-track">
            <span className="rxwf-toggle-thumb" />
          </span>
        </button>
      }
    >
      {children}
    </FormField>
  );
}

export function HttpRequestAdvancedFields({
  parameters,
  onChange,
}: {
  parameters: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const labels = useLabels();
  const sendQuery = parameters.sendQuery === true;
  const sendHeaders = parameters.sendHeaders === true;
  const sendBody = parameters.sendBody === true;

  const patch = (next: Record<string, unknown>) => {
    onChange({ ...parameters, ...next });
  };

  return (
    <div className="http-param-fields">
      <ParamToggleField
        label={t(labels, 'editor.http.sendHeaders')}
        checked={sendHeaders}
        onChange={(checked) => patch({ sendHeaders: checked })}
      >
        {sendHeaders ? (
          <HttpKeyValueTable
            rows={normalizeHttpKeyValueRows(parameters.headerParameters)}
            onChange={(rows) => patch({ headerParameters: rows })}
            suggestHeaders
          />
        ) : null}
      </ParamToggleField>

      <ParamToggleField
        label={t(labels, 'editor.http.sendQuery')}
        checked={sendQuery}
        onChange={(checked) => patch({ sendQuery: checked })}
      >
        {sendQuery ? (
          <HttpKeyValueTable
            rows={normalizeHttpKeyValueRows(parameters.queryParameters)}
            onChange={(rows) => patch({ queryParameters: rows })}
          />
        ) : null}
      </ParamToggleField>

      <ParamToggleField
        label={t(labels, 'editor.http.sendBody')}
        checked={sendBody}
        onChange={(checked) => patch({ sendBody: checked })}
      >
        {sendBody ? (
          <HttpBodyEditor
            bodyContentType={(parameters.bodyContentType as HttpBodyContentType | 'json') ?? 'none'}
            rawContentType={parameters.rawContentType as HttpRawBodyContentType | undefined}
            body={String(parameters.body ?? '')}
            bodyParameters={normalizeHttpKeyValueRows(parameters.bodyParameters)}
            onChange={(next) => patch(next)}
          />
        ) : null}
      </ParamToggleField>
    </div>
  );
}
