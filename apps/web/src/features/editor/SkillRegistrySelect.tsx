import { useEffect, useState } from 'react';
import { api, type SkillRecordSummary } from '../../api/client.js';
import { FormField } from '../../components/FormField.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { Select } from '../../components/Select.js';
import { t, useLabels } from '../../i18n/labels.js';

export function SkillRegistrySelect({
  value,
  onChange,
  onPickPath,
}: {
  value: string;
  onChange: (skillId: string) => void;
  /** When user picks a row, also set skill slug for path mode. */
  onPickPath?: (skillPath: string) => void;
}) {
  const labels = useLabels();
  const [items, setItems] = useState<SkillRecordSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.skills
      .list()
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = items.find((s) => s.id === value);

  return (
    <LoadingHost loading={loading} label={t(labels, 'common.loading')}>
      <FormField label={t(labels, 'editor.skillRegistry.label')}>
        <Select
          value={value}
          disabled={loading}
          onChange={(id) => {
            onChange(id);
            const row = items.find((s) => s.id === id);
            if (row && onPickPath) {
              onPickPath(row.slug);
            }
          }}
          options={[
            { value: '', label: t(labels, 'editor.skillRegistry.placeholder') },
            ...(value && !selected
              ? [{ value, label: value }]
              : []),
            ...items.map((s) => ({
              value: s.id,
              label: `${s.name} (${s.slug})`,
            })),
          ]}
        />
        <p className="hint">{t(labels, 'editor.skillRegistry.hint')}</p>
      </FormField>
    </LoadingHost>
  );
}
