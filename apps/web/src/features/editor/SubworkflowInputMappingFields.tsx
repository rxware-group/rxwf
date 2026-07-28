import { useEffect, useState } from 'react';
import { t, useLabels } from '../../i18n/labels.js';
import { api } from '../../api/client.js';
import { FormField } from '../../components/FormField.js';
import { LoadingHost } from '../../components/LoadingHost.js';

type SubworkflowField = {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
};

export function SubworkflowInputMappingFields({
  workflowId,
  mapping,
  onChange,
}: {
  workflowId: string;
  mapping: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const labels = useLabels();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<string>('fields');
  const [fields, setFields] = useState<SubworkflowField[]>([]);

  useEffect(() => {
    const id = workflowId.trim();
    if (!id) {
      setFields([]);
      setMode('fields');
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.workflows
      .getSubworkflowInputSchema(id)
      .then((schema) => {
        if (cancelled) return;
        setMode(schema.mode);
        setFields(schema.fields);
      })
      .catch(() => {
        if (!cancelled) {
          setMode('fields');
          setFields([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  if (!workflowId.trim()) return null;

  const updateKey = (key: string, value: string) => {
    onChange({ ...mapping, [key]: value });
  };

  return (
    <LoadingHost loading={loading} label={t(labels, 'common.loading')}>
      <div className="subworkflow-input-mapping">
        <p className="hint">
          {t(
            labels,
            'editor.subworkflowMapping.hint',
            undefined,
            '映射表达式；留空时 LLM / 上游字段名与子流字段名一致。',
          )}
        </p>
        {mode === 'acceptAll' ? (
          <FormField label={t(labels, 'editor.subworkflowMapping.acceptAll', undefined, '透传表达式')}>
            <textarea
              rows={4}
              value={String(mapping._payload ?? '{{ $json }}')}
              onChange={(e) => onChange({ _payload: e.target.value })}
              placeholder="{{ $json }}"
            />
          </FormField>
        ) : fields.length === 0 ? (
          <p className="hint">
            {t(
              labels,
              'editor.subworkflowMapping.noSchema',
              undefined,
              '子工作流未发布或缺少 subworkflowTrigger。',
            )}
          </p>
        ) : (
          fields.map((field) => (
            <FormField
              key={field.name}
              label={`${field.name}${field.required !== false ? ' *' : ''}`}
            >
              <input
                type="text"
                value={String(mapping[field.name] ?? '')}
                placeholder={
                  field.description ||
                  `{{ $json.${field.name} }}`
                }
                onChange={(e) => updateKey(field.name, e.target.value)}
              />
              {field.description ? (
                <p className="hint">{field.description}</p>
              ) : null}
            </FormField>
          ))
        )}
      </div>
    </LoadingHost>
  );
}
