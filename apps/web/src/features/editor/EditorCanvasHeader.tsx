import { useMemo } from 'react';
import { t, useLabels } from '../../i18n/labels.js';
import { normalizeLocale } from '../../i18n/locales.js';
import { LoadingSpinner } from '../../components/LoadingSpinner.js';
import { MoreMenu } from '../../components/MoreMenu.js';
import { Tooltip } from '../../components/Tooltip.js';
import { WorkflowEditorViewTabs } from './WorkflowEditorViewTabs.js';
import { PublishMenuButton } from './PublishMenuButton.js';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function EditorCanvasHeader({
  basePath,
  executionsDisabled,
  workflowName,
  autoSaveStatus,
  publishStatus,
  publishedSemver,
  hasUnpublishedChanges,
  showChat,
  canShowPublishHistory,
  canPublish,
  showCopyToEditor,
  onOpenPublishHistory,
  onOpenSettings,
  onToggleChat,
  onPublish,
  onUnpublish,
  onCopyToEditor,
}: {
  basePath: string;
  executionsDisabled?: boolean;
  workflowName: string;
  autoSaveStatus: AutoSaveStatus;
  publishStatus: 'draft' | 'published';
  publishedSemver: string | null;
  hasUnpublishedChanges: boolean;
  showChat: boolean;
  canShowPublishHistory: boolean;
  canPublish: boolean;
  showCopyToEditor: boolean;
  onOpenPublishHistory: () => void;
  onOpenSettings: () => void;
  onToggleChat: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onCopyToEditor: () => void;
}) {
  const labels = useLabels();

  const statusLabel = t(labels, 'editor.publishStatusPublished', {
    version: publishedSemver ? ` v${publishedSemver}` : '',
    changes: hasUnpublishedChanges ? t(labels, 'editor.unpublishedChanges') : '',
  });

  const autoSaveLabel =
    autoSaveStatus === 'saved'
      ? t(labels, 'editor.autoSaved')
      : autoSaveStatus === 'error'
        ? t(labels, 'editor.autoSaveFailed')
        : null;

  const showAutoSaveBadge = autoSaveStatus === 'saving' || autoSaveLabel != null;

  const copyToEditorLabel = useMemo(() => {
    const zh = normalizeLocale(localStorage.getItem('rxwf.locale')) === 'zh-CN';
    return t(
      labels,
      'executions.copyToEditor',
      undefined,
      zh ? '拷贝到编辑器' : 'Copy to editor',
    );
  }, [labels]);

  const moreItems = useMemo(() => {
    const items = [
      {
        key: 'settings',
        label: t(labels, 'auto.t_7debf9cb'),
      },
    ];
    if (canShowPublishHistory) {
      items.push({
        key: 'publishHistory',
        label: t(labels, 'editor.publishHistory'),
      });
    }
    if (showCopyToEditor) {
      items.push({ key: 'copyToEditor', label: copyToEditorLabel });
    }
    return items;
  }, [labels, canShowPublishHistory, showCopyToEditor, copyToEditorLabel]);

  const onMoreAction = (key: string) => {
    if (key === 'settings') onOpenSettings();
    else if (key === 'publishHistory') onOpenPublishHistory();
    else if (key === 'copyToEditor') onCopyToEditor();
  };

  return (
    <div
      className="editor-canvas-header"
      title={t(labels, 'auto.Delete_Ctrl_Z_Ctrl_Shif_158d7cbb')}
    >
      <div className="editor-canvas-header-start">
        <h2 className="editor-workflow-title">{workflowName}</h2>
        {publishStatus === 'published' && (
          <span className={`status-pill status-${publishStatus}`}>{statusLabel}</span>
        )}
        {showAutoSaveBadge && (
          <span
            className={`dirty-badge${autoSaveStatus === 'error' ? ' is-error' : ''}${autoSaveStatus === 'saving' ? ' dirty-badge--spinner' : ''}`}
            title={
              autoSaveStatus === 'saving'
                ? t(labels, 'editor.autoSaving')
                : autoSaveLabel ?? undefined
            }
          >
            {autoSaveStatus === 'saving' ? (
              <LoadingSpinner size="sm" label={t(labels, 'editor.autoSaving')} />
            ) : (
              autoSaveLabel
            )}
          </span>
        )}
      </div>
      <div className="editor-canvas-header-center">
        <WorkflowEditorViewTabs
          basePath={basePath}
          executionsDisabled={executionsDisabled}
        />
      </div>
      <div className="editor-canvas-header-end">
        <PublishMenuButton
          publishStatus={publishStatus}
          hasUnpublishedChanges={hasUnpublishedChanges}
          canPublish={canPublish}
          onPublish={onPublish}
          onUnpublish={onUnpublish}
        />
        <Tooltip
          label={
            showChat ? t(labels, 'auto.t_d3d63447') : t(labels, 'auto.t_9b0519a1')
          }
          side="bottom"
        >
          <button
            type="button"
            className={`btn-toolbar btn-secondary${showChat ? ' is-active' : ''}`}
            onClick={onToggleChat}
            aria-label={t(labels, 'auto.AI_5be8dfd8')}
          >
            {showChat ? t(labels, 'auto.t_d3d63447') : t(labels, 'auto.t_9b0519a1')}
          </button>
        </Tooltip>
        <MoreMenu
          variant="toolbar"
          items={moreItems}
          ariaLabel={t(labels, 'editor.moreActions')}
          tooltipLabel={t(labels, 'editor.moreActions')}
          onAction={onMoreAction}
        />
      </div>
    </div>
  );
}
