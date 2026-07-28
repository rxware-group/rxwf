import { useRef, useState } from 'react';
import { Select } from '../../../components/Select.js';
import { t, useLabels } from '../../../i18n/labels.js';
import type { DataInspectorSource } from './types.js';

export function DataInspectorSearchBar({
  searchQuery,
  onSearchQueryChange,
  sources,
  activeSourceId,
  onActiveSourceChange,
  showSourceSelect = false,
  variant = 'pane-head',
}: {
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  sources?: DataInspectorSource[];
  activeSourceId?: string;
  onActiveSourceChange?: (id: string) => void;
  showSourceSelect?: boolean;
  variant?: 'default' | 'pane-head';
}) {
  const labels = useLabels();
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const showSearchInput = searchExpanded || searchQuery.length > 0;

  const active =
    sources?.find((s) => s.id === activeSourceId) ?? sources?.[0];
  const sourceSelectVisible =
    showSourceSelect && sources != null && sources.length > 0 && onActiveSourceChange != null;

  const openSearch = () => {
    setSearchExpanded(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const handleSearchChange = (next: string) => {
    onSearchQueryChange(next);
    if (!next.trim()) {
      setSearchExpanded(false);
    }
  };

  const handleSearchBlur = () => {
    if (!searchQuery.trim()) {
      setSearchExpanded(false);
    }
  };

  return (
    <div
      className={`data-inspector-toolbar${
        variant === 'pane-head' ? ' data-inspector-toolbar--pane-head' : ''
      }`}
    >
      <div className="data-inspector-search-wrap">
        {showSearchInput ? (
          <input
            ref={searchRef}
            type="search"
            className="data-inspector-search"
            placeholder={t(labels, 'editor.dataInspector.search')}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onBlur={handleSearchBlur}
            aria-label={t(labels, 'editor.dataInspector.search')}
          />
        ) : (
          <button
            type="button"
            className="data-inspector-search-toggle"
            onClick={openSearch}
            aria-label={t(labels, 'editor.dataInspector.search')}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <circle
                cx="11"
                cy="11"
                r="6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M16 16l5 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
      {sourceSelectVisible && (
        <Select
          className="data-inspector-source-select data-inspector-source-select--pane-head"
          value={active?.id ?? ''}
          onChange={onActiveSourceChange}
          panelFitContent
          aria-label={t(labels, 'editor.dataInspector.sourceSelect')}
          options={sources.map((source) => ({
            value: source.id,
            label: source.label,
          }))}
        />
      )}
    </div>
  );
}
