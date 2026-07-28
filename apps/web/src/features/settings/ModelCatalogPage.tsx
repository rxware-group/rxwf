import { t, useLabels, type LabelMap } from '../../i18n/labels.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  api,
  type ModelHealthStatus,
  type ModelProviderKind,
  type ModelProviderSummary,
  type ModelSummary,
} from '../../api/client.js';
import { EmptyState } from '../../components/EmptyState.js';
import { FormField } from '../../components/FormField.js';
import { Select } from '../../components/Select.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import type { SettingsOutletContext } from './settings-context.js';
import { SettingsPageShell, SettingsSection } from './SettingsPageShell.js';

function healthLabel(labels: LabelMap, status: ModelHealthStatus): string {
  if (status === 'ok') return t(labels, 'auto.t_f78d037a');
  if (status === 'error') return t(labels, 'auto.t_5caf2793');
  return t(labels, 'auto.t_d9c32a4c');
}

const HEALTH_CLASS: Record<ModelHealthStatus, string> = {
  ok: 'success',
  error: 'form-error',
  unknown: 'hint',
};

const emptyProviderForm = {
  name: '',
  kind: 'ollama' as ModelProviderKind,
  baseUrl: 'http://127.0.0.1:11434',
};

function providerKindLabel(labels: LabelMap, kind: ModelProviderKind): string {
  if (kind === 'ollama') return t(labels, 'settings.catalog.providerKindLlm');
  if (kind === 'openai-compatible') return t(labels, 'settings.catalog.openaiCompatible');
  return kind;
}

export function ModelCatalogPage() {
  const labels = useLabels();

  const { user } = useOutletContext<SettingsOutletContext>();
  const isAdmin = user.role === 'admin';

  const [providers, setProviders] = useState<ModelProviderSummary[]>([]);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProviderForm);
  const [busyProviderId, setBusyProviderId] = useState<string | null>(null);
  const [busyModelId, setBusyModelId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [nextProviders, nextModels] = await Promise.all([
      api.models.listProviders(),
      api.models.list(),
    ]);
    setProviders(nextProviders);
    setModels(nextModels);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void reload()
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const modelsByProvider = useMemo(() => {
    const map = new Map<string, ModelSummary[]>();
    for (const model of models) {
      const list = map.get(model.providerId) ?? [];
      list.push(model);
      map.set(model.providerId, list);
    }
    return map;
  }, [models]);

  const createProvider = async () => {
    setError(null);
    setMessage(null);
    if (!form.name.trim() || !form.baseUrl.trim()) {
      setError(t(labels, 'auto.t_6be3f616'));
      return;
    }
    try {
      await api.models.createProvider({
        name: form.name.trim(),
        kind: form.kind,
        baseUrl: form.baseUrl.trim(),
      });
      setForm(emptyProviderForm);
      setMessage(t(labels, 'auto.t_552f0c37'));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const syncProvider = async (providerId: string) => {
    setError(null);
    setMessage(null);
    setBusyProviderId(providerId);
    try {
      await api.models.sync(providerId);
      setMessage(t(labels, 'auto.t_e802f6d7'));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyProviderId(null);
    }
  };

  const setDefaultChat = async (modelId: string) => {
    setError(null);
    setMessage(null);
    setBusyModelId(modelId);
    try {
      await api.models.update(modelId, { isDefaultChat: true });
      setMessage(t(labels, 'auto.Chat_3c8e5f8f'));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyModelId(null);
    }
  };

  const refreshHealth = async (providerId: string) => {
    setError(null);
    setBusyProviderId(providerId);
    try {
      const updated = await api.models.healthCheckProvider(providerId);
      setProviders((prev) => prev.map((p) => (p.id === providerId ? updated : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyProviderId(null);
    }
  };

  const setDefaultWorkflow = async (modelId: string) => {
    setError(null);
    setMessage(null);
    setBusyModelId(modelId);
    try {
      await api.models.update(modelId, { isDefaultWorkflow: true });
      setMessage(t(labels, 'settings.catalog.defaultWorkflowSaved'));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyModelId(null);
    }
  };

  const defaultWorkflowModel = useMemo(
    () => models.find((m) => m.enabled && m.isDefaultWorkflow) ?? null,
    [models],
  );
  const defaultWorkflowProvider = useMemo(
    () =>
      defaultWorkflowModel
        ? providers.find((p) => p.id === defaultWorkflowModel.providerId)
        : null,
    [defaultWorkflowModel, providers],
  );

  return (
    <SettingsPageShell lead={<p className="hint settings-page-lead">{t(labels, 'settings.catalog.lead')}</p>}>

      <LoadingHost loading={loading} label={t(labels, 'common.loading')}>
      {error && <p className="form-error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <SettingsSection title={t(labels, 'settings.catalog.workflowDefault')}>
        {defaultWorkflowModel && defaultWorkflowProvider ? (
          <p className="hint">
            {t(labels, 'settings.catalog.workflowDefaultCurrent', {
              model: defaultWorkflowModel.modelName,
              url: defaultWorkflowProvider.baseUrl,
            })}
          </p>
        ) : (
          <p className="hint">{t(labels, 'settings.catalog.workflowDefaultUnset')}</p>
        )}
      </SettingsSection>

      {isAdmin && (
        <SettingsSection title={t(labels, 'settings.catalog.addProvider')}>
          <FormField label={t(labels, 'auto.t_1be7ae4f')}>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormField>
          <FormField label={t(labels, 'auto.t_e4e46c72')}>
            <Select
              value={form.kind}
              onChange={(kind) => setForm({ ...form, kind: kind as ModelProviderKind })}
              options={[
                { value: 'ollama', label: providerKindLabel(labels, 'ollama') },
                {
                  value: 'openai-compatible',
                  label: t(labels, 'settings.catalog.openaiCompatible'),
                },
              ]}
            />
          </FormField>
          <FormField label={t(labels, 'auto.t_86e11829')}>
            <input
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              className="mono"
            />
          </FormField>
          <button type="button" className="btn-primary" onClick={() => void createProvider()}>{t(labels, 'common.add')}</button>
        </SettingsSection>
      )}

      {providers.length === 0 && !loading ? (
        <EmptyState
          icon="ollama"
          title={t(labels, 'auto.t_caf30606')}
          description={
            isAdmin
              ? t(labels, 'settings.catalog.emptyAdminHint')
              : t(labels, 'auto.t_659bdada')
          }
        />
      ) : (
        providers.map((provider) => {
          const providerModels = modelsByProvider.get(provider.id) ?? [];
          const busy = busyProviderId === provider.id;

          return (
            <SettingsSection key={provider.id} title={provider.name}>
              <LoadingHost
                loading={busy || providerModels.some((model) => busyModelId === model.id)}
                label={t(labels, 'common.loading')}
              >
              <div className="rxwf-inline-group">
                <span className="role-tag">{providerKindLabel(labels, provider.kind)}</span>
                {!provider.enabled && <span className="hint">{t(labels, 'common.disabled')}</span>}
                <span className={HEALTH_CLASS[provider.healthStatus]}>
                  {t(labels, 'settings.catalog.health', {
                    status: healthLabel(labels, provider.healthStatus),
                  })}
                </span>
              </div>
              <p className="hint mono rxwf-mt-inline">
                {provider.baseUrl}
              </p>
              {provider.lastHealthAt && (
                <p className="hint">
                  {t(labels, 'settings.catalog.lastHealth', {
                    time: new Date(provider.lastHealthAt).toLocaleString(),
                  })}
                </p>
              )}

              {isAdmin && (
                <div className="rxwf-inline-group rxwf-mt-4 rxwf-mb-4">
                  {provider.kind === 'ollama' && (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() => void syncProvider(provider.id)}
                    >
                      {t(labels, 'settings.catalog.syncModels')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() => void refreshHealth(provider.id)}
                  >
                    {t(labels, 'auto.t_fa5cbe6b')}
                  </button>
                </div>
              )}

              {providerModels.length === 0 ? (
                <p className="hint">
                  {t(labels, 'settings.catalog.noModels')}
                  {provider.kind === 'ollama' && isAdmin ? t(labels, 'settings.catalog.noModelsSyncHint') : ''}
                </p>
              ) : (
                <ul className="list-plain rxwf-mt-4">
                  {providerModels.map((model) => (
                    <li
                      key={model.id}
                      className="card settings-catalog-model-row"
                    >
                      <div>
                        <strong>{model.modelName}</strong>
                        {model.isDefaultChat && (
                          <span className="role-tag settings-catalog-tag">{t(labels, 'settings.catalog.defaultChat')}</span>
                        )}
                        {model.isDefaultWorkflow && (
                          <span className="role-tag settings-catalog-tag">{t(labels, 'settings.catalog.defaultWorkflow')}</span>
                        )}
                        {!model.enabled && (
                          <span className="hint settings-catalog-tag">{t(labels, 'editor.disabled')}</span>
                        )}
                        <p className="hint settings-catalog-model-meta">
                          {model.capabilities.join(', ')} · {model.source}
                        </p>
                      </div>
                      <div className="rxwf-inline-group">
                      {isAdmin && provider.kind === 'ollama' && !model.isDefaultWorkflow && model.enabled && (
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={busyModelId === model.id}
                          onClick={() => void setDefaultWorkflow(model.id)}
                        >
                          {t(labels, 'settings.catalog.setDefaultWorkflow')}
                        </button>
                      )}
                      {isAdmin && !model.isDefaultChat && model.enabled && (
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={busyModelId === model.id}
                          onClick={() => void setDefaultChat(model.id)}
                        >
                          {t(labels, 'auto.t_536a009a')}
                        </button>
                      )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              </LoadingHost>
            </SettingsSection>
          );
        })
      )}
      </LoadingHost>
    </SettingsPageShell>
  );
}
