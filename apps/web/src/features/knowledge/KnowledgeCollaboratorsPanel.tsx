import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type WorkflowCollaborator,
  type WorkflowCollaboratorRole,
} from '../../api/client.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { Modal } from '../../components/Modal.js';
import { ModalFooter } from '../../components/ModalFooter.js';
import { Select } from '../../components/Select.js';
import { t, useLabels } from '../../i18n/labels.js';

const ROLE_OPTIONS: Array<{ value: WorkflowCollaboratorRole; label: string }> = [
  { value: 'owner', label: 'Owner' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

function roleLabel(role: WorkflowCollaboratorRole): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

export function KnowledgeCollaboratorsPanel({
  knowledgeBaseId,
  readOnly = false,
}: {
  knowledgeBaseId: string;
  readOnly?: boolean;
}) {
  const labels = useLabels();
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<WorkflowCollaborator[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ id: string; email: string }>>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<WorkflowCollaboratorRole>('editor');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.knowledgeBases.listCollaborators(knowledgeBaseId);
      setOwnerUserId(data.ownerUserId);
      setOwnerEmail(data.ownerEmail);
      setCollaborators(data.collaborators);
    } catch (e) {
      setError(e instanceof Error ? e.message : t(labels, 'auto.t_7a62c815'));
    } finally {
      setLoading(false);
    }
  }, [knowledgeBaseId, labels]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const tableCollaborators = useMemo(
    () =>
      collaborators.filter(
        (collaborator) => !ownerUserId || collaborator.userId !== ownerUserId,
      ),
    [collaborators, ownerUserId],
  );

  const existingUserIds = useMemo(() => {
    const ids = new Set(collaborators.map((collaborator) => collaborator.userId));
    if (ownerUserId) ids.add(ownerUserId);
    return ids;
  }, [collaborators, ownerUserId]);

  const openAddModal = async () => {
    setError(null);
    setSelectedUserId('');
    setSelectedRole('editor');
    try {
      const users = await api.knowledgeBases.listCollaboratorCandidates(knowledgeBaseId);
      setCandidates(users.filter((user) => !existingUserIds.has(user.id)));
      setShowAddModal(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t(labels, 'auto.t_436da961'));
    }
  };

  const saveCollaborators = async (nextCollaborators: WorkflowCollaborator[]) => {
    setSaving(true);
    setError(null);
    try {
      const payload = nextCollaborators
        .filter((collaborator) => !ownerUserId || collaborator.userId !== ownerUserId)
        .map((collaborator) => ({
          userId: collaborator.userId,
          role: collaborator.role,
        }));
      const data = await api.knowledgeBases.updateCollaborators(knowledgeBaseId, payload);
      setOwnerUserId(data.ownerUserId);
      setOwnerEmail(data.ownerEmail);
      setCollaborators(data.collaborators);
    } catch (e) {
      setError(e instanceof Error ? e.message : t(labels, 'auto.t_7d2de569'));
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const addCollaborator = async () => {
    if (!selectedUserId) {
      setError(t(labels, 'auto.t_e5e7be9d'));
      return;
    }
    const candidate = candidates.find((user) => user.id === selectedUserId);
    if (!candidate) return;

    const nextCollaborators = [
      ...tableCollaborators,
      {
        userId: candidate.id,
        email: candidate.email,
        role: selectedRole,
        createdAt: new Date().toISOString(),
      },
    ];

    try {
      await saveCollaborators(nextCollaborators);
      setShowAddModal(false);
    } catch {
      /* error state already set */
    }
  };

  const updateRole = async (userId: string, role: WorkflowCollaboratorRole) => {
    const nextCollaborators = tableCollaborators.map((collaborator) =>
      collaborator.userId === userId ? { ...collaborator, role } : collaborator,
    );
    await saveCollaborators(nextCollaborators);
  };

  const removeCollaborator = async (userId: string) => {
    const nextCollaborators = tableCollaborators.filter(
      (collaborator) => collaborator.userId !== userId,
    );
    await saveCollaborators(nextCollaborators);
  };

  return (
    <section className="workflow-collaborators-panel">
      <div className="workflow-collaborators-toolbar">
        <p className="hint">
          {t(labels, 'knowledge.collaboratorsLead', undefined, t(labels, 'editor.collaboratorsLead'))}{' '}
          <Link to="/settings/roles">{t(labels, 'editor.viewRoles')}</Link>
        </p>
        {!readOnly && (
          <button type="button" className="btn-secondary" onClick={() => void openAddModal()}>
            {t(labels, 'editor.addCollaborator')}
          </button>
        )}
      </div>

      <LoadingHost loading={loading} label={t(labels, 'editor.loadingCollaborators')}>
        {error && <p className="error">{error}</p>}

        <table className="data-table">
          <thead>
            <tr>
              <th>{t(labels, 'common.user')}</th>
              <th>{t(labels, 'common.role')}</th>
              {!readOnly && <th>{t(labels, 'auto.t_f3ea6d34')}</th>}
            </tr>
          </thead>
          <tbody>
            {ownerUserId && (
              <tr>
                <td>{ownerEmail ?? ownerUserId}</td>
                <td>
                  <span className="role-tag">Owner</span>
                </td>
                {!readOnly && <td>—</td>}
              </tr>
            )}
            {tableCollaborators.map((collaborator) => (
              <tr key={collaborator.userId}>
                <td>{collaborator.email}</td>
                <td>
                  {readOnly ? (
                    roleLabel(collaborator.role)
                  ) : (
                    <Select
                      value={collaborator.role}
                      disabled={saving}
                      onChange={(role) =>
                        void updateRole(collaborator.userId, role as WorkflowCollaboratorRole)
                      }
                      options={ROLE_OPTIONS.filter((option) => option.value !== 'owner').map(
                        (option) => ({
                          value: option.value,
                          label: option.label,
                        }),
                      )}
                    />
                  )}
                </td>
                {!readOnly && (
                  <td>
                    <button
                      type="button"
                      className="btn-link danger"
                      disabled={saving}
                      onClick={() => void removeCollaborator(collaborator.userId)}
                    >
                      {t(labels, 'common.remove')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!ownerUserId && tableCollaborators.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 2 : 3} className="hint">
                  {t(labels, 'editor.noCollaborators')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </LoadingHost>

      <Modal
        open={showAddModal}
        title={t(labels, 'auto.t_b7058a2a')}
        onClose={() => !saving && setShowAddModal(false)}
        closeDisabled={saving}
        footer={
          <ModalFooter
            actions={[
              {
                key: 'save',
                label: t(labels, 'common.save'),
                variant: 'primary',
                disabled: saving || !selectedUserId,
                onClick: () => void addCollaborator(),
              },
              {
                key: 'cancel',
                label: t(labels, 'common.cancel'),
                variant: 'secondary',
                disabled: saving,
                onClick: () => setShowAddModal(false),
              },
            ]}
          />
        }
      >
        <LoadingHost loading={saving} label={t(labels, 'common.saving')}>
          <label className="form-field">
            <span className="form-label">{t(labels, 'common.user')}</span>
            <Select
              value={selectedUserId}
              disabled={saving}
              onChange={setSelectedUserId}
              options={[
                { value: '', label: t(labels, 'auto.t_e5e7be9d') },
                ...candidates.map((user) => ({
                  value: user.id,
                  label: user.email,
                })),
              ]}
            />
          </label>

          <fieldset className="form-field collaborator-role-fieldset">
            <legend className="form-label">{t(labels, 'common.role')}</legend>
            <div className="collaborator-role-options">
              {ROLE_OPTIONS.filter((option) => option.value !== 'owner').map((option) => (
                <label key={option.value} className="collaborator-role-option">
                  <input
                    type="radio"
                    name="kb-collaborator-role"
                    value={option.value}
                    checked={selectedRole === option.value}
                    disabled={saving}
                    onChange={() => setSelectedRole(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        </LoadingHost>
      </Modal>
    </section>
  );
}
