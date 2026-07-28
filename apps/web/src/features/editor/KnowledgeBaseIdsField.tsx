import { useEffect, useMemo, useState } from 'react';
import { api, type KnowledgeBaseSummary } from '../../api/client.js';
import { FormField } from '../../components/FormField.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { Select } from '../../components/Select.js';
import { t, useLabels } from '../../i18n/labels.js';
import { normalizeKnowledgeBaseIds } from './knowledge-base-ids-utils.js';

export function KnowledgeBaseIdsField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (ids: string[]) => void;
}) {
  const labels = useLabels();
  const selectedIds = normalizeKnowledgeBaseIds(value);
  const [items, setItems] = useState<KnowledgeBaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    api.knowledgeBases
      .list()
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch((e) => {
        if (!cancelled) {
          setItems([]);
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const nameById = useMemo(() => new Map(items.map((kb) => [kb.id, kb.name])), [items]);

  const availableOptions = useMemo(
    () =>
      items
        .filter((kb) => !selectedIds.includes(kb.id))
        .map((kb) => ({ value: kb.id, label: kb.name })),
    [items, selectedIds],
  );

  const addId = (id: string) => {
    if (!id || selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
  };

  const removeId = (id: string) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  const resolveChipLabel = (id: string) => nameById.get(id) ?? t(labels, 'editor.knowledgeBaseIds.unknown', { id });

  return (
    <div className="knowledge-base-ids-field">
      {loadError && <p className="hint">{loadError}</p>}
      <FormField label={t(labels, 'editor.knowledgeBaseIds.label')}>
        <LoadingHost loading={loading} label={t(labels, 'common.loading')}>
          {selectedIds.length > 0 && (
            <div className="mcp-tool-chips knowledge-base-ids-chips">
              {selectedIds.map((id) => (
                <span key={id} className="mcp-tool-chip knowledge-base-ids-chip">
                  {resolveChipLabel(id)}
                  <button
                    type="button"
                    className="mcp-tool-chip-remove"
                    aria-label={t(labels, 'editor.knowledgeBaseIds.remove', {
                      name: resolveChipLabel(id),
                    })}
                    onClick={() => removeId(id)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {availableOptions.length > 0 ? (
            <Select
              value=""
              disabled={loading}
              onChange={addId}
              options={[
                { value: '', label: t(labels, 'editor.knowledgeBaseIds.placeholder') },
                ...availableOptions,
              ]}
            />
          ) : (
            !loading && (
              <p className="hint knowledge-base-ids-empty">
                {items.length === 0
                  ? t(labels, 'editor.knowledgeBaseIds.noBases')
                  : t(labels, 'editor.knowledgeBaseIds.allSelected')}
              </p>
            )
          )}
        </LoadingHost>
      </FormField>
    </div>
  );
}
