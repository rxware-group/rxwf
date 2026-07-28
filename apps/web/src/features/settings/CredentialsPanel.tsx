import { t, useLabels } from '../../i18n/labels.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, AwfClientError } from '../../api/client.js';
import { EmptyState } from '../../components/EmptyState.js';
import { Toast } from '../../components/Toast.js';
import { FormField } from '../../components/FormField.js';
import { Select } from '../../components/Select.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { SettingsSection } from './SettingsPageShell.js';
import {
  buildCredentialSelectOptions,
  buildDefaultFieldValues,
  filterCredentialsByAcceptedTypes,
  resolveCredentialTypeDisplayName,
  validateRequiredCredentialFields,
  type CredentialTypeSummary,
  type StoredCredential,
} from './credential-types.js';

type ToastState = {
  message: string;
  code?: string;
  traceId?: string;
} | null;

function useCredentialCatalog() {
  const [list, setList] = useState<StoredCredential[]>([]);
  const [types, setTypes] = useState<CredentialTypeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [credentials, typesResponse] = await Promise.all([
      api.credentials.list(),
      api.credentials.listTypes(),
    ]);
    setList(credentials);
    setTypes(typesResponse.types);
    setLoading(false);
    return { credentials, types: typesResponse.types };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void reload().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const typeById = useMemo(
    () => new Map(types.map((credentialType) => [credentialType.id, credentialType])),
    [types],
  );

  return { list, types, typeById, loading, reload };
}

export function NodeCredentialSelect({
  value,
  onChange,
  acceptedTypes,
}: {
  value: string;
  onChange: (credentialId: string) => void;
  acceptedTypes?: string[];
}) {
  const labels = useLabels();
  const { list, types, loading } = useCredentialCatalog();

  const filtered = useMemo(
    () => filterCredentialsByAcceptedTypes(list, acceptedTypes),
    [acceptedTypes, list],
  );

  const options = useMemo(
    () =>
      buildCredentialSelectOptions(filtered, types, t(labels, 'credential.none')),
    [filtered, labels, types],
  );

  return (
    <FormField label={t(labels, 'settings.nav.credentials')}>
      <Select
        value={value}
        disabled={loading}
        onChange={onChange}
        options={options}
      />
    </FormField>
  );
}

export function CredentialsPanel() {
  const labels = useLabels();
  const { list, types, typeById, reload } = useCredentialCatalog();
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastState>(null);
  const { confirm, dialog } = useConfirm();

  const selectedType = typeById.get(type);

  const showError = (e: unknown) => {
    if (e instanceof AwfClientError) {
      setToast({ message: e.message, code: e.code, traceId: e.traceId });
      return;
    }
    setToast({
      message: e instanceof Error ? e.message : t(labels, 'common.operationFailed'),
    });
  };

  useEffect(() => {
    if (types.length === 0) return;
    setType((current) =>
      types.some((credentialType) => credentialType.id === current)
        ? current
        : types[0]!.id,
    );
  }, [types]);

  useEffect(() => {
    const def = typeById.get(type);
    setFieldValues((prev) => buildDefaultFieldValues(def?.fields ?? [], prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- preserve overlapping keys when switching types
  }, [type, types]);

  const create = async () => {
    const def = typeById.get(type);
    const validationError = validateRequiredCredentialFields(def?.fields ?? [], fieldValues);
    if (validationError) {
      setToast({ message: validationError });
      return;
    }
    try {
      await api.credentials.create({ name, type, data: fieldValues });
      setName('');
      setFieldValues({});
      await reload();
    } catch (e) {
      showError(e);
    }
  };

  const remove = async (cred: StoredCredential) => {
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
      await reload();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <>
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
              {list.map((credential) => (
                <tr key={credential.id}>
                  <td>{credential.name}</td>
                  <td>
                    {resolveCredentialTypeDisplayName(credential.type, types)}
                  </td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => void api.credentials.test(credential.id)}
                    >
                      {t(labels, 'common.test')}
                    </button>
                    <button
                      type="button"
                      className="btn-link danger"
                      onClick={() => void remove(credential)}
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
    </>
  );
}
