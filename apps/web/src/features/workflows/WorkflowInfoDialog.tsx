import { useEffect, useState } from 'react';
import { FormField } from '../../components/FormField.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { Modal } from '../../components/Modal.js';
import { t, useLabels } from '../../i18n/labels.js';

export type WorkflowInfoDialogMode = 'create' | 'edit';

export interface WorkflowInfoDialogProps {
  open: boolean;
  mode: WorkflowInfoDialogMode;
  initialName?: string;
  initialDescription?: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string }) => void;
}

export function WorkflowInfoDialog({
  open,
  mode,
  initialName = '',
  initialDescription = '',
  busy = false,
  error = null,
  onClose,
  onSubmit,
}: WorkflowInfoDialogProps) {
  const labels = useLabels();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setDescription(initialDescription);
  }, [open, initialName, initialDescription]);

  const title =
    mode === 'create'
      ? t(labels, 'workflows.createTitle', undefined, '新建工作流')
      : t(labels, 'workflows.editInfo', undefined, '编辑信息');

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, description: description.trim() });
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      closeDisabled={busy}
      footer={
        <footer className="rxwf-modal-footer workflow-info-dialog-footer">
          <div className="rxwf-modal-footer-right workflow-info-dialog-footer-actions">
            <button
              type="button"
              className="btn-primary rxwf-modal-footer-btn"
              disabled={busy || !name.trim()}
              onClick={handleSubmit}
            >
              {t(labels, 'common.ok', undefined, '确定')}
            </button>
            <button
              type="button"
              className="btn-secondary rxwf-modal-footer-btn"
              disabled={busy}
              onClick={onClose}
            >
              {t(labels, 'common.cancel', undefined, '取消')}
            </button>
          </div>
        </footer>
      }
    >
      <LoadingHost loading={busy} label={t(labels, 'common.saving')}>
      {error && <p className="error">{error}</p>}
      <FormField
        label={t(labels, 'workflows.field.name', undefined, '名称')}
        htmlFor="workflow-info-name"
      >
        <input
          id="workflow-info-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          autoFocus
        />
      </FormField>
      <FormField
        label={t(labels, 'workflows.field.description', undefined, '描述')}
        htmlFor="workflow-info-description"
      >
        <textarea
          id="workflow-info-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={busy}
          rows={3}
        />
      </FormField>
      </LoadingHost>
    </Modal>
  );
}
