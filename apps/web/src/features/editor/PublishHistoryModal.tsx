import { t, useLabels } from '../../i18n/labels.js';
import { Modal } from '../../components/Modal.js';
import { PublishHistoryPanel } from './PublishHistoryPanel.js';

export function PublishHistoryModal({
  open,
  onClose,
  workflowId,
  onDraftRestored,
  onPublishChanged,
}: {
  open: boolean;
  onClose: () => void;
  workflowId: string;
  onDraftRestored: () => void;
  onPublishChanged: () => void;
}) {
  const labels = useLabels();

  return (
    <Modal
      open={open}
      title={t(labels, 'editor.publishHistory')}
      onClose={onClose}
      closeOnBackdrop
      size="lg"
      panelClassName="publish-history-modal"
    >
      <PublishHistoryPanel
        workflowId={workflowId}
        onDraftRestored={onDraftRestored}
        onPublishChanged={onPublishChanged}
      />
    </Modal>
  );
}
