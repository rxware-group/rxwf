import { t, useLabels } from '../i18n/labels.js';

export function ModalCloseButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const labels = useLabels();
  const resolvedLabel = label ?? t(labels, 'common.close');
  return (
    <button
      type="button"
      className="rxwf-modal-close rxwf-modal-close-btn"
      aria-label={resolvedLabel}
      disabled={disabled}
      onClick={onClick}
    >
      <svg className="rxwf-modal-close-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path
          d="M5.75 5.75L18.25 18.25M18.25 5.75L5.75 18.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
