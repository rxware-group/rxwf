import { useCallback, useEffect, useState } from 'react';
import { api, type SkillRecordSummary } from '../../api/client.js';
import { EmptyState } from '../../components/EmptyState.js';
import { FormField } from '../../components/FormField.js';
import { t, useLabels } from '../../i18n/labels.js';
import { SettingsPageShell, SettingsSection } from '../settings/SettingsPageShell.js';

type Tab = 'skills' | 'rules' | 'workflows' | 'hooks' | 'commands';

type CatalogRow = { id?: string; name?: string; relPath?: string; path?: string; description?: string };

export function RxwfSettingsPage() {
  const labels = useLabels();
  const [tab, setTab] = useState<Tab>('skills');
  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [skills, setSkills] = useState<SkillRecordSummary[]>([]);
  const [importPath, setImportPath] = useState('');
  const [importFormat, setImportFormat] = useState<'cursor' | 'antigravity_gemini'>('cursor');

  const [rulesPreview, setRulesPreview] = useState('');
  const [rulesTokens, setRulesTokens] = useState<number | null>(null);

  const [workflows, setWorkflows] = useState<CatalogRow[]>([]);
  const [hooks, setHooks] = useState<CatalogRow[]>([]);
  const [commands, setCommands] = useState<CatalogRow[]>([]);

  const rootQuery = workspaceRoot.trim() || undefined;

  useEffect(() => {
    void api.rxwfWorkspace
      .get()
      .then((r) => setWorkspaceRoot(r.workspaceRoot))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const saveWorkspace = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.rxwfWorkspace.put(workspaceRoot.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const loadSkills = useCallback(async () => {
    setSkills(await api.skills.list());
  }, []);

  const loadCatalog = useCallback(async () => {
    const [wf, hk, cmd] = await Promise.all([
      api.rxwfCatalog.workflows(rootQuery),
      api.rxwfCatalog.hooks(rootQuery),
      api.rxwfCatalog.commands(rootQuery),
    ]);
    setWorkflows(wf.items as CatalogRow[]);
    setHooks(hk.items as CatalogRow[]);
    setCommands(cmd.items as CatalogRow[]);
  }, [rootQuery]);

  useEffect(() => {
    void loadSkills().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [loadSkills]);

  useEffect(() => {
    if (tab === 'skills') return;
    void loadCatalog().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [tab, loadCatalog]);

  const runScan = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.skills.scan({ workspaceRoot: rootQuery });
      await loadSkills();
      setError(null);
      alert(t(labels, 'rxwf.scanDone', { n: String(res.skillsFound) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!importPath.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.skills.import({
        sourcePath: importPath.trim(),
        workspaceRoot: rootQuery,
        sourceFormat: importFormat,
      });
      setImportPath('');
      await loadSkills();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const previewRules = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.instructionContexts.resolve({
        workspaceRoot: rootQuery,
        ruleMode: 'inherit',
        ruleSources: ['rxwf_rules'],
      });
      setRulesPreview(res.merged);
      setRulesTokens(res.tokenEstimate);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      className={tab === id ? 'is-active' : undefined}
      onClick={() => setTab(id)}
    >
      {label}
    </button>
  );

  return (
    <SettingsPageShell
      titleKey="settings.nav.rxwf"
      lead={<p className="hint settings-page-lead">{t(labels, 'rxwf.lead')}</p>}
    >
      <SettingsSection title={t(labels, 'rxwf.workspace')}>
        <FormField label={t(labels, 'rxwf.workspaceRoot')}>
          <input
            value={workspaceRoot}
            onChange={(e) => setWorkspaceRoot(e.target.value)}
            placeholder={t(labels, 'rxwf.workspacePlaceholder')}
          />
        </FormField>
        <p className="hint">{t(labels, 'rxwf.workspaceHint')}</p>
        <button
          type="button"
          className="btn-primary rxwf-mt-inline"
          disabled={busy}
          onClick={() => void saveWorkspace()}
        >
          {t(labels, 'common.save')}
        </button>
      </SettingsSection>

      <div className="segmented rxwf-mb-block">
        {tabBtn('skills', t(labels, 'rxwf.tab.skills'))}
        {tabBtn('rules', t(labels, 'rxwf.tab.rules'))}
        {tabBtn('workflows', t(labels, 'rxwf.tab.workflows'))}
        {tabBtn('hooks', t(labels, 'rxwf.tab.hooks'))}
        {tabBtn('commands', t(labels, 'rxwf.tab.commands'))}
      </div>

      {error && <p className="error">{error}</p>}

      {tab === 'skills' && (
        <>
          <SettingsSection title={t(labels, 'rxwf.skills.registered')}>
            {skills.length === 0 ? (
              <EmptyState
                icon="plugin"
                title={t(labels, 'rxwf.skills.empty')}
                description={t(labels, 'rxwf.skills.emptyHint')}
              />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t(labels, 'auto.t_e4e46c72')}</th>
                    <th>slug</th>
                    <th>ID</th>
                    <th>{t(labels, 'auto.t_989d1aff')}</th>
                  </tr>
                </thead>
                <tbody>
                  {skills.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>
                        <code>.rxwf/skills/{s.slug}</code>
                      </td>
                      <td>
                        <code>{s.id}</code>
                      </td>
                      <td>{s.sourceFormat}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button
              type="button"
              className="btn-secondary rxwf-mt-4"
              disabled={busy}
              onClick={() => void runScan()}
            >
              {t(labels, 'rxwf.skills.scan')}
            </button>
          </SettingsSection>

          <SettingsSection title={t(labels, 'rxwf.skills.import')}>
            <FormField label={t(labels, 'rxwf.skills.sourcePath')}>
              <input
                value={importPath}
                onChange={(e) => setImportPath(e.target.value)}
                placeholder=".cursor/skills/my-skill"
              />
            </FormField>
            <FormField label={t(labels, 'rxwf.skills.format')}>
              <select
                value={importFormat}
                onChange={(e) =>
                  setImportFormat(e.target.value as 'cursor' | 'antigravity_gemini')
                }
              >
                <option value="cursor">cursor</option>
                <option value="antigravity_gemini">antigravity_gemini</option>
              </select>
            </FormField>
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void runImport()}>
              {t(labels, 'rxwf.skills.importBtn')}
            </button>
          </SettingsSection>
        </>
      )}

      {tab === 'rules' && (
        <SettingsSection title={t(labels, 'rxwf.rules.preview')}>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void previewRules()}>
            {t(labels, 'rxwf.rules.resolve')}
          </button>
          {rulesTokens != null && (
            <p className="hint rxwf-mt-inline">
              {t(labels, 'rxwf.rules.tokens', { n: String(rulesTokens) })}
            </p>
          )}
          <textarea
            className="rxwf-rules-preview"
            rows={16}
            readOnly
            value={rulesPreview}
            placeholder={t(labels, 'rxwf.rules.placeholder')}
          />
        </SettingsSection>
      )}

      {tab === 'workflows' && (
        <>
          <CatalogTable
            emptyTitle={t(labels, 'rxwf.workflows.empty')}
            rows={workflows}
            columns={['relPath', 'id', 'name']}
          />
          <p className="hint rxwf-mt-4">
            {t(labels, 'rxwf.workflows.editorHint')}
          </p>
        </>
      )}

      {tab === 'hooks' && (
        <CatalogTable
          emptyTitle={t(labels, 'rxwf.hooks.empty')}
          rows={hooks}
          columns={['id', 'event', 'filePath']}
        />
      )}

      {tab === 'commands' && (
        <CatalogTable
          emptyTitle={t(labels, 'rxwf.commands.empty')}
          rows={commands}
          columns={['id', 'label', 'filePath']}
        />
      )}
    </SettingsPageShell>
  );
}

function CatalogTable({
  rows,
  columns,
  emptyTitle,
}: {
  rows: CatalogRow[];
  columns: string[];
  emptyTitle: string;
}) {
  if (rows.length === 0) {
    return (
      <SettingsSection title="">
        <EmptyState icon="plugin" title={emptyTitle} description="" />
      </SettingsSection>
    );
  }
  return (
    <SettingsSection title="">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? row.relPath ?? row.path ?? i}>
              {columns.map((c) => (
                <td key={c}>{String((row as Record<string, unknown>)[c] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </SettingsSection>
  );
}
