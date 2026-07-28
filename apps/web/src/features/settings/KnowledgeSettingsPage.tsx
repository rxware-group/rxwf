import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  api,
  type KnowledgePlatformSettingsSnapshot,
  type ModelSummary,
} from '../../api/client.js';
import { FormField } from '../../components/FormField.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { Modal } from '../../components/Modal.js';
import { Select } from '../../components/Select.js';
import { t, useLabels } from '../../i18n/labels.js';
import type { SettingsOutletContext } from './settings-context.js';
import { SettingsPageShell, SettingsSection } from './SettingsPageShell.js';

const EMBEDDING_PROVIDERS = [
  { value: 'ollama', label: 'Ollama' },
  { value: 'openai-compatible', label: 'OpenAI compatible' },
] as const;

export function KnowledgeSettingsPage() {
  const labels = useLabels();
  const { user } = useOutletContext<SettingsOutletContext>();
  const isAdmin = user.role === 'admin';

  const [form, setForm] = useState<KnowledgePlatformSettingsSnapshot | null>(null);
  const [initial, setInitial] = useState<KnowledgePlatformSettingsSnapshot | null>(null);
  const [chatModels, setChatModels] = useState<ModelSummary[]>([]);
  const [credentials, setCredentials] = useState<Array<{ id: string; name: string; type: string }>>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [reindexOpen, setReindexOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<{
    saveAndReindex: boolean;
  } | null>(null);

  const reload = useCallback(async () => {
    const [settings, models, creds] = await Promise.all([
      api.settings.getKnowledge(),
      api.models.list('chat'),
      isAdmin ? api.credentials.list() : Promise.resolve([]),
    ]);
    setForm(settings);
    setInitial(settings);
    setChatModels(models.filter((m) => m.enabled));
    setCredentials(creds);
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
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

  const apiKeyCredentials = useMemo(
    () => credentials.filter((c) => c.type === 'apiKey'),
    [credentials],
  );

  const embeddingChanged = useMemo(() => {
    if (!form || !initial) return false;
    const keys = ['provider', 'baseUrl', 'defaultModel', 'credentialId'] as const;
    return keys.some((key) => {
      const a = initial.embedding[key] ?? '';
      const b = form.embedding[key] ?? '';
      return String(a) !== String(b);
    });
  }, [form, initial]);

  const updateEmbedding = <K extends keyof KnowledgePlatformSettingsSnapshot['embedding']>(
    key: K,
    value: KnowledgePlatformSettingsSnapshot['embedding'][K],
  ) => {
    setForm((prev) =>
      prev ? { ...prev, embedding: { ...prev.embedding, [key]: value } } : prev,
    );
  };

  const updateRag = <K extends keyof KnowledgePlatformSettingsSnapshot['rag']>(
    key: K,
    value: KnowledgePlatformSettingsSnapshot['rag'][K],
  ) => {
    setForm((prev) => (prev ? { ...prev, rag: { ...prev.rag, [key]: value } } : prev));
  };

  const updateDefaults = <K extends keyof KnowledgePlatformSettingsSnapshot['defaults']>(
    key: K,
    value: KnowledgePlatformSettingsSnapshot['defaults'][K],
  ) => {
    setForm((prev) => (prev ? { ...prev, defaults: { ...prev.defaults, [key]: value } } : prev));
  };

  const persist = async (saveAndReindex: boolean) => {
    if (!form || !isAdmin) return;
    setMessage(null);
    setError(null);
    try {
      const result = await api.settings.updateKnowledge(form);
      await reload();
      if (saveAndReindex && result.embeddingChanged) {
        await api.settings.reindexAllKnowledgeBases();
        setMessage(t(labels, 'settings.knowledge.saveAndReindex', undefined, '已保存并排队全库 reindex'));
      } else {
        setMessage(t(labels, 'auto.t_fadf24db', undefined, '已保存'));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const save = async () => {
    if (!form) return;
    if (embeddingChanged) {
      setPendingSave({ saveAndReindex: false });
      setReindexOpen(true);
      return;
    }
    await persist(false);
  };

  const testEmbedding = async () => {
    if (!form || !isAdmin) return;
    setTesting(true);
    setMessage(null);
    setError(null);
    try {
      const result = await api.settings.testKnowledgeEmbedding(form);
      setMessage(
        `${t(labels, 'settings.knowledge.testOk')} (${result.dimensions}d, ${result.latencyMs}ms)`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  if (loading || !form) {
    return (
      <SettingsPageShell>
        <LoadingHost loading minHeight="12rem" label={t(labels, 'common.loading')} />
      </SettingsPageShell>
    );
  }

  const readOnly = !isAdmin || !form.editable;

  return (
    <SettingsPageShell
      lead={
        <p className="hint settings-page-lead">
          {readOnly
            ? t(labels, 'settings.knowledge.readOnlyHint')
            : t(labels, 'settings.knowledge.lead')}
        </p>
      }
    >
      {error && <p className="form-error">{error}</p>}
      {message && <p className="hint success">{message}</p>}
      {embeddingChanged && isAdmin && (
        <p className="hint form-error">{t(labels, 'settings.knowledge.reindexWarning')}</p>
      )}

      <SettingsSection title={t(labels, 'settings.knowledge.embedding')}>
        <FormField label={t(labels, 'settings.knowledge.embeddingProvider')}>
          <Select
            value={form.embedding.provider}
            disabled={readOnly}
            onChange={(value) =>
              updateEmbedding('provider', value as 'ollama' | 'openai-compatible')
            }
            options={EMBEDDING_PROVIDERS.map((p) => ({ value: p.value, label: p.label }))}
          />
        </FormField>
        <FormField label={t(labels, 'settings.knowledge.baseUrl')}>
          <input
            className="input"
            value={form.embedding.baseUrl}
            disabled={readOnly}
            onChange={(e) => updateEmbedding('baseUrl', e.target.value)}
          />
        </FormField>
        {form.embedding.provider === 'openai-compatible' && (
          <FormField label={t(labels, 'settings.knowledge.credential')}>
            <Select
              value={form.embedding.credentialId ?? ''}
              disabled={readOnly}
              onChange={(value) => updateEmbedding('credentialId', value || undefined)}
              options={[
                { value: '', label: '—' },
                ...apiKeyCredentials.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </FormField>
        )}
        <FormField label={t(labels, 'settings.knowledge.defaultEmbeddingModel')}>
          <input
            className="input"
            value={form.embedding.defaultModel}
            disabled={readOnly}
            onChange={(e) => updateEmbedding('defaultModel', e.target.value)}
          />
        </FormField>
        {isAdmin && (
          <button
            type="button"
            className="btn-secondary"
            disabled={testing}
            onClick={() => void testEmbedding()}
          >
            {t(labels, 'settings.knowledge.testEmbedding')}
          </button>
        )}
      </SettingsSection>

      <SettingsSection title={t(labels, 'settings.knowledge.rag')}>
        <FormField label={t(labels, 'settings.knowledge.defaultRagModel')}>
          <Select
            value={form.rag.defaultModelId}
            disabled={readOnly}
            onChange={(value) => updateRag('defaultModelId', value)}
            options={[
              { value: '', label: '—' },
              ...chatModels.map((m) => ({
                value: m.id,
                label: `${m.modelName} (${m.providerId.slice(0, 8)}…)`,
              })),
            ]}
          />
        </FormField>
        <FormField label={t(labels, 'settings.knowledge.ragTemplate')}>
          <Select
            value={form.rag.defaultTemplate}
            disabled={readOnly}
            onChange={(value) => updateRag('defaultTemplate', value as 'support' | 'code')}
            options={[
              { value: 'support', label: 'support' },
              { value: 'code', label: 'code' },
            ]}
          />
        </FormField>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.rag.fallbackToChat}
            disabled={readOnly}
            onChange={(e) => updateRag('fallbackToChat', e.target.checked)}
          />
          {t(labels, 'settings.knowledge.fallbackToChat')}
        </label>
      </SettingsSection>

      <SettingsSection title={t(labels, 'settings.knowledge.defaults')}>
        <FormField label={t(labels, 'settings.knowledge.chunkSize')}>
          <input
            type="number"
            className="input"
            disabled={readOnly}
            value={form.defaults.chunkSize}
            onChange={(e) => updateDefaults('chunkSize', Number(e.target.value))}
          />
        </FormField>
        <FormField label={t(labels, 'settings.knowledge.chunkOverlap')}>
          <input
            type="number"
            className="input"
            disabled={readOnly}
            value={form.defaults.chunkOverlap}
            onChange={(e) => updateDefaults('chunkOverlap', Number(e.target.value))}
          />
        </FormField>
        <FormField label={t(labels, 'settings.knowledge.topK')}>
          <input
            type="number"
            className="input"
            disabled={readOnly}
            value={form.defaults.topK}
            onChange={(e) => updateDefaults('topK', Number(e.target.value))}
          />
        </FormField>
        <FormField label={t(labels, 'settings.knowledge.similarityThreshold')}>
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            className="input"
            disabled={readOnly}
            value={form.defaults.similarityThreshold}
            onChange={(e) => updateDefaults('similarityThreshold', Number(e.target.value))}
          />
        </FormField>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.defaults.hybridSearchEnabled}
            disabled={readOnly}
            onChange={(e) => updateDefaults('hybridSearchEnabled', e.target.checked)}
          />
          {t(labels, 'settings.knowledge.hybridSearch')}
        </label>
      </SettingsSection>

      <SettingsSection title={t(labels, 'settings.knowledge.status')}>
        <p className="muted">
          {t(labels, 'settings.knowledge.configured')}: {form.configured ? 'yes' : 'no'}
        </p>
        <p className="muted">
          profile: {form.status.profile} · queue: {form.status.jobQueue}
        </p>
        {form.embedding.dimensions != null && (
          <p className="muted">dimensions: {form.embedding.dimensions}</p>
        )}
      </SettingsSection>

      {isAdmin && (
        <footer className="settings-panel-actions">
          <button type="button" className="btn-primary" onClick={() => void save()}>
            {t(labels, 'common.save', undefined, '保存')}
          </button>
        </footer>
      )}

      <Modal
        open={reindexOpen}
        title={t(labels, 'settings.knowledge.reindexWarning')}
        onClose={() => {
          setReindexOpen(false);
          setPendingSave(null);
        }}
        footer={
          <footer className="rxwf-modal-footer">
            <div className="rxwf-modal-footer-right">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setReindexOpen(false);
                  void persist(true);
                }}
              >
                {t(labels, 'settings.knowledge.saveAndReindex')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setReindexOpen(false);
                  void persist(false);
                }}
              >
                {t(labels, 'common.save', undefined, '仅保存')}
              </button>
            </div>
          </footer>
        }
      >
        <p>{t(labels, 'settings.knowledge.reindexWarning')}</p>
      </Modal>
    </SettingsPageShell>
  );
}
