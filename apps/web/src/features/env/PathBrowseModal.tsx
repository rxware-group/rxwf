import { useCallback, useEffect, useState } from 'react';
import { api, type RunnerSummary } from '../../api/client.js';
import { Modal } from '../../components/Modal.js';
import { ModalFooter } from '../../components/ModalFooter.js';
import { Select } from '../../components/Select.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { t, useLabels } from '../../i18n/labels.js';

export type PathBrowseHost = 'controlPlane' | 'runner';

export interface PathBrowseModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (absolutePath: string) => void;
  pathHost: PathBrowseHost;
  pathKind?: 'directory' | 'file';
  initialPath?: string;
}

type BrowseEntry = { name: string; path: string; kind: 'directory' | 'file' };

export function PathBrowseModal({
  open,
  onClose,
  onSelect,
  pathHost,
  pathKind = 'directory',
  initialPath = '',
}: PathBrowseModalProps) {
  const labels = useLabels();
  const [runners, setRunners] = useState<RunnerSummary[]>([]);
  const [runnerId, setRunnerId] = useState('');
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [parent, setParent] = useState<string | null>(null);
  const [entries, setEntries] = useState<BrowseEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runnersLoading, setRunnersLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrentPath(initialPath);
    setError(null);
    setEntries([]);
    if (pathHost === 'runner') {
      setRunnersLoading(true);
      void api.runners
        .list()
        .then((list) => {
          const online = list.filter(
            (r) => r.status === 'online' || r.kind === 'embedded',
          );
          setRunners(online.length > 0 ? online : list);
          const preferred =
            online.find((r) => r.kind === 'embedded') ?? online[0] ?? list[0];
          setRunnerId(preferred?.id ?? '');
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : t(labels, 'common.loadFailed'));
          setRunners([]);
          setRunnerId('');
        })
        .finally(() => setRunnersLoading(false));
    } else {
      setRunnerId('');
    }
  }, [open, pathHost, initialPath, labels]);

  const loadDir = useCallback(
    async (path: string, selectedRunnerId: string) => {
      if (pathHost === 'runner' && !selectedRunnerId) {
        setError(t(labels, 'env.browse.selectRunnerFirst'));
        setEntries([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await api.env.browse({
          host: pathHost,
          runnerId: pathHost === 'runner' ? selectedRunnerId : undefined,
          path,
          dirsOnly: pathKind === 'directory',
        });
        setCurrentPath(result.path);
        setParent(result.parent);
        setEntries(result.entries);
      } catch (e) {
        setError(e instanceof Error ? e.message : t(labels, 'common.loadFailed'));
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [pathHost, pathKind, labels],
  );

  useEffect(() => {
    if (!open) return;
    if (pathHost === 'runner') {
      if (!runnerId || runnersLoading) return;
      void loadDir(initialPath, runnerId);
      return;
    }
    void loadDir(initialPath, '');
  }, [open, pathHost, runnerId, runnersLoading, initialPath, loadDir]);

  const title =
    pathHost === 'controlPlane'
      ? t(labels, 'env.browse.titleControlPlane')
      : t(labels, 'env.browse.titleRunner', {
          name: runners.find((r) => r.id === runnerId)?.name ?? (runnerId || '—'),
        });

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      size="lg"
      footer={
        <ModalFooter
          actions={[
            {
              key: 'cancel',
              label: t(labels, 'common.cancel'),
              variant: 'secondary',
              onClick: onClose,
            },
            {
              key: 'select',
              label: t(labels, 'env.browse.selectFolder'),
              variant: 'primary',
              disabled: !currentPath && pathHost === 'runner' && !runnerId,
              onClick: () => {
                if (!currentPath && pathHost === 'controlPlane') {
                  onSelect('/');
                } else {
                  onSelect(currentPath);
                }
                onClose();
              },
            },
          ]}
        />
      }
    >
      <div className="env-path-browse">
        {pathHost === 'runner' && (
          <div className="env-path-browse-runner">
            <label className="rxwf-form-field-label" htmlFor="env-browse-runner">
              {t(labels, 'env.browse.runner')}
            </label>
            <Select
              id="env-browse-runner"
              value={runnerId}
              disabled={runnersLoading || runners.length === 0}
              aria-label={t(labels, 'env.browse.runner')}
              onChange={(value) => {
                setRunnerId(value);
                setCurrentPath('');
                setParent(null);
                setEntries([]);
              }}
              options={
                runners.length > 0
                  ? runners.map((r) => ({
                      value: r.id,
                      label: `${r.name} (${r.kind}, ${r.status})`,
                    }))
                  : [
                      {
                        value: '',
                        label: t(labels, 'env.browse.selectRunnerFirst'),
                        disabled: true,
                      },
                    ]
              }
            />
            <p className="hint">{t(labels, 'env.browse.runnerHint')}</p>
          </div>
        )}
        {pathHost === 'controlPlane' && (
          <p className="hint">{t(labels, 'env.browse.controlPlaneHint')}</p>
        )}
        <div className="env-path-browse-crumb mono">{currentPath || '/'}</div>
        {error && <p className="error">{error}</p>}
        <LoadingHost loading={loading || runnersLoading} label={t(labels, 'common.loading')}>
          <ul className="env-path-browse-list">
            {parent !== null && (
              <li>
                <button
                  type="button"
                  className="btn-link"
                  disabled={loading}
                  onClick={() => void loadDir(parent, runnerId)}
                >
                  ..
                </button>
              </li>
            )}
            {entries.map((entry) => (
              <li key={entry.path}>
                {entry.kind === 'directory' ? (
                  <button
                    type="button"
                    className="btn-link"
                    disabled={loading}
                    onClick={() => void loadDir(entry.path, runnerId)}
                  >
                    {entry.name}/
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-link"
                    disabled={loading || pathKind === 'directory'}
                    onClick={() => {
                      onSelect(entry.path);
                      onClose();
                    }}
                  >
                    {entry.name}
                  </button>
                )}
              </li>
            ))}
            {!loading && !runnersLoading && entries.length === 0 && !error && (
              <li className="hint">{t(labels, 'env.browse.empty')}</li>
            )}
          </ul>
        </LoadingHost>
      </div>
    </Modal>
  );
}
