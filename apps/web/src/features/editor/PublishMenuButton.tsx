import { useEffect, useRef, useState } from 'react';
import { t, useLabels } from '../../i18n/labels.js';

export function PublishMenuButton({
  publishStatus,
  hasUnpublishedChanges,
  canPublish,
  onPublish,
  onUnpublish,
}: {
  publishStatus: 'draft' | 'published';
  hasUnpublishedChanges: boolean;
  canPublish: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  const labels = useLabels();
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

  if (!canPublish) return null;

  if (publishStatus === 'draft') {
    return (
      <button type="button" className="btn-toolbar btn-primary" onClick={onPublish}>
        {t(labels, 'editor.publish')}
      </button>
    );
  }

  const mainLabel = hasUnpublishedChanges
    ? t(labels, 'editor.publishUpdate')
    : t(labels, 'editor.publish');

  return (
    <div ref={wrapRef} className="publish-menu-button">
      <div className="publish-menu-button-group">
        <button
          type="button"
          className="btn-toolbar btn-primary publish-menu-main"
          disabled={!hasUnpublishedChanges}
          onClick={onPublish}
        >
          {mainLabel}
        </button>
        <button
          type="button"
          className="btn-toolbar btn-primary publish-menu-chevron"
          aria-label={t(labels, 'editor.unpublish')}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M7 10l5 5 5-5H7z" />
          </svg>
        </button>
      </div>
      {open ? (
        <div className="publish-menu-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onUnpublish();
            }}
          >
            {t(labels, 'editor.unpublish')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
