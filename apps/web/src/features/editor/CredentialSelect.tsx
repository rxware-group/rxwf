import { t, useLabels } from '../../i18n/labels.js';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { FormField } from '../../components/FormField.js';
import { Select } from '../../components/Select.js';

export function CredentialSelect({
  value,
  onChange,
  acceptedTypes,
}: {
  value: string;
  onChange: (credentialId: string) => void;
  acceptedTypes?: string[];
}) {
  const labels = useLabels();

  const [options, setOptions] = useState<Array<{ id: string; name: string; type: string }>>(
    [],
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void api.credentials.list().then((list) => {
      if (!cancelled) {
        setOptions(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = acceptedTypes?.length
    ? options.filter((c) => acceptedTypes.includes(c.type))
    : options;

  return (
    <FormField label={t(labels, 'settings.nav.credentials')}>
      <Select
        value={value}
        disabled={loading}
        onChange={onChange}
        options={[
          { value: '', label: t(labels, 'credential.none') },
          ...filtered.map((c) => ({
            value: c.id,
            label: `${c.name} (${c.type})`,
          })),
        ]}
      />
    </FormField>
  );
}
