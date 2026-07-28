import { t, useLabels } from '../../i18n/labels.js';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { FormField } from '../../components/FormField.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { Select } from '../../components/Select.js';

export function ToolWorkflowSelect({
  value,
  currentWorkflowId,
  onChange,
}: {
  value: string;
  currentWorkflowId?: string;
  onChange: (workflowId: string) => void;
}) {
  const labels = useLabels();
  const [options, setOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.workflows
      .listExposedAsTool()
      .then((workflows) => {
        if (cancelled) return;
        setOptions(
          workflows
            .filter((w) => w.id !== currentWorkflowId)
            .map((w) => ({ id: w.id, name: w.name })),
        );
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentWorkflowId]);

  return (
    <LoadingHost loading={loading} label={t(labels, 'common.loading')}>
    <FormField label={t(labels, 'auto.t_9ac22f23')}>
      <Select
        value={value}
        disabled={loading}
        onChange={onChange}
        options={[
          { value: '', label: t(labels, 'auto.Tool_5b687ec0') },
          ...(value && !options.some((o) => o.id === value)
            ? [{ value, label: `${value}${t(labels, 'editor.toolWorkflowNotInList')}` }]
            : []),
          ...options.map((o) => ({ value: o.id, label: o.name })),
        ]}
      />
      <p className="hint">{t(labels, 'editor.toolWorkflowHint')}</p>
    </FormField>
    </LoadingHost>
  );
}
