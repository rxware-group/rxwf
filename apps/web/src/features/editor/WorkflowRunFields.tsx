import { useCallback, useEffect, useState } from 'react';
import { api, type WorkflowDefinition } from '../../api/client.js';
import { FormField } from '../../components/FormField.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { Select } from '../../components/Select.js';
import { t, useLabels } from '../../i18n/labels.js';

type TemplateEntry = { relPath: string; id?: string; name?: string };

export function WorkflowRunFields({
  parameters,
  workspaceRoot,
  onChange,
  onReplaceDefinition,
}: {
  parameters: Record<string, unknown>;
  workspaceRoot?: string;
  onChange: (next: Record<string, unknown>) => void;
  onReplaceDefinition?: (definition: WorkflowDefinition) => void;
}) {
  const labels = useLabels();
  const source = String(parameters.workflowSource ?? 'template');
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const root = workspaceRoot?.trim() || undefined;

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.rxwfCatalog.workflows(root);
      setTemplates(res.items as TemplateEntry[]);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [root]);

  useEffect(() => {
    if (source !== 'template') return;
    void loadTemplates();
  }, [source, loadTemplates]);

  const importToEditor = async () => {
    const relPath = String(parameters.workflowRelPath ?? '').trim();
    if (!relPath || !onReplaceDefinition) return;
    setImportBusy(true);
    setImportError(null);
    try {
      const res = await api.rxwfCatalog.compileByPath({
        relPath,
        workspaceRoot: root,
        compileMode: 'linear_skillRun',
      });
      const def = res.definition as WorkflowDefinition;
      onReplaceDefinition({
        ...def,
        name: def.name || parameters.workflowRelPath?.toString() || 'Imported',
      });
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <>
      <FormField label={t(labels, 'editor.workflowRun.source')}>
        <Select
          value={source}
          onChange={(next) =>
            onChange({
              ...parameters,
              workflowSource: next,
            })
          }
          options={[
            { value: 'template', label: t(labels, 'editor.workflowRun.sourceTemplate') },
            { value: 'published', label: t(labels, 'editor.workflowRun.sourcePublished') },
          ]}
        />
      </FormField>

      {source === 'template' ? (
        <LoadingHost loading={loading} label={t(labels, 'common.loading')}>
          <FormField label={t(labels, 'editor.workflowRun.template')}>
            <Select
              value={String(parameters.workflowRelPath ?? '')}
              disabled={loading}
              onChange={(relPath) =>
                onChange({ ...parameters, workflowRelPath: relPath })
              }
              options={[
                { value: '', label: t(labels, 'editor.workflowRun.templatePlaceholder') },
                ...templates.map((t) => ({
                  value: t.relPath,
                  label: t.name ? `${t.name} (${t.relPath})` : t.relPath,
                })),
              ]}
            />
          </FormField>
          {onReplaceDefinition && (
            <>
              <button
                type="button"
                className="btn-secondary"
                disabled={importBusy || !String(parameters.workflowRelPath ?? '').trim()}
                onClick={() => void importToEditor()}
              >
                {importBusy
                  ? t(labels, 'common.loading')
                  : t(labels, 'editor.workflowRun.importToEditor')}
              </button>
              {importError && <p className="error">{importError}</p>}
              <p className="hint">{t(labels, 'editor.workflowRun.importHint')}</p>
            </>
          )}
        </LoadingHost>
      ) : (
        <FormField label={t(labels, 'editor.workflowRun.publishedId')}>
          <input
            type="text"
            value={String(parameters.workflowId ?? '')}
            placeholder="published-workflow-id"
            onChange={(e) => onChange({ ...parameters, workflowId: e.target.value })}
          />
        </FormField>
      )}

      <FormField label={t(labels, 'rxwf.workspaceRoot')}>
        <input
          type="text"
          value={String(parameters.workspaceRoot ?? '')}
          placeholder={t(labels, 'rxwf.workspacePlaceholder')}
          onChange={(e) => onChange({ ...parameters, workspaceRoot: e.target.value })}
        />
      </FormField>

      <FormField label={t(labels, 'editor.workflowRun.expandTemplate')}>
        <Select
          value={String(parameters.expandTemplate ?? 'true')}
          onChange={(v) => onChange({ ...parameters, expandTemplate: v })}
          options={[
            { value: 'true', label: t(labels, 'auto.t_d4e9ca3d') },
            { value: 'false', label: t(labels, 'auto.t_be70be5a') },
          ]}
        />
      </FormField>
    </>
  );
}
