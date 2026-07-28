import { useLabels } from '../../../i18n/labels.js';
import { resolveLabel } from '../../../i18n/resolve-label.js';
import { FormField } from '../../../components/FormField.js';
import { Select } from '../../../components/Select.js';
import { JsonParamEditor } from '../JsonParamEditor.js';
import { formatJsonParamValue } from '../editor-json-params.js';

export function SetParamsPanel({
  parameters,
  onChange,
  jsonDrafts,
  onJsonDraftChange,
  jsonError,
}: {
  parameters: Record<string, unknown>;
  onChange: (parameters: Record<string, unknown>) => void;
  jsonDrafts: Record<string, string>;
  onJsonDraftChange: (key: string, text: string) => void;
  jsonError?: string | null;
}) {
  const labels = useLabels();
  const mode = String(parameters.mode ?? 'manual');

  return (
    <div className="set-params-panel">
      <FormField label={resolveLabel(labels, '模式')}>
        <Select
          value={mode}
          onChange={(next) => onChange({ ...parameters, mode: next })}
          options={[
            { value: 'manual', label: 'Manual' },
            { value: 'expression', label: 'Expression' },
          ]}
        />
      </FormField>
      <FormField label={resolveLabel(labels, '字段')} className="json-param-form-field">
        <JsonParamEditor
          value={jsonDrafts.fields ?? formatJsonParamValue(parameters.fields)}
          placeholder='manual: { "status": "done" }；expression: { "url": "{{ $env.API_URL }}" }'
          onChange={(text) => onJsonDraftChange('fields', text)}
        />
        {jsonError && (
          <p className="form-error rxwf-mt-1">
            {jsonError}
          </p>
        )}
      </FormField>
    </div>
  );
}
