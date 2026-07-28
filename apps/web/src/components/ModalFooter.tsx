import { t, useLabels } from '../i18n/labels.js';
export type ModalFooterActionVariant = 'primary' | 'secondary' | 'danger';

export interface ModalFooterAction {
  key: string;
  label: string;
  variant: ModalFooterActionVariant;
  onClick: () => void;
  disabled?: boolean;
}

export interface ModalFooterProps {
  reset?: {
    label?: string;
    onClick: () => void;
    disabled?: boolean;
  };
  actions: ModalFooterAction[];
}

function variantClass(variant: ModalFooterActionVariant): string {
  switch (variant) {
    case 'primary':
      return 'btn-primary';
    case 'danger':
      return 'btn-danger';
    default:
      return 'btn-secondary';
  }
}

export function ModalFooter({
 reset, actions }: ModalFooterProps) {
  const labels = useLabels();

  return (
    <footer className="rxwf-modal-footer">
      <div className="rxwf-modal-footer-left">
        {reset ? (
          <button
            type="button"
            className="btn-secondary rxwf-modal-footer-btn"
            disabled={reset.disabled}
            onClick={reset.onClick}
          >
            {reset.label ?? t(labels, 'auto.t_3d813453')}
          </button>
        ) : null}
      </div>
      <div className="rxwf-modal-footer-right">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className={`${variantClass(action.variant)} rxwf-modal-footer-btn`}
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
      </div>
    </footer>
  );
}
