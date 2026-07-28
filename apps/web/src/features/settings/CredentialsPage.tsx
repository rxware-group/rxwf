import { t, useLabels } from '../../i18n/labels.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, AwfClientError } from '../../api/client.js';
import { EmptyState } from '../../components/EmptyState.js';
import { Toast } from '../../components/Toast.js';
import { FormField } from '../../components/FormField.js';
import { Select } from '../../components/Select.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { SettingsPageShell, SettingsSection } from './SettingsPageShell.js';

type CredentialTypeSummary = {
  id: string;
  displayName: string;
  description?: string;
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'secret' | 'select';
    required?: boolean;
    placeholder?: string;
    options?: string[];
    defaultValue?: string;
  }>;
};

export function CredentialsPage() {
  const labels = useLabels();

  const [list, setList] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [types, setTypes] = useState<CredentialTypeSummary[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{
    message: string;
    code?: string;
    traceId?: string;
  } | null>(null);
  const { confirm, dialog } = useConfirm();

  const typeById = useMemo(
    () => new Map(types.map((credentialType) => [credentialType.id, credentialType])),
    [types],
  );

  const selectedType = typeById.get(type);

  const showError = (e: unknown) => {
    if (e instanceof AwfClientError) {
      setToast({ message: e.message, code: e.code, traceId: e.traceId });
      return;
    }
    setToast({ message: e instanceof Error ? e.message : t(labels, 'common.operationFailed') });
  };

  const load = useCallback(async () => {
    try {
      const [credentials, typesResponse] = await Promise.all([
        api.credentials.list(),
        api.credentials.listTypes(),
      ]);
      setList(credentials);
      setTypes(typesResponse.types);
      if (typesResponse.types.length > 0) {
        setType((current) =>
          typesResponse.types.some((credentialType) => credentialType.id === current)
            ? current
            : typesResponse.types[0]!.id,
        );
      }
    } catch (e) {
      showError(e);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const def = typeById.get(type);
    const next: Record<string, string> = {};
    for (const field of def?.fields ?? []) {
      next[field.key] = fieldValues[field.key] ?? field.defaultValue ?? '';
    }
    setFieldValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- preserve overlapping keys when switching types
  }, [type, types]);

  const create = async () => {
    const def = typeById.get(type);
    for (const field of def?.fields ?? []) {
      if (field.required && !fieldValues[field.key]?.trim()) {
        setToast({ message: `${field.label} is required` });
        return;
      }
    }
    try {
      await api.credentials.create({ name, type, data: fieldValues });
      setName('');
      setFieldValues({});
      await load();
    } catch (e) {
      showError(e);
    }
  };

  const remove = async (cred: { id: string; name: string }) => {
    const ok = await confirm({
      title: t(labels, 'auto.t_a09693d9'),
      message: t(labels, 'confirm.deleteCredential', { name: cred.name }),
      requireTextMatch: cred.name,
      danger: true,
      confirmLabel: t(labels, 'common.delete'),
    });
    if (!ok) return;
    try {
      await api.credentials.remove(cred.id);
      await load();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <SettingsPageShell>
      {toast && (
        <Toast
          message={toast.message}
          code={toast.code}
          traceId={toast.traceId}
          onDismiss={() => setToast(null)}
        />
      )}
      {dialog}

      <SettingsSection title={t(labels, 'common.registered')}>
        {list.length === 0 ? (
          <EmptyState
            icon="credential"
            title={t(labels, 'auto.t_82e0c0c4')}
            description={t(labels, 'auto.HTTP_Header_API_Key_d297538e')}
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t(labels, 'auto.t_1be7ae4f')}</th>
                <th>{t(labels, 'auto.t_e4e46c72')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{typeById.get(c.type)?.displayName ?? c.type}</td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => void api.credentials.test(c.id)}
                    >
                      {t(labels, 'common.test')}
                    </button>
                    <button
                      type="button"
                      className="btn-link danger"
                      onClick={() => void remove(c)}
                    >
                      {t(labels, 'auto.t_3755f56f')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SettingsSection>

      <SettingsSection title={t(labels, 'common.addNew')}>
        <div className="form-grid">
          <FormField label={t(labels, 'auto.t_1be7ae4f')}>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label={t(labels, 'auto.t_e4e46c72')}>
            <Select
              value={type}
              onChange={setType}
              options={types.map((credentialType) => ({
                value: credentialType.id,
                label: credentialType.displayName,
              }))}
            />
          </FormField>
          {(selectedType?.fields ?? []).map((field) => (
            <FormField key={field.key} label={field.label}>
              {field.type === 'select' ? (
                <Select
                  value={fieldValues[field.key] ?? ''}
                  onChange={(next) =>
                    setFieldValues((prev) => ({ ...prev, [field.key]: next }))
                  }
                  options={[
                    { value: '', label: t(labels, 'common.selectPlaceholder') },
                    ...(field.options ?? []).map((option) => ({
                      value: option,
                      label: option,
                    })),
                  ]}
                />
              ) : (
                <input
                  type={field.type === 'secret' ? 'password' : 'text'}
                  value={fieldValues[field.key] ?? ''}
                  placeholder={field.placeholder}
                  onChange={(e) =>
                    setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                />
              )}
            </FormField>
          ))}
          <button type="button" className="btn-primary" onClick={() => void create()}>
            {t(labels, 'auto.t_fcbd0932')}
          </button>
        </div>
      </SettingsSection>
    </SettingsPageShell>
  );
}
