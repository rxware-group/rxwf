import { t, useLabels } from '../../i18n/labels.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { api, type PlatformEnvItem } from '../../api/client.js';
import { Tooltip } from '../../components/Tooltip.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { SettingsPageShell, SettingsSection } from '../settings/SettingsPageShell.js';
import type { SettingsOutletContext } from '../settings/settings-context.js';
import { PathBrowseModal } from './PathBrowseModal.js';

const MASK = '***';

function envLabel(labels: Record<string, string>, item: PlatformEnvItem): string {
  return t(labels, item.labelKey, undefined, item.key);
}

function buildEnvKeyTooltip(labels: Record<string, string>, item: PlatformEnvItem): string {
  const label = envLabel(labels, item);
  const description = t(labels, item.descriptionKey, undefined, '');
  const valueHint = t(labels, item.valueHintKey, undefined, '');
  const parts: string[] = [];
  if (label) parts.push(label);
  if (description) parts.push(description);
  if (valueHint) {
    parts.push(t(labels, 'env.tooltip.example', { value: valueHint }));
  }
  if (item.valueType === 'path' && item.pathHost) {
    parts.push(
      item.pathHost === 'runner'
        ? t(labels, 'env.pathHost.runner')
        : t(labels, 'env.pathHost.controlPlane'),
    );
  }
  if (item.sensitive) {
    parts.push(t(labels, 'env.tooltip.sensitive'));
  }
  if (item.requiresRestart) {
    parts.push(t(labels, 'env.requiresRestart'));
  }
  return parts.join('\n');
}

function EnvValueControl({
  item,
  draftValue,
  busy,
  isAdmin,
  showMaskPlaceholder,
  onDraftChange,
  onPersist,
  onBrowse,
}: {
  item: PlatformEnvItem;
  draftValue: string;
  busy: boolean;
  isAdmin: boolean;
  showMaskPlaceholder: boolean;
  onDraftChange: (value: string) => void;
  onPersist: (overrideValue?: string) => void;
  onBrowse: () => void;
}) {
  const labels = useLabels();
  const disabled = !isAdmin || busy;
  const valueType = item.valueType ?? 'string';

  if (valueType === 'bool') {
    const on = draftValue === 'true';
    return (
      <button
        type="button"
        className={`rxwf-toggle${on ? ' is-on' : ''}`}
        role="switch"
        aria-checked={on}
        disabled={disabled}
        aria-label={envLabel(labels, item)}
        onClick={() => {
          const next = on ? 'false' : 'true';
          onDraftChange(next);
          onPersist(next);
        }}
      >
        <span className="rxwf-toggle-track">
          <span className="rxwf-toggle-thumb" />
        </span>
      </button>
    );
  }

  if (valueType === 'int' || valueType === 'port' || valueType === 'double') {
    return (
      <input
        className="env-value-input mono"
        type="number"
        step={valueType === 'double' ? 'any' : 1}
        value={draftValue}
        disabled={disabled}
        onChange={(e) => onDraftChange(e.target.value)}
        onBlur={() => onPersist()}
      />
    );
  }

  if (valueType === 'path') {
    return (
      <div className="env-path-field">
        <input
          className="env-value-input mono"
          type="text"
          value={draftValue}
          disabled={disabled}
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={() => onPersist()}
        />
        {isAdmin && (
          <button
            type="button"
            className="btn-secondary env-path-browse-btn"
            disabled={busy}
            title={
              item.pathHost === 'runner'
                ? t(labels, 'env.pathHost.runner')
                : t(labels, 'env.pathHost.controlPlane')
            }
            onClick={onBrowse}
          >
            …
          </button>
        )}
        <span className="hint env-path-host-hint">
          {item.pathHost === 'runner'
            ? t(labels, 'env.pathHost.runnerShort')
            : t(labels, 'env.pathHost.controlPlaneShort')}
        </span>
      </div>
    );
  }

  const inputType =
    valueType === 'password' || item.sensitive ? 'password' : 'text';

  return (
    <input
      className="env-value-input mono"
      type={inputType}
      value={draftValue}
      placeholder={showMaskPlaceholder ? MASK : ''}
      disabled={disabled}
      onChange={(e) => onDraftChange(e.target.value)}
      onBlur={() => onPersist()}
    />
  );
}

export function EnvPage() {
  const labels = useLabels();
  const location = useLocation();
  const { user } = useOutletContext<SettingsOutletContext>();
  const isAdmin = user.role === 'admin';

  const [items, setItems] = useState<PlatformEnvItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const [browseItem, setBrowseItem] = useState<PlatformEnvItem | null>(null);

  const load = useCallback(async () => {
    const isRevisit = hasLoadedRef.current;
    if (!isRevisit) {
      setLoading(true);
    }
    setError(null);
    try {
      const list = await api.env.list();
      setItems(list);
      setDrafts(
        Object.fromEntries(
          list.map((item) => [item.key, item.value === MASK ? '' : item.value]),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t(labels, 'common.loadFailed'));
      if (!isRevisit) setItems([]);
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [labels]);

  useEffect(() => {
    void load();
  }, [location.pathname, load]);

  const persistRow = async (item: PlatformEnvItem, overrideValue?: string) => {
    if (!isAdmin) return;
    const key = item.key;
    const value = overrideValue ?? draftsRef.current[key] ?? '';
    if (item.sensitive && !value.trim() && item.valueType !== 'bool') {
      return;
    }
    setSavingKey(key);
    setError(null);
    try {
      const updated = await api.env.update([{ key, value }]);
      setItems(updated);
      setDrafts((prev) => {
        const next = { ...prev };
        const row = updated.find((r) => r.key === key);
        if (row) {
          next[key] = row.value === MASK ? '' : row.value;
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t(labels, 'auto.t_40525a73'));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <SettingsPageShell className="env-page">
      {!isAdmin && (
        <p className="hint env-page-hint">{t(labels, 'env.readOnlyHint')}</p>
      )}
      {error && <p className="error">{error}</p>}
      <SettingsSection className="env-vars-section">
        <LoadingHost
          loading={loading}
          className="env-vars-host"
          label={t(labels, 'common.loading')}
        >
          {!loading ? (
            <table className="data-table env-vars-table">
              <thead>
                <tr>
                  <th>{t(labels, 'env.col.key')}</th>
                  <th>{t(labels, 'env.col.value')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const tooltip = buildEnvKeyTooltip(labels, item);
                  const busy = savingKey === item.key;
                  const draftValue = drafts[item.key] ?? '';
                  const showMaskPlaceholder = item.sensitive && item.configured && !draftValue;
                  return (
                    <tr key={item.key}>
                      <td>
                        <Tooltip label={tooltip} side="right">
                          <code className="env-key-code">{item.key}</code>
                        </Tooltip>
                      </td>
                      <td>
                        <EnvValueControl
                          item={item}
                          draftValue={draftValue}
                          busy={busy}
                          isAdmin={isAdmin}
                          showMaskPlaceholder={showMaskPlaceholder}
                          onDraftChange={(value) =>
                            setDrafts((prev) => ({ ...prev, [item.key]: value }))
                          }
                          onPersist={(override) => {
                            void persistRow(item, override);
                          }}
                          onBrowse={() => setBrowseItem(item)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}
        </LoadingHost>
      </SettingsSection>
      {browseItem && browseItem.pathHost && (
        <PathBrowseModal
          open
          pathHost={browseItem.pathHost}
          pathKind={browseItem.pathKind ?? 'directory'}
          initialPath={drafts[browseItem.key] ?? ''}
          onClose={() => setBrowseItem(null)}
          onSelect={(absolutePath) => {
            setDrafts((prev) => ({ ...prev, [browseItem.key]: absolutePath }));
            void persistRow(browseItem, absolutePath);
            setBrowseItem(null);
          }}
        />
      )}
    </SettingsPageShell>
  );
}
