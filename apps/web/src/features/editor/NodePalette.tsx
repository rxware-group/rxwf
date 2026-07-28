import { t, useLabels, type LabelMap } from '../../i18n/labels.js';
import { useMemo, useState } from 'react';
import { EmptyState } from '../../components/EmptyState.js';
import { getNodeMeta, NODE_TYPE_META } from './node-type-meta.js';
import { isCrewPaletteNodeType } from './crew-editor-settings.js';
import { NodeIconGlyph } from './NodeIconGlyph.js';

const ALL_PALETTE_TYPES = Object.keys(NODE_TYPE_META);

function categoryLabel(labels: LabelMap, cat: string): string {
  const map: Record<string, string> = {
    trigger: t(labels, 'auto.t_2d189a3f'),
    action: t(labels, 'auto.t_f3ea6d34'),
    logic: t(labels, 'auto.t_f26c2b4e'),
    data: t(labels, 'auto.t_54b8a90b'),
    note: t(labels, 'auto.t_4d8de83d'),
    agent: t(labels, 'auto.Agent_AI_1b7baa11'),
  };
  return map[cat] ?? cat;
}

function matchesQuery(type: string, q: string): boolean {
  if (!q) return true;
  const meta = getNodeMeta(type);
  return (
    type.toLowerCase().includes(q) ||
    meta.label.toLowerCase().includes(q) ||
    (meta.description?.toLowerCase().includes(q) ?? false)
  );
}

function renderGroup(
  labels: LabelMap,
  types: string[],
  onAdd: (type: string) => void,
) {
  const byCategory = types.reduce<Record<string, string[]>>((acc, type) => {
    const cat = getNodeMeta(type).category;
    (acc[cat] ??= []).push(type);
    return acc;
  }, {});

  return Object.entries(byCategory).map(([cat, catTypes]) => (
    <div key={cat} className="palette-group">
      <h4 className="palette-group-title">{categoryLabel(labels, cat)}</h4>
      <ul className="palette-list">
        {catTypes.map((type) => {
          const meta = getNodeMeta(type);
          return (
            <li key={type}>
              <button
                type="button"
                className="palette-node-btn"
                style={{ '--node-accent': meta.accent } as React.CSSProperties}
                onClick={() => onAdd(type)}
              >
                <span className="palette-node-icon">
                  <NodeIconGlyph type={type} meta={meta} className="rxwf-node-glyph" />
                </span>
                <span>{meta.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  ));
}

export function NodePalette({
  onAdd,
  enableCrew = true,
}: {
  onAdd: (type: string) => void;
  enableCrew?: boolean;
}) {
  const labels = useLabels();

  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const visibleTypes = useMemo(
    () =>
      ALL_PALETTE_TYPES.filter(
        (type) => isCrewPaletteNodeType(type, enableCrew) && matchesQuery(type, q),
      ),
    [q, enableCrew],
  );

  return (
    <div className="panel node-palette">
      <label className="palette-search">
        <span className="sr-only">{t(labels, 'editor.searchNodes')}</span>
        <input
          type="search"
          placeholder={t(labels, 'auto.t_f589b00d')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="node-palette-scroll">
        {visibleTypes.length === 0 ? (
          <EmptyState
            icon="search"
            title={t(labels, 'auto.t_a5e67b7d')}
            description={t(labels, 'auto.t_9e900af2')}
            actions={
              <button type="button" className="btn-secondary" onClick={() => setQuery('')}>
                {t(labels, 'common.clearFilter')}
              </button>
            }
          />
        ) : (
          renderGroup(labels, visibleTypes, onAdd)
        )}
      </div>
    </div>
  );
}
