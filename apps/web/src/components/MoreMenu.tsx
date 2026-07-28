import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Tooltip } from './Tooltip.js';

export interface MoreMenuItem {
  key: string;
  label: ReactNode;
  danger?: boolean;
}

export interface MoreMenuProps {
  items: MoreMenuItem[];
  ariaLabel: string;
  onAction: (key: string) => void;
  variant?: 'node' | 'toolbar';
  tooltipLabel?: string;
}

export function MoreMenu({
  items,
  ariaLabel,
  onAction,
  variant = 'node',
  tooltipLabel,
}: MoreMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (items.length === 0) return null;

  const wrapClass =
    variant === 'toolbar' ? 'editor-toolbar-more-wrap' : 'workflow-node-more-wrap';
  const btnClass =
    variant === 'toolbar'
      ? `btn-toolbar btn-secondary editor-toolbar-more-btn${open ? ' is-active' : ''}`
      : `workflow-node-btn ${open ? 'is-active' : ''}`;

  const menuButton = (
    <button
      type="button"
      className={btnClass}
      aria-label={ariaLabel}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <circle cx="12" cy="5" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="19" r="2" />
      </svg>
    </button>
  );

  return (
    <div ref={wrapRef} className={wrapClass}>
      {tooltipLabel ? (
        <Tooltip label={tooltipLabel} side="bottom">
          {menuButton as ReactElement}
        </Tooltip>
      ) : (
        menuButton
      )}
      {open ? (
        <div className="workflow-node-menu" role="menu">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={item.danger ? 'danger' : undefined}
              onClick={() => {
                setOpen(false);
                onAction(item.key);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
