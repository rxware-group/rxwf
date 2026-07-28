import { t, useLabels } from '../../i18n/labels.js';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { FormField } from '../../components/FormField.js';
import { SettingsPageShell, SettingsSection } from '../settings/SettingsPageShell.js';

export type GlobalVarRow = {
  key: string;
  value: string;
  sensitive: boolean;
  testId?: string;
  prodId?: string;
};

type ApiVarItem = {
  key: string;
  value: string;
  sensitive: boolean;
  testEnabled: boolean;
  prodEnabled: boolean;
  testId?: string;
  prodId?: string;
};

const emptyDraft = (): GlobalVarRow => ({
  key: '',
  value: '',
  sensitive: false,
});

function mapFromApi(list: ApiVarItem[]): GlobalVarRow[] {
  return list.map((r) => ({
    key: r.key,
    value: r.value === '***' ? '' : r.value,
    sensitive: r.sensitive,
    testId: r.testId,
    prodId: r.prodId,
  }));
}

function mergeRowFromApi(items: ApiVarItem[], key: string): GlobalVarRow | null {
  const row = items.find((r) => r.key === key);
  return row ? mapFromApi([row])[0]! : null;
}

function toSyncPayload(row: GlobalVarRow) {
  return {
    key: row.key.trim(),
    value: row.value,
    sensitive: row.sensitive,
    testEnabled: true,
    prodEnabled: true,
  };
}

export function VariablesPage() {
  const labels = useLabels();

  const [items, setItems] = useState<GlobalVarRow[]>([]);
  const [draft, setDraft] = useState<GlobalVarRow>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(mapFromApi(await api.variables.list()));
    } catch (e) {
      setError(e instanceof Error ? e.message : t(labels, 'common.loadFailed'));
    }
  }, [labels]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyApiItems = (apiItems: ApiVarItem[], keys?: string[]) => {
    if (!keys || keys.length === 0) {
      setItems(mapFromApi(apiItems));
      return;
    }
    setItems((prev) => {
      const next = [...prev];
      for (const key of keys) {
        const merged = mergeRowFromApi(apiItems, key);
        const idx = next.findIndex((r) => r.key === key);
        if (merged) {
          if (idx >= 0) next[idx] = merged;
          else next.push(merged);
        } else if (idx >= 0) {
          next.splice(idx, 1);
        }
      }
      return next.sort((a, b) => a.key.localeCompare(b.key));
    });
  };

  const persistRow = async (row: GlobalVarRow, optimistic = false) => {
    const key = row.key.trim();
    if (!key) {
      setError(t(labels, 'auto.t_db4e8ee6'));
      return;
    }

    const previous = items.find((r) => r.key === key);
    if (optimistic) {
      setItems((prev) => prev.map((r) => (r.key === key ? row : r)));
    }

    setSavingKey(key);
    setError(null);
    setSaved(false);
    try {
      const apiItems = await api.variables.sync([toSyncPayload(row)]);
      applyApiItems(apiItems, [key]);
      setSaved(true);
    } catch (e) {
      if (optimistic && previous) {
        setItems((prev) => prev.map((r) => (r.key === key ? previous : r)));
      }
      setError(e instanceof Error ? e.message : t(labels, 'auto.t_40525a73'));
    } finally {
      setSavingKey(null);
    }
  };

  const saveDraft = async () => {
    const key = draft.key.trim();
    if (!key) {
      setError(t(labels, 'auto.t_db4e8ee6'));
      return;
    }
    setSavingKey(key);
    setError(null);
    setSaved(false);
    try {
      const apiItems = await api.variables.sync([toSyncPayload(draft)]);
      applyApiItems(apiItems);
      setDraft(emptyDraft());
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t(labels, 'auto.t_40525a73'));
    } finally {
      setSavingKey(null);
    }
  };

  const removeRow = async (row: GlobalVarRow) => {
    if (!confirm(t(labels, 'confirm.deleteVar', { key: row.key }))) return;
    setError(null);
    try {
      if (row.testId) await api.variables.remove(row.testId);
      if (row.prodId) await api.variables.remove(row.prodId);
      setItems((prev) => prev.filter((r) => r.key !== row.key));
    } catch (e) {
      setError(e instanceof Error ? e.message : t(labels, 'auto.t_72250c59'));
    }
  };

  return (
    <SettingsPageShell className="env-page variables-page">
      <SettingsSection>
        <table className="data-table env-vars-table">
          <thead>
            <tr>
              <th>{t(labels, 'vars.col.key')}</th>
              <th>{t(labels, 'vars.col.value')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.key}>
                <td>{row.key}</td>
                <td>
                  <input
                    className="env-value-input"
                    value={row.sensitive ? '' : row.value}
                    placeholder={row.sensitive ? '***' : ''}
                    disabled={row.sensitive || savingKey === row.key}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((r) =>
                          r.key === row.key ? { ...r, value: e.target.value } : r,
                        ),
                      )
                    }
                    onBlur={() => void persistRow(row)}
                  />
                </td>
                <td>
                  <button type="button" className="btn-link" onClick={() => void removeRow(row)}>
                    {t(labels, 'auto.t_3755f56f')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SettingsSection>

      <SettingsSection title={t(labels, 'vars.addOrUpdate')}>
        <div className="form-row env-draft-row">
          <input
            placeholder="KEY"
            value={draft.key}
            onChange={(e) => setDraft({ ...draft, key: e.target.value })}
          />
          <input
            placeholder="value"
            value={draft.value}
            onChange={(e) => setDraft({ ...draft, value: e.target.value })}
          />
          <FormField label={t(labels, 'auto.t_e4d1f069')} variant="inline">
            <input
              type="checkbox"
              checked={draft.sensitive}
              onChange={(e) => setDraft({ ...draft, sensitive: e.target.checked })}
            />
          </FormField>
          <button type="button" onClick={() => void saveDraft()}>
            {t(labels, 'auto.t_fadf24db')}
          </button>
        </div>
      </SettingsSection>

      <footer className="env-page-footer">
        {saved && <p className="success env-page-status">{t(labels, 'common.saved')}</p>}
        {error && <p className="error env-page-status">{error}</p>}
      </footer>
    </SettingsPageShell>
  );
}
