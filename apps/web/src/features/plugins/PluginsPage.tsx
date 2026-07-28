import { t, useLabels } from '../../i18n/labels.js';
import { useCallback, useEffect, useState } from 'react';
import { api, type PluginSummary } from '../../api/client.js';
import { EmptyState } from '../../components/EmptyState.js';
import { FormField } from '../../components/FormField.js';
import { SettingsPageShell, SettingsSection } from '../settings/SettingsPageShell.js';

export function PluginsPage() {
  const labels = useLabels();

  const [plugins, setPlugins] = useState<PluginSummary[]>([]);
  const [manifest, setManifest] = useState(
    JSON.stringify({ type: 'demoPlugin', version: 1, handler: 'echo' }, null, 2),
  );
  const [signature, setSignature] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setPlugins(await api.plugins.list());
  }, []);

  useEffect(() => {
    void reload().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [reload]);

  const register = async () => {
    setError(null);
    try {
      await api.plugins.register(manifest, signature);
      setSignature('');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const toggle = async (id: string, enabled: boolean) => {
    if (enabled) await api.plugins.disable(id);
    else await api.plugins.enable(id);
    await reload();
  };

  return (
    <SettingsPageShell lead={<p className="hint settings-page-lead">{t(labels, 'plugins.lead')}</p>}>
      <SettingsSection title={t(labels, 'plugins.register')}>
        <FormField label="Manifest JSON">
          <textarea
            rows={6}
            value={manifest}
            onChange={(e) => setManifest(e.target.value)}
          />
        </FormField>
        <FormField label={t(labels, 'auto.hex_460152fb')}>
          <input
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder={t(labels, 'auto.RXWF_PLUGIN_SECRET_HMAC_S_1ba42709')}
          />
        </FormField>
        <button type="button" className="btn-primary" onClick={() => void register()}>{t(labels, 'common.register')}</button>
      </SettingsSection>

      {error && <p className="error">{error}</p>}

      <SettingsSection title={t(labels, 'plugins.installed')}>
        {plugins.length === 0 ? (
          <EmptyState
            icon="plugin"
            title={t(labels, 'auto.t_d1f4ef4d')}
            description={t(labels, 'auto.manifest_664f1c06')}
            actions={
              <>
                <button type="button" className="btn-primary" onClick={() => void register()}>{t(labels, 'plugins.upload')}</button>
                <a href="/setup" className="btn-secondary">{t(labels, 'plugins.viewDocs')}</a>
              </>
            }
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t(labels, 'auto.t_e4e46c72')}</th>
                <th>{t(labels, 'auto.t_989d1aff')}</th>
                <th>{t(labels, 'auto.t_62e951a6')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {plugins.map((p) => (
                <tr key={p.id}>
                  <td>{p.type}</td>
                  <td>{p.version}</td>
                  <td>{p.enabled ? t(labels, 'auto.t_d4e9ca3d') : t(labels, 'auto.t_be70be5a')}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => void toggle(p.id, p.enabled)}
                    >
                      {p.enabled ? t(labels, 'auto.t_be70be5a') : t(labels, 'auto.t_d4e9ca3d')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SettingsSection>
    </SettingsPageShell>
  );
}
