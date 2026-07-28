import { t, useLabels } from '../../i18n/labels.js';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import {

  api,

  AwfClientError,

  type AuthUser,

  type WorkflowAccessRole,

  type WorkflowSummary,

} from '../../api/client.js';

import { EmptyState, EmptyStateLink } from '../../components/EmptyState.js';

import { LoadingHost } from '../../components/LoadingHost.js';

import { MoreMenu } from '../../components/MoreMenu.js';

import {

  DEFAULT_PAGE_SIZE,

  Pagination,

  type PageSize,

} from '../../components/Pagination.js';

import { useConfirm } from '../../hooks/useConfirm.js';

import { emptyWorkflowDefinition } from './empty-workflow-definition.js';

import { WorkflowInfoDialog } from './WorkflowInfoDialog.js';



type AdminScope = 'mine' | 'all';

type MemberScope = 'all' | 'mine' | 'shared';

type InfoDialogMode = 'create' | 'edit' | null;



function canEditWorkflow(accessRole?: WorkflowAccessRole | null): boolean {

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



function workflowAuthorName(workflow: WorkflowSummary): string {

  const username = workflow.createdByNickname?.trim();

  if (username) return username;

  if (workflow.createdByEmail) return workflow.createdByEmail;

  return '—';

}



function workflowMetaLine(

  labels: Record<string, string>,

  workflow: WorkflowSummary,

): string {

  const authorLabel = t(labels, 'workflows.meta.author', undefined, '作者');

  const createdLabel = t(labels, 'workflows.meta.createdAt', undefined, '创建时间');

  const updatedLabel = t(labels, 'workflows.meta.updatedAt', undefined, '最后修改时间');

  return `${authorLabel} ${workflowAuthorName(workflow)} · ${createdLabel} ${formatDateTime(workflow.createdAt)} · ${updatedLabel} ${formatDateTime(workflow.updatedAt)}`;

}



function workflowErrorMessage(labels: Record<string, string>, err: unknown): string {

  if (err instanceof AwfClientError) {

    if (err.code === 'E1040') {

      return t(labels, 'errors.E1040', undefined, t(labels, 'workflows.nameDuplicate'));

    }

    return err.message;

  }

  return err instanceof Error ? err.message : String(err);

}



export function WorkflowListPage() {

  const labels = useLabels();

  const navigate = useNavigate();



  const [user, setUser] = useState<AuthUser | null>(null);

  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [adminScope, setAdminScope] = useState<AdminScope>('all');

  const [memberScope, setMemberScope] = useState<MemberScope>('all');

  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);

  const [infoDialogMode, setInfoDialogMode] = useState<InfoDialogMode>(null);

  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowSummary | null>(null);

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

      const list = await api.workflows.list(scope);

      setWorkflows(list);

    } catch (e) {

      setError(e instanceof Error ? e.message : String(e));

      setWorkflows([]);

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

    const totalPages = Math.max(1, Math.ceil(workflows.length / pageSize));

    if (page > totalPages) setPage(totalPages);

  }, [workflows.length, page, pageSize]);



  const paginatedWorkflows = useMemo(() => {

    const start = (page - 1) * pageSize;

    return workflows.slice(start, start + pageSize);

  }, [workflows, page, pageSize]);



  const openCreateDialog = () => {

    setEditingWorkflow(null);

    setDialogError(null);

    setInfoDialogMode('create');

  };



  const openEditDialog = (workflow: WorkflowSummary) => {

    setEditingWorkflow(workflow);

    setDialogError(null);

    setInfoDialogMode('edit');

  };



  const resetInfoDialog = () => {

    setInfoDialogMode(null);

    setEditingWorkflow(null);

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

        const created = await api.workflows.create(

          data.name,

          emptyWorkflowDefinition(data.name),

          data.description,

        );

        navigate(`/workflows/${created.id}`);

        return;

      }

      if (infoDialogMode === 'edit' && editingWorkflow) {

        await api.workflows.updateMeta(editingWorkflow.id, data);

        resetInfoDialog();

        load();

      }

    } catch (e) {

      setDialogError(workflowErrorMessage(labels, e));

    } finally {

      setDialogBusy(false);

    }

  };



  const remove = async (w: WorkflowSummary) => {

    const ok = await confirm({

      title: t(labels, 'auto.t_c5eaf438'),

      message: t(labels, 'confirm.deleteWorkflow', { name: w.name }),

      requireTextMatch: w.name,

      danger: true,

      confirmLabel: t(labels, 'common.delete'),

    });

    if (!ok) return;

    try {

      await api.workflows.remove(w.id);

      load();

    } catch (e) {

      setError(e instanceof Error ? e.message : t(labels, 'auto.t_72250c59'));

    }

  };



  const handleMoreAction = (workflow: WorkflowSummary, key: string) => {

    if (key === 'edit') openEditDialog(workflow);

    if (key === 'delete') void remove(workflow);

  };



  return (

    <main className="main page workflow-list-page">

      {dialog}

      <WorkflowInfoDialog

        open={infoDialogMode !== null}

        mode={infoDialogMode === 'edit' ? 'edit' : 'create'}

        initialName={editingWorkflow?.name ?? ''}

        initialDescription={editingWorkflow?.description ?? ''}

        busy={dialogBusy}

        error={dialogError}

        onClose={closeInfoDialog}

        onSubmit={(data) => void handleInfoSubmit(data)}

      />

      <header className="page-header">
        <h1 className="rxwf-type-page-title">{t(labels, 'auto.t_cc19798b')}</h1>
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

                >{t(labels, 'workflows.mine')}</button>

                <button

                  type="button"

                  className={adminScope === 'all' ? 'is-active' : ''}

                  onClick={() => setAdminScope('all')}

                >{t(labels, 'workflows.all')}</button>

              </>

            ) : (

              <>

                <button

                  type="button"

                  className={memberScope === 'all' ? 'is-active' : ''}

                  onClick={() => setMemberScope('all')}

                >{t(labels, 'common.all')}</button>

                <button

                  type="button"

                  className={memberScope === 'mine' ? 'is-active' : ''}

                  onClick={() => setMemberScope('mine')}

                >{t(labels, 'workflows.createdByMe')}</button>

                <button

                  type="button"

                  className={memberScope === 'shared' ? 'is-active' : ''}

                  onClick={() => setMemberScope('shared')}

                >{t(labels, 'workflows.sharedWithMe')}</button>

              </>

            )}

          </div>

        ) : (

          <span />

        )}

        <div className="row workflow-list-actions">

          <button type="button" className="btn-primary" onClick={openCreateDialog}>

            {t(labels, 'common.createNew')}

          </button>

        </div>

      </div>



      {error && <p className="error">{error}</p>}

      {loading ? (

        <LoadingHost loading minHeight="12rem" label={t(labels, 'common.loading')} />

      ) : workflows.length === 0 && !error ? (

        <EmptyState

          icon="workflow"

          title={t(labels, 'auto.t_a31e52fe')}

          description={t(labels, 'auto.t_80dbb219')}

          actions={

            <>

              <EmptyStateLink to="/templates" primary>{t(labels, 'workflows.createFromTemplate')}</EmptyStateLink>

              <button type="button" className="btn-link" onClick={openCreateDialog}>

                {t(labels, 'workflows.createBlank')}

              </button>

            </>

          }

        />

      ) : workflows.length > 0 ? (

        <section className="workflow-list-section">

          <ul className="workflow-list">

            {paginatedWorkflows.map((w) => {

              const editable = canEditWorkflow(w.accessRole);

              return (

                <li key={w.id} className="workflow-list-item">

                  <div className="workflow-list-item-main">

                    <div className="workflow-list-item-head">

                      {editable ? (

                        <Link to={`/workflows/${w.id}`} className="workflow-list-item-title">

                          {w.name}

                        </Link>

                      ) : (

                        <span className="workflow-list-item-title">{w.name}</span>

                      )}

                      <span className={`status-pill status-${w.status}`}>{w.status}</span>

                      <span className="hint">v{w.version}</span>

                    </div>

                    {w.description ? (

                      <p className="hint workflow-list-item-desc">{w.description}</p>

                    ) : null}

                    <p className="hint workflow-list-item-meta">
                      {workflowMetaLine(labels, w)}
                    </p>

                  </div>

                  <div className="workflow-list-item-actions">

                    {editable ? (

                      <MoreMenu

                        ariaLabel={t(labels, 'auto.t_b196954f')}

                        items={[

                          { key: 'edit', label: t(labels, 'workflows.editInfo') },

                          {

                            key: 'delete',

                            label: t(labels, 'common.delete'),

                            danger: true,

                          },

                        ]}

                        onAction={(key) => handleMoreAction(w, key)}

                      />

                    ) : (

                      <Link to={`/workflows/${w.id}`} className="btn-link">

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

            total={workflows.length}

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


