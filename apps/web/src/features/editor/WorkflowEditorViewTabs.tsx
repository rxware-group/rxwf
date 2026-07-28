import { t, useLabels } from '../../i18n/labels.js';
import { normalizeLocale } from '../../i18n/locales.js';
import { NavLink } from 'react-router-dom';

function tabFallbacks() {
  const zh = normalizeLocale(localStorage.getItem('rxwf.locale')) === 'zh-CN';
  return {
    edit: zh ? '编辑' : 'Edit',
    executions: zh ? '执行' : 'Executions',
  };
}

export function WorkflowEditorViewTabs({
  basePath,
  executionsDisabled,
}: {
  basePath: string;
  executionsDisabled?: boolean;
}) {
  const labels = useLabels();
  const fb = tabFallbacks();

  return (
    <div className="editor-view-tabs segmented" role="tablist">
      <NavLink
        to={basePath}
        end
        className={({ isActive }) => (isActive ? 'is-active' : '')}
        role="tab"
      >
        {t(labels, 'editor.tab.edit', undefined, fb.edit)}
      </NavLink>
      {executionsDisabled ? (
        <span className="editor-view-tab-disabled" role="tab" aria-disabled="true">
          {t(labels, 'editor.tab.executions', undefined, fb.executions)}
        </span>
      ) : (
        <NavLink
          to={`${basePath}/executions`}
          className={({ isActive }) => (isActive ? 'is-active' : '')}
          role="tab"
        >
          {t(labels, 'editor.tab.executions', undefined, fb.executions)}
        </NavLink>
      )}
    </div>
  );
}
