import { t, useLabels } from '../../i18n/labels.js';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useConfirm } from '../../hooks/useConfirm.js';

export type PublishedVersionRow = {
  id: string;
  version: number;
  semverLabel: string;
  publishNote?: string;
  publishedAt: string;
  publishedByEmail?: string;
  isCurrent: boolean;
};

export function PublishHistoryPanel({
  workflowId,
  onDraftRestored,
  onPublishChanged,
}: {
  workflowId: string;
  onDraftRestored: () => void;
  onPublishChanged: () => void;
}) {
  const labels = useLabels();
  const [versions, setVersions] = useState<PublishedVersionRow[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [compareTo, setCompareTo] = useState<number | null>(null);
  const [diffText, setDiffText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const load = () => {
    void api.workflows
      .listPublishedVersions(workflowId)
      .then(setVersions)
      .catch((e) => setError(e instanceof Error ? e.message : t(labels, 'common.loadFailed')));
  };

  useEffect(() => {
    load();
  }, [workflowId]);

  const loadDiff = async (a: number, b: number) => {
    setDiffText(null);
    try {
      const [defA, defB] = await Promise.all([
        api.workflows.getPublishedVersionDefinition(workflowId, a),
        api.workflows.getPublishedVersionDefinition(workflowId, b),
      ]);
      const sa = JSON.stringify(defA, null, 2);
      const sb = JSON.stringify(defB, null, 2);
      if (sa === sb) {
        setDiffText(t(labels, 'auto.t_52f8b420'));
      } else {
        setDiffText(
          t(labels, 'editor.versionDiff', {
            a: String(a),
            b: String(b),
            saLen: String(sa.length),
            sbLen: String(sb.length),
            preview: `${sa.slice(0, 2000)}${sa.length > 2000 ? t(labels, 'editor.versionDiffEllipsis') : ''}`,
          }),
        );
      }
    } catch (e) {
      setDiffText(e instanceof Error ? e.message : t(labels, 'auto.t_1fd11f40'));
    }
  };

  const rollbackPublish = async (version: number) => {
    const ok = await confirm({
      title: t(labels, 'editor.publishHistoryRollbackTitle'),
      message: t(labels, 'editor.publishHistoryRollbackConfirm', { version: String(version) }),
      confirmLabel: t(labels, 'editor.publishHistoryRollback'),
      danger: true,
    });
    if (!ok) return;
    try {
      await api.workflows.rollbackPublish(workflowId, version);
      load();
      onPublishChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : t(labels, 'common.saveFailed'));
    }
  };

  const restoreDraft = async (version: number) => {
    const ok = await confirm({
      title: t(labels, 'editor.publishHistoryRestoreTitle'),
      message: t(labels, 'editor.publishHistoryRestoreConfirm', { version: String(version) }),
      confirmLabel: t(labels, 'editor.publishHistoryRestore'),
    });
    if (!ok) return;
    try {
      await api.workflows.restoreDraftFromPublished(workflowId, version);
      onDraftRestored();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t(labels, 'common.saveFailed'));
    }
  };

  return (
    <>
      {dialog}
      {error && <p className="error">{error}</p>}
      {versions.length === 0 ? (
        <p className="hint">{t(labels, 'editor.publishHistoryEmpty')}</p>
      ) : (
        <ul className="list-plain">
          {versions.map((v) => (
            <li key={v.id} className="rxwf-mb-inline">
              <label>
                <input
                  type="radio"
                  name="pub-version-a"
                  checked={selected === v.version}
                  onChange={() => setSelected(v.version)}
                />{' '}
                v{v.semverLabel} (#{v.version})
                {v.isCurrent ? ` · ${t(labels, 'editor.publishHistoryCurrent')}` : ''}
              </label>
              <div className="rxwf-type-meta publish-history-meta">
                {new Date(v.publishedAt).toLocaleString()}
                {v.publishedByEmail ? ` · ${v.publishedByEmail}` : ''}
                {v.publishNote ? ` · ${v.publishNote}` : ''}
              </div>
              <div className="publish-history-actions rxwf-inline-group">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCompareTo(v.version)}
                >
                  {t(labels, 'editor.compare')}
                </button>
                {!v.isCurrent && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void rollbackPublish(v.version)}
                  >
                    {t(labels, 'editor.publishHistoryRollback')}
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void restoreDraft(v.version)}
                >
                  {t(labels, 'editor.publishHistoryRestore')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {compareTo !== null && selected !== null && compareTo !== selected && (
        <div className="rxwf-mt-4">
          <button
            type="button"
            className="btn-primary"
            onClick={() => void loadDiff(selected, compareTo)}
          >
            {t(labels, 'editor.compareVersions', {
              a: String(selected),
              b: String(compareTo),
            })}
          </button>
        </div>
      )}
      {diffText && (
        <pre className="code-block publish-history-diff">
          {diffText}
        </pre>
      )}
    </>
  );
}
