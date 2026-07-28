import { t, useLabels } from '../../i18n/labels.js';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { ModalCloseButton } from '../../components/ModalCloseButton.js';
import { ModalMaximizeButton, modalMaximizedPanelStyle } from '../../components/ModalMaximizeButton.js';
import { Tooltip } from '../../components/Tooltip.js';
import { useDraggableModalPanel } from '../../hooks/use-draggable-modal-panel.js';
import { buildSettingsHelpUrl } from './settings-help-registry.js';

export function SettingsModal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const labels = useLabels();
  const location = useLocation();
  const titleId = useId().replace(/:/g, '');
  const dialogRef = useRef<HTMLDivElement>(null);
  const [maximized, setMaximized] = useState(false);
  const { panelStyle, headerProps } = useDraggableModalPanel(dialogRef, {
    open: true,
    disabled: maximized,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const resolvedPanelStyle = maximized
    ? { ...panelStyle, ...modalMaximizedPanelStyle() }
    : panelStyle;

  return createPortal(
    <div
      className="rxwf-modal-backdrop settings-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={`rxwf-modal rxwf-modal--draggable rxwf-modal--90 settings-modal-panel${maximized ? ' rxwf-modal--maximized' : ''}`}
        style={resolvedPanelStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="rxwf-modal-header rxwf-modal-header--draggable"
          {...headerProps}
        >
          <h2 id={titleId} className="rxwf-modal-title">{t(labels, 'settings.title')}</h2>
          <div className="rxwf-modal-header-actions">
            <Tooltip label={t(labels, 'help.openSettings')} side="bottom">
              <button
                type="button"
                className="rxwf-modal-close rxwf-modal-help-btn"
                aria-label={t(labels, 'help.openSettings')}
                onClick={() => {
                  const url = buildSettingsHelpUrl(location.pathname);
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
              >
                <svg
                  className="rxwf-modal-help-icon"
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="7.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                  />
                  <path
                    d="M10 9.5a2 2 0 0 1 4 1.25c0 1.5-2 1.5-2 2.75"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="16.5" r="0.85" fill="currentColor" />
                </svg>
              </button>
            </Tooltip>
            <ModalMaximizeButton
              maximized={maximized}
              onToggle={() => setMaximized((value) => !value)}
            />
            <ModalCloseButton onClick={onClose} label={t(labels, 'auto.t_7346c035')} />
          </div>
        </header>
        <div className="rxwf-modal-body settings-modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
