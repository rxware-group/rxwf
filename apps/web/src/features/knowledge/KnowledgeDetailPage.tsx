import { t, useLabels } from '../../i18n/labels.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  type KnowledgeBaseSummary,
  type KnowledgeChunkPreview,
  type KnowledgeDocumentSummary,
  type KnowledgePlatformSettingsSnapshot,
  type KnowledgeSyncSourceSummary,
} from '../../api/client.js';
import { FormField } from '../../components/FormField.js';
import { Modal } from '../../components/Modal.js';
import { KnowledgeCollaboratorsPanel } from './KnowledgeCollaboratorsPanel.js';
import type { WorkflowAccessRole } from '../../api/client.js';

type Tab = 'documents' | 'chunks' | 'query' | 'sync' | 'collaborators';

type RetrievalForm = {
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  hybridSearchEnabled: boolean;
};

function canShareKnowledge(accessRole?: WorkflowAccessRole | null): boolean {
  return accessRole === 'admin' || accessRole === 'owner' || accessRole === 'editor';
}

function canEditKnowledgeContent(accessRole?: WorkflowAccessRole | null): boolean {
  return (
    accessRole === 'admin' ||
    accessRole === 'owner' ||
    accessRole === 'editor' ||
    accessRole == null
  );
}

function formFromKb(kb: KnowledgeBaseSummary): RetrievalForm {
  return {
    embeddingModel: kb.embeddingModel ?? '',
    chunkSize: kb.chunkSize,
    chunkOverlap: kb.chunkOverlap,
    topK: kb.topK,
    similarityThreshold: kb.similarityThreshold,
    hybridSearchEnabled: Boolean(kb.hybridSearchEnabled),
  };
}

function BackArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

export function KnowledgeDetailPage() {
  const labels = useLabels();

  const { kbId } = useParams<{ kbId: string }>();
  const [kb, setKb] = useState<KnowledgeBaseSummary | null>(null);
  const [platform, setPlatform] = useState<KnowledgePlatformSettingsSnapshot | null>(null);
  const [paramsForm, setParamsForm] = useState<RetrievalForm | null>(null);
  const [paramsInitial, setParamsInitial] = useState<RetrievalForm | null>(null);
  const [docs, setDocs] = useState<KnowledgeDocumentSummary[]>([]);
  const [chunks, setChunks] = useState<KnowledgeChunkPreview[]>([]);
  const [tab, setTab] = useState<Tab>('documents');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<
    Array<{ text: string; score: number; documentName: string; chunkIndex: number }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [syncSources, setSyncSources] = useState<KnowledgeSyncSourceSummary[]>([]);
  const [syncPath, setSyncPath] = useState('');
  const [idCopied, setIdCopied] = useState(false);
  const [reindexOpen, setReindexOpen] = useState(false);
  const [paramsBusy, setParamsBusy] = useState(false);
  const [paramsExpanded, setParamsExpanded] = useState(false);

  const reload = useCallback(async () => {
    if (!kbId) return;
    const [base, documents, platformSettings] = await Promise.all([
      api.knowledgeBases.get(kbId),
      api.knowledgeBases.listDocuments(kbId),
      api.settings.getKnowledge().catch(() => null),
    ]);
    setKb(base);
    setDocs(documents);
    setPlatform(platformSettings);
    const form = formFromKb(base);
    setParamsForm(form);
    setParamsInitial(form);
    if (tab === 'chunks') {
      setChunks(await api.knowledgeBases.listChunks(kbId));
    }
    if (tab === 'sync') {
      setSyncSources(await api.knowledgeBases.listSyncSources(kbId));
    }
  }, [kbId, tab]);

  const embeddingModelChanged = useMemo(() => {
    if (!paramsForm || !paramsInitial) return false;
    return paramsForm.embeddingModel.trim() !== paramsInitial.embeddingModel.trim();
  }, [paramsForm, paramsInitial]);

  const persistParams = async (saveAndReindex: boolean) => {
    if (!kbId || !paramsForm) return;
    setParamsBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.knowledgeBases.patch(kbId, {
        embeddingModel: paramsForm.embeddingModel.trim(),
        chunkSize: paramsForm.chunkSize,
        chunkOverlap: paramsForm.chunkOverlap,
        topK: paramsForm.topK,
        similarityThreshold: paramsForm.similarityThreshold,
        hybridSearchEnabled: paramsForm.hybridSearchEnabled,
      });
      setKb(updated);
      const next = formFromKb(updated);
      setParamsForm(next);
      setParamsInitial(next);
      if (saveAndReindex && embeddingModelChanged) {
        await api.knowledgeBases.reindexAll(kbId);
        setMessage(
          t(labels, 'knowledge.saveAndReindexKb', undefined, '已保存并排队本库 reindex'),
        );
      } else {
        setMessage(t(labels, 'knowledge.paramsSaved', undefined, '检索参数已保存'));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setParamsBusy(false);
    }
  };

  const saveParams = () => {
    if (embeddingModelChanged) {
      setReindexOpen(true);
      return;
    }
    void persistParams(false);
  };

  useEffect(() => {
    void reload().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [reload]);

  const onUpload = async (file: File) => {
    if (!kbId) return;
    setError(null);
    await api.knowledgeBases.uploadDocument(kbId, file);
    await reload();
  };

  const runQuery = async () => {
    if (!kbId || !query.trim()) return;
    setError(null);
    setHits([]);
    try {
      const result = await api.knowledgeBases.query(kbId, query.trim());
      setHits(result.hits);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const copyKbId = async () => {
    const id = kb?.id ?? kbId;
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setIdCopied(true);
      window.setTimeout(() => setIdCopied(false), 2000);
    } catch {
      setError(t(labels, 'common.operationFailed', undefined, '操作失败'));
    }
  };

  if (!kbId) return null;

  const canEdit = canEditKnowledgeContent(kb?.accessRole);
  const platformEmbedding = platform?.embedding.defaultModel ?? '—';

  return (
    <main className="main page">
      <header className="page-header">
        <h2 className="page-title-with-back rxwf-type-page-title">
          <Link
            to="/knowledge"
            className="page-back-link"
            aria-label={t(labels, 'knowledge.backToList')}
          >
            <BackArrowIcon />
          </Link>
          {kb?.name ?? t(labels, 'auto.t_1dda51f9')}
        </h2>
        {kb?.description && <p className="muted">{kb.description}</p>}
        <p className="rxwf-type-meta">
          <span>{t(labels, 'knowledge.idLabel', undefined, '知识库 ID')}：</span>
          <code style={{ userSelect: 'all' }}>{kb?.id ?? kbId}</code>
          <button
            type="button"
            className="btn-link rxwf-ml-inline"
            onClick={() => void copyKbId()}
          >
            {idCopied
              ? t(labels, 'knowledge.idCopied', undefined, '已复制')
              : t(labels, 'knowledge.copyId', undefined, '复制 ID')}
          </button>
        </p>
      </header>

      {paramsForm && (
        <section
          className={`card knowledge-retrieval-panel${paramsExpanded ? ' is-expanded' : ' is-collapsed'}`}
        >
          <button
            type="button"
            className="knowledge-retrieval-panel__toggle"
            aria-expanded={paramsExpanded}
            aria-controls="knowledge-retrieval-panel-body"
            onClick={() => setParamsExpanded((open) => !open)}
          >
            <h3>{t(labels, 'knowledge.retrievalParams', undefined, '检索参数')}</h3>
            <span className="knowledge-retrieval-panel__chevron" aria-hidden>
              {paramsExpanded ? '▾' : '▸'}
            </span>
            <span className="sr-only">
              {paramsExpanded
                ? t(labels, 'help.nav.collapse', undefined, '收起')
                : t(labels, 'help.nav.expand', undefined, '展开')}
            </span>
          </button>
          {paramsExpanded && (
            <div id="knowledge-retrieval-panel-body" className="knowledge-retrieval-panel__body">
          {embeddingModelChanged && canEdit && (
            <p className="hint form-error">
              {t(labels, 'knowledge.reindexKbWarning')}
            </p>
          )}
          <FormField label={t(labels, 'knowledge.embeddingModel', undefined, 'Embedding 模型')}>
            <input
              className="input"
              disabled={!canEdit}
              placeholder={platformEmbedding}
              value={paramsForm.embeddingModel}
              onChange={(e) =>
                setParamsForm((prev) =>
                  prev ? { ...prev, embeddingModel: e.target.value } : prev,
                )
              }
            />
          </FormField>
          <p className="muted rxwf-field-hint-tight">
            {t(labels, 'knowledge.embeddingModelHint', { model: platformEmbedding })}
          </p>
          <div className="form-grid-2">
            <FormField label={t(labels, 'knowledge.chunkSize', undefined, '分块大小')}>
              <input
                type="number"
                className="input"
                disabled={!canEdit}
                value={paramsForm.chunkSize}
                onChange={(e) =>
                  setParamsForm((prev) =>
                    prev ? { ...prev, chunkSize: Number(e.target.value) } : prev,
                  )
                }
              />
            </FormField>
            <FormField label={t(labels, 'knowledge.chunkOverlap', undefined, '分块重叠')}>
              <input
                type="number"
                className="input"
                disabled={!canEdit}
                value={paramsForm.chunkOverlap}
                onChange={(e) =>
                  setParamsForm((prev) =>
                    prev ? { ...prev, chunkOverlap: Number(e.target.value) } : prev,
                  )
                }
              />
            </FormField>
            <FormField label={t(labels, 'knowledge.topK', undefined, 'Top K')}>
              <input
                type="number"
                className="input"
                disabled={!canEdit}
                value={paramsForm.topK}
                onChange={(e) =>
                  setParamsForm((prev) =>
                    prev ? { ...prev, topK: Number(e.target.value) } : prev,
                  )
                }
              />
            </FormField>
            <FormField label={t(labels, 'knowledge.thresholdLabel')}>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                className="input"
                disabled={!canEdit}
                value={paramsForm.similarityThreshold}
                onChange={(e) =>
                  setParamsForm((prev) =>
                    prev ? { ...prev, similarityThreshold: Number(e.target.value) } : prev,
                  )
                }
              />
            </FormField>
          </div>
          <label className="rxwf-inline-group rxwf-mt-inline">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={paramsForm.hybridSearchEnabled}
              onChange={(e) =>
                setParamsForm((prev) =>
                  prev ? { ...prev, hybridSearchEnabled: e.target.checked } : prev,
                )
              }
            />
            {t(labels, 'knowledge.hybridSearch')}
          </label>
          {canEdit && (
            <button
              type="button"
              className="btn-primary rxwf-mt-block"
              disabled={paramsBusy}
              onClick={() => saveParams()}
            >
              {t(labels, 'knowledge.saveRetrievalParams', undefined, '保存检索参数')}
            </button>
          )}
            </div>
          )}
        </section>
      )}

      <div className="segmented rxwf-mb-block">
        {(['documents', 'chunks', 'query', 'sync', 'collaborators'] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            className={tab === tabKey ? 'is-active' : ''}
            onClick={() => setTab(tabKey)}
          >
            {tabKey === 'documents'
              ? t(labels, 'auto.t_10691272')
              : tabKey === 'chunks'
                ? t(labels, 'auto.t_a513e1d2')
                : tabKey === 'query'
                  ? t(labels, 'auto.t_47467b8b')
                  : tabKey === 'sync'
                    ? t(labels, 'auto.t_978d8be4')
                    : t(labels, 'editor.collaborators')}
          </button>
        ))}
      </div>

      {error && <p className="form-error">{error}</p>}
      {message && <p className="hint success">{message}</p>}

      {tab === 'documents' && (
        <section className="card knowledge-tab-card">
          {canEdit && (
            <FormField label={t(labels, 'auto.TXT_MD_HTML_PDF_50MB_e5a800d5')}>
              <input
                type="file"
                accept=".txt,.md,.html,.htm,.pdf,text/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(f);
                }}
              />
            </FormField>
          )}
          <ul className="list-plain">
            {docs.map((d) => (
              <li key={d.id} className="rxwf-list-row">
                <strong>{d.name}</strong>{' '}
                <span className="muted">
                  {d.status} · {d.chunkCount} chunks · {(d.sizeBytes / 1024).toFixed(1)} KB
                </span>
                {d.errorMessage && (
                  <p className="form-error">
                    {d.errorMessage}
                  </p>
                )}
                {canEdit && (
                  <div className="rxwf-inline-group rxwf-mt-1">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => void api.knowledgeBases.reindex(kbId, d.id).then(reload)}
                    >{t(labels, 'knowledge.reindex')}</button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => void api.knowledgeBases.deleteDocument(kbId, d.id).then(reload)}
                    >{t(labels, 'auto.t_3755f56f')}</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'chunks' && (
        <section className="card knowledge-tab-card">
          <button type="button" className="btn-secondary" onClick={() => void reload()}>{t(labels, 'auto.t_38108eaa')}</button>
          <ul className="list-plain">
            {chunks.map((c) => (
              <li key={c.id} className="rxwf-list-row-lg">
                <span className="muted">
                  #{c.chunkIndex} · doc {c.documentId.slice(0, 8)}
                </span>
                <pre className="rxwf-type-code">{c.text}</pre>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'sync' && (
        <section className="card knowledge-tab-card">
          <p className="muted">{t(labels, 'knowledge.syncLead')}</p>
          {canEdit && (
            <>
              <FormField label={t(labels, 'auto.t_3e512f09')}>
                <input
                  type="text"
                  value={syncPath}
                  onChange={(e) => setSyncPath(e.target.value)}
                  placeholder={t(labels, 'knowledge.syncPlaceholder')}
                />
              </FormField>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (!kbId || !syncPath.trim()) return;
                  void api.knowledgeBases
                    .createSyncSource(kbId, { path: syncPath.trim() })
                    .then(() => reload())
                    .catch((e) => setError(e instanceof Error ? e.message : String(e)));
                }}
              >{t(labels, 'knowledge.addSyncSource')}</button>
            </>
          )}
          <ul className="list-plain">
            {syncSources.map((s) => (
              <li key={s.id} className="rxwf-list-row-lg">
                <code>{s.config.path}</code>
                {s.lastError && <p className="form-error">{s.lastError}</p>}
                {canEdit && (
                  <div className="rxwf-inline-group rxwf-mt-1">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        void api.knowledgeBases.triggerSync(kbId, s.id).catch((e) => setError(String(e)))
                      }
                    >{t(labels, 'knowledge.syncNow')}</button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => void api.knowledgeBases.deleteSyncSource(kbId, s.id).then(reload)}
                    >{t(labels, 'auto.t_3755f56f')}</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'collaborators' && (
        <section className="card knowledge-tab-card">
          <KnowledgeCollaboratorsPanel
            knowledgeBaseId={kbId}
            readOnly={!canShareKnowledge(kb?.accessRole)}
          />
        </section>
      )}

      {tab === 'query' && (
        <section className="card knowledge-tab-card">
          <FormField label={t(labels, 'auto.t_fe8506a4')}>
            <textarea value={query} onChange={(e) => setQuery(e.target.value)} rows={3} />
          </FormField>
          <button type="button" className="btn-primary" onClick={() => void runQuery()}>{t(labels, 'knowledge.search')}</button>
          <ul className="list-plain">
            {hits.map((h, i) => (
              <li key={i} className="card rxwf-mb-inline">
                <span className="muted">
                  {h.documentName} #{h.chunkIndex} · score {(h.score * 100).toFixed(1)}%
                </span>
                <pre className="rxwf-type-code">{h.text}</pre>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal
        open={reindexOpen}
        title={t(labels, 'knowledge.reindexKbWarning')}
        onClose={() => setReindexOpen(false)}
        footer={
          <footer className="rxwf-modal-footer">
            <div className="rxwf-modal-footer-right">
              <button
                type="button"
                className="btn-primary"
                disabled={paramsBusy}
                onClick={() => {
                  setReindexOpen(false);
                  void persistParams(true);
                }}
              >
                {t(labels, 'knowledge.saveAndReindexKb')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={paramsBusy}
                onClick={() => {
                  setReindexOpen(false);
                  void persistParams(false);
                }}
              >
                {t(labels, 'common.save', undefined, '仅保存')}
              </button>
            </div>
          </footer>
        }
      >
        <p>{t(labels, 'knowledge.reindexKbWarning')}</p>
      </Modal>
    </main>
  );
}
