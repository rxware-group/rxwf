import { t, useLabels } from '../../i18n/labels.js';
import { FormField } from '../../components/FormField.js';
import { Select } from '../../components/Select.js';

type InputMode = 'fields' | 'jsonExample' | 'acceptAll';

type InputField = {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  default?: unknown;
};

export function SubworkflowTriggerFields({
  parameters,
  onChange,
}: {
  parameters: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const labels = useLabels();
  const inputMode = String(parameters.inputMode ?? 'fields') as InputMode;
  const inputs = Array.isArray(parameters.inputs)
    ? (parameters.inputs as InputField[])
    : [];
  const jsonExample =
    typeof parameters.jsonExample === 'string'
      ? parameters.jsonExample
      : JSON.stringify(parameters.jsonExample ?? {}, null, 2);

  const patch = (partial: Record<string, unknown>) => {
    onChange({ ...parameters, ...partial });
  };

  const updateField = (index: number, field: Partial<InputField>) => {
    const next = inputs.map((row, i) => (i === index ? { ...row, ...field } : row));
    patch({ inputs: next });
  };

  return (
    <div className="subworkflow-trigger-fields">
      <FormField label={t(labels, 'editor.subworkflowTrigger.inputMode', undefined, '入参模式')}>
        <Select
          value={inputMode}
          onChange={(value) => patch({ inputMode: value })}
          options={[
            {
              value: 'fields',
              label: t(labels, 'editor.subworkflowTrigger.modeFields', undefined, '字段列表'),
            },
            {
              value: 'jsonExample',
              label: t(labels, 'editor.subworkflowTrigger.modeJson', undefined, 'JSON 示例'),
            },
            {
              value: 'acceptAll',
              label: t(labels, 'editor.subworkflowTrigger.modeAcceptAll', undefined, '接受全部'),
            },
          ]}
        />
      </FormField>

      {inputMode === 'fields' && (
        <div className="subworkflow-trigger-inputs">
          <p className="hint">
            {t(
              labels,
              'editor.subworkflowTrigger.fieldsHint',
              undefined,
              '声明父工作流 / Agent 调用时需提供的字段。',
            )}
          </p>
          {inputs.map((field, index) => (
            <div key={index} className="subworkflow-trigger-input-row">
              <input
                type="text"
                placeholder="name"
                value={field.name}
                onChange={(e) => updateField(index, { name: e.target.value })}
              />
              <Select
                value={field.type || 'string'}
                onChange={(value) => updateField(index, { type: value })}
                options={[
                  { value: 'string', label: 'string' },
                  { value: 'number', label: 'number' },
                  { value: 'boolean', label: 'boolean' },
                  { value: 'json', label: 'json' },
                ]}
              />
              <input
                type="text"
                placeholder={t(labels, 'editor.subworkflowTrigger.description', undefined, '描述')}
                value={field.description ?? ''}
                onChange={(e) => updateField(index, { description: e.target.value })}
              />
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={field.required !== false}
                  onChange={(e) => updateField(index, { required: e.target.checked })}
                />
                <span>{t(labels, 'editor.subworkflowTrigger.required', undefined, '必填')}</span>
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => patch({ inputs: inputs.filter((_, i) => i !== index) })}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              patch({
                inputs: [...inputs, { name: '', type: 'string', required: true }],
              })
            }
          >
            {t(labels, 'editor.subworkflowTrigger.addField', undefined, '添加字段')}
          </button>
        </div>
      )}

      {inputMode === 'jsonExample' && (
        <FormField label={t(labels, 'editor.subworkflowTrigger.jsonExample', undefined, 'JSON 示例')}>
          <textarea
            rows={6}
            value={jsonExample}
            onChange={(e) => patch({ jsonExample: e.target.value })}
            placeholder={'{\n  "query": "example",\n  "limit": 10\n}'}
          />
        </FormField>
      )}

      {inputMode === 'acceptAll' && (
        <p className="hint">
          {t(
            labels,
            'editor.subworkflowTrigger.acceptAllHint',
            undefined,
            '调用方传入的数据将原样作为 $json 可用。',
          )}
        </p>
      )}
    </div>
  );
}
