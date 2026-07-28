import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  api,
  AwfClientError,
  type AuthUser,
  type KnowledgeBaseSummary,
  type WorkflowAccessRole,
} from '../../api/client.js';
import { EmptyState } from '../../components/EmptyState.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { MoreMenu } from '../../components/MoreMenu.js';
import {
  DEFAULT_PAGE_SIZE,
  Pagination,
  type PageSize,
} from '../../components/Pagination.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { t, useLabels } from '../../i18n/labels.js';
import { KnowledgeInfoDialog } from './KnowledgeInfoDialog.js';

type AdminScope = 'mine' | 'all';
type MemberScope = 'all' | 'mine' | 'shared';
type InfoDialogMode = 'create' | 'edit' | null;

function canEditKnowledge(accessRole?: WorkflowAccessRole | null): boolean {
  return (
    accessRole === 'admin' ||
    accessRole === 'owner' ||
    accessRole === 'editor' ||
    accessRole == null
  );
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function knowledgeAuthorName(kb: KnowledgeBaseSummary): string {
  const nickname = kb.ownerNickname?.trim();
  if (nickname) return nickname;
  if (kb.ownerEmail) return kb.ownerEmail;
  return '—';
}

function knowledgeMetaLine(labels: Record<string, string>, kb: KnowledgeBaseSummary): string {
  const authorLabel = t(labels, 'workflows.meta.author', undefined, '作者');
  const createdLabel = t(labels, 'workflows.meta.createdAt', undefined, '创建时间');
  const updatedLabel = t(labels, 'workflows.meta.updatedAt', undefined, '最后修改时间');
  return `${authorLabel} ${knowledgeAuthorName(kb)} · ${createdLabel} ${formatDateTime(kb.createdAt)} · ${updatedLabel} ${formatDateTime(kb.updatedAt)}`;
}

function knowledgeConfigLine(labels: Record<string, string>, kb: KnowledgeBaseSummary): string {
  return `Embedding: ${kb.embeddingModel} · Top-${kb.topK} · ${t(labels, 'knowledge.thresholdLabel')} ${kb.similarityThreshold}`;
}

export function KnowledgeListPage() {
  const labels = useLabels();
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<KnowledgeBaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminScope, setAdminScope] = useState<AdminScope>('all');
  const [memberScope, setMemberScope] = useState<MemberScope>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [infoDialogMode, setInfoDialogMode] = useState<InfoDialogMode>(null);
  const [editingKb, setEditingKb] = useState<KnowledgeBaseSummary | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    api.auth
      .status()
      .then((status) => setUser(status.user))
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const scope = isAdmin
      ? adminScope
      : memberScope === 'all'
        ? undefined
        : memberScope;
    try {
      const list = await api.knowledgeBases.list(scope);
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, adminScope, memberScope]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [adminScope, memberScope]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [items.length, page, pageSize]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const openCreateDialog = () => {
    setEditingKb(null);
    setDialogError(null);
    setInfoDialogMode('create');
  };

  const openEditDialog = (kb: KnowledgeBaseSummary) => {
    setEditingKb(kb);
    setDialogError(null);
    setInfoDialogMode('edit');
  };

  const resetInfoDialog = () => {
    setInfoDialogMode(null);
    setEditingKb(null);
    setDialogError(null);
  };

  const closeInfoDialog = () => {
    if (dialogBusy) return;
    resetInfoDialog();
  };

  const handleInfoSubmit = async (data: { name: string; description: string }) => {
    setDialogBusy(true);
    setDialogError(null);
    try {
      if (infoDialogMode === 'create') {
        const created = await api.knowledgeBases.create({
          name: data.name,
          description: data.description,
        });
        navigate(`/knowledge/${created.id}`);
        return;
      }
      if (infoDialogMode === 'edit' && editingKb) {
        await api.knowledgeBases.updateMeta(editingKb.id, data);
        resetInfoDialog();
        load();
      }
    } catch (e) {
      setDialogError(e instanceof AwfClientError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setDialogBusy(false);
    }
  };

  const remove = async (kb: KnowledgeBaseSummary) => {
    const ok = await confirm({
      title: t(labels, 'common.delete'),
      message: t(labels, 'knowledge.deleteConfirm', { name: kb.name }),
      requireTextMatch: kb.name,
      danger: true,
      confirmLabel: t(labels, 'common.delete'),
    });
    if (!ok) return;
    try {
      await api.knowledgeBases.remove(kb.id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleMoreAction = (kb: KnowledgeBaseSummary, key: string) => {
    if (key === 'edit') openEditDialog(kb);
    if (key === 'delete') void remove(kb);
  };

  return (
    <main className="main page workflow-list-page">
      {dialog}
      <KnowledgeInfoDialog
        open={infoDialogMode !== null}
        mode={infoDialogMode === 'edit' ? 'edit' : 'create'}
        initialName={editingKb?.name ?? ''}
        initialDescription={editingKb?.description ?? ''}
        busy={dialogBusy}
        error={dialogError}
        onClose={closeInfoDialog}
        onSubmit={(data) => void handleInfoSubmit(data)}
      />

      <header className="page-header">
        <h1 className="rxwf-type-page-title">{t(labels, 'auto.t_1dda51f9')}</h1>
        <p className="rxwf-type-page-lead">{t(labels, 'knowledge.list.lead')}</p>
      </header>

      <div className="workflow-list-toolbar">
        {user ? (
          <div className="segmented">
            {isAdmin ? (
              <>
                <button
                  type="button"
                  className={adminScope === 'mine' ? 'is-active' : ''}
                  onClick={() => setAdminScope('mine')}
                >
                  {t(labels, 'knowledge.mine', undefined, t(labels, 'workflows.mine'))}
                </button>
                <button
                  type="button"
                  className={adminScope === 'all' ? 'is-active' : ''}
                  onClick={() => setAdminScope('all')}
                >
                  {t(labels, 'knowledge.all', undefined, t(labels, 'workflows.all'))}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={memberScope === 'all' ? 'is-active' : ''}
                  onClick={() => setMemberScope('all')}
                >
                  {t(labels, 'common.all')}
                </button>
                <button
                  type="button"
                  className={memberScope === 'mine' ? 'is-active' : ''}
                  onClick={() => setMemberScope('mine')}
                >
                  {t(labels, 'knowledge.createdByMe', undefined, t(labels, 'workflows.createdByMe'))}
                </button>
                <button
                  type="button"
                  className={memberScope === 'shared' ? 'is-active' : ''}
                  onClick={() => setMemberScope('shared')}
                >
                  {t(labels, 'knowledge.sharedWithMe', undefined, t(labels, 'workflows.sharedWithMe'))}
                </button>
              </>
            )}
          </div>
        ) : (
          <span />
        )}
        <div className="row workflow-list-actions">
          <button type="button" className="btn-primary" onClick={openCreateDialog}>
            {t(labels, 'knowledge.list.create')}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <LoadingHost loading minHeight="12rem" label={t(labels, 'common.loading')} />
      ) : items.length === 0 && !error ? (
        <EmptyState
          icon="search"
          title={t(labels, 'auto.t_1674dc8d')}
          description={t(labels, 'auto.TXT_Markdown_HTML_PDF_736ba92e')}
          actions={
            <button type="button" className="btn-link" onClick={openCreateDialog}>
              {t(labels, 'knowledge.list.create')}
            </button>
          }
        />
      ) : items.length > 0 ? (
        <section className="workflow-list-section">
          <ul className="workflow-list">
            {paginatedItems.map((kb) => {
              const editable = canEditKnowledge(kb.accessRole);
              return (
                <li key={kb.id} className="workflow-list-item">
                  <div className="workflow-list-item-main">
                    <div className="workflow-list-item-head">
                      {editable ? (
                        <Link to={`/knowledge/${kb.id}`} className="workflow-list-item-title">
                          {kb.name}
                        </Link>
                      ) : (
                        <span className="workflow-list-item-title">{kb.name}</span>
                      )}
                    </div>
                    {kb.description ? (
                      <p className="hint workflow-list-item-desc">{kb.description}</p>
                    ) : null}
                    <p className="hint workflow-list-item-meta">{knowledgeMetaLine(labels, kb)}</p>
                    <p className="hint">{knowledgeConfigLine(labels, kb)}</p>
                  </div>
                  <div className="workflow-list-item-actions">
                    {editable ? (
                      <MoreMenu
                        ariaLabel={t(labels, 'auto.t_b196954f')}
                        items={[
                          { key: 'edit', label: t(labels, 'knowledge.editInfo', undefined, t(labels, 'workflows.editInfo')) },
                          { key: 'delete', label: t(labels, 'common.delete'), danger: true },
                        ]}
                        onAction={(key) => handleMoreAction(kb, key)}
                      />
                    ) : (
                      <Link to={`/knowledge/${kb.id}`} className="btn-link">
                        {t(labels, 'common.view')}
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={items.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </section>
      ) : null}
    </main>
  );
}
