import type { CSSProperties } from 'react';
import { t, useLabels } from '../i18n/labels.js';
import { Tooltip } from './Tooltip.js';

export function ModalMaximizeButton({
  maximized,
  onToggle,
}: {
  maximized: boolean;
  onToggle: () => void;
}) {
  const labels = useLabels();
  const label = maximized
    ? t(labels, 'editor.nodeEditor.restore')
    : t(labels, 'editor.nodeEditor.maximize');

  return (
    <Tooltip label={label} side="bottom">
      <button
        type="button"
        className="rxwf-modal-close rxwf-modal-maximize-btn"
        aria-label={label}
        aria-pressed={maximized}
        onClick={onToggle}
      >
        <svg
          className="rxwf-modal-maximize-icon"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          aria-hidden="true"
        >
          {maximized ? (
            <>
              <path
                d="M10 6.5H17.5A1.75 1.75 0 0 1 19.25 8.25V15.25"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="4.75"
                y="11.25"
                width="9.5"
                height="9.5"
                rx="1.75"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              />
            </>
          ) : (
            <rect
              x="5.25"
              y="5.25"
              width="13.5"
              height="13.5"
              rx="2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            />
          )}
        </svg>
      </button>
    </Tooltip>
  );
}

export const MODAL_MAXIMIZED_VIEWPORT_MARGIN = 8;

export function modalMaximizedPanelStyle(): CSSProperties {
  const margin = MODAL_MAXIMIZED_VIEWPORT_MARGIN;
  return {
    position: 'fixed',
    left: margin,
    top: margin,
    margin: 0,
    transform: 'none',
    width: `calc(100vw - ${margin * 2}px)`,
    height: `calc(100vh - ${margin * 2}px)`,
    maxWidth: 'none',
    maxHeight: 'none',
  };
}
