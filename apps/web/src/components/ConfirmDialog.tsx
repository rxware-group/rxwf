import { t, useLabels } from '../i18n/labels.js';
import { useEffect, useState } from 'react';
import { Modal } from './Modal.js';
import { ModalFooter } from './ModalFooter.js';
import { FormField } from './FormField.js';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  requireTextMatch?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  requireTextMatch,
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const labels = useLabels();
  const resolvedConfirm = confirmLabel ?? t(labels, 'common.confirm');
  const resolvedCancel = cancelLabel ?? t(labels, 'common.cancel');
  const [matchText, setMatchText] = useState('');

  useEffect(() => {
    if (!open) setMatchText('');
  }, [open]);

  const canConfirm =
    !requireTextMatch || matchText.trim() === requireTextMatch.trim();

  return (
    <Modal
      open={open}
      title={title}
      titleId="confirm-title"
      onClose={onCancel}
      closeOnBackdrop
      footer={
        <ModalFooter
          actions={[
            {
              key: 'confirm',
              label: resolvedConfirm,
              variant: danger ? 'danger' : 'primary',
              disabled: !canConfirm,
              onClick: onConfirm,
            },
            {
              key: 'cancel',
              label: resolvedCancel,
              variant: danger ? 'primary' : 'secondary',
              onClick: onCancel,
            },
          ]}
        />
      }
    >
      <p>{message}</p>
      {requireTextMatch && (
        <FormField
          label={t(labels, 'common.confirmTypeToConfirm', { text: requireTextMatch })}
        >
          <input
            value={matchText}
            onChange={(e) => setMatchText(e.target.value)}
            autoComplete="off"
          />
        </FormField>
      )}
    </Modal>
  );
}
