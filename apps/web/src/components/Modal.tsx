import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDraggableModalPanel } from '../hooks/use-draggable-modal-panel.js';
import { ModalCloseButton } from './ModalCloseButton.js';
import { ModalMaximizeButton, modalMaximizedPanelStyle } from './ModalMaximizeButton.js';

export type ModalSize = 'sm' | 'lg';

export interface ModalProps {
  open: boolean;
  title: string;
  titleId?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  closeOnBackdrop?: boolean;
  closeDisabled?: boolean;
  panelClassName?: string;
  maximizable?: boolean;
}

export function Modal({
  open,
  title,
  titleId: titleIdProp,
  onClose,
  children,
  footer,
  size = 'sm',
  closeOnBackdrop = false,
  closeDisabled = false,
  panelClassName,
  maximizable = false,
}: ModalProps) {
  const generatedId = useId();
  const titleId = titleIdProp ?? generatedId.replace(/:/g, '');
  const dialogRef = useRef<HTMLDivElement>(null);
  const [maximized, setMaximized] = useState(false);
  const { panelStyle, headerProps } = useDraggableModalPanel(dialogRef, {
    open,
    disabled: closeDisabled || maximized,
  });

  useEffect(() => {
    if (!open) setMaximized(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !closeDisabled) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, closeDisabled]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const sizeClass = size === 'lg' ? 'rxwf-modal--lg' : 'rxwf-modal--sm';
  const panelClasses = [
    'rxwf-modal',
    'rxwf-modal--draggable',
    sizeClass,
    panelClassName,
    maximized ? 'rxwf-modal--maximized' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const resolvedPanelStyle = maximized
    ? { ...panelStyle, ...modalMaximizedPanelStyle() }
    : panelStyle;

  return createPortal(
    <div
      className="rxwf-modal-backdrop"
      role="presentation"
      onClick={closeOnBackdrop && !closeDisabled ? onClose : undefined}
    >
      <div
        ref={dialogRef}
        className={panelClasses}
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
          <h2 id={titleId} className="rxwf-modal-title">
            {title}
          </h2>
          {maximizable ? (
            <div className="rxwf-modal-header-actions">
              <ModalMaximizeButton
                maximized={maximized}
                onToggle={() => setMaximized((value) => !value)}
              />
              <ModalCloseButton onClick={onClose} disabled={closeDisabled} />
            </div>
          ) : (
            <ModalCloseButton onClick={onClose} disabled={closeDisabled} />
          )}
        </header>
        <div className="rxwf-modal-body">{children}</div>
        {footer}
      </div>
    </div>,
    document.body,
  );
}
