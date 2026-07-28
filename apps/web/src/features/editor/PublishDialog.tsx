import { t, useLabels } from '../../i18n/labels.js';
import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal.js';
import { ModalFooter } from '../../components/ModalFooter.js';
import { FormField } from '../../components/FormField.js';

export function PublishDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: (publishNote: string) => void;
}) {
  const labels = useLabels();
  const [publishNote, setPublishNote] = useState('');

  useEffect(() => {
    if (open) setPublishNote('');
  }, [open]);

  return (
    <Modal
      open={open}
      title={t(labels, 'auto.t_03bf0097')}
      onClose={onCancel}
      closeOnBackdrop
      footer={
        <ModalFooter
          actions={[
            {
              key: 'publish',
              label: t(labels, 'auto.t_94f172d0'),
              variant: 'primary',
              onClick: () => onConfirm(publishNote),
            },
            {
              key: 'cancel',
              label: t(labels, 'common.cancel'),
              variant: 'secondary',
              onClick: onCancel,
            },
          ]}
        />
      }
    >
      <p className="hint">{t(labels, 'editor.publishDraftHint')}</p>
      <FormField label={t(labels, 'editor.publishNote')}>
        <textarea
          rows={3}
          value={publishNote}
          onChange={(e) => setPublishNote(e.target.value)}
          placeholder={t(labels, 'editor.publishNotePlaceholder')}
        />
      </FormField>
    </Modal>
  );
}
