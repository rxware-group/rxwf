import { t, useLabels } from '../../i18n/labels.js';
import { useState } from 'react';
import { NodePalette } from './NodePalette.js';
import { WorkflowExecutionsSidebar } from './WorkflowExecutionsSidebar.js';

type LeftPaneTab = 'nodes' | 'executions';

export function EditorLeftPane({
  workflowId,
  isNewWorkflow,
  isExecutionsView,
  selectedExecutionId,
  basePath,
  executionsRefreshKey,
  enableCrew,
  onAddNode,
}: {
  workflowId?: string;
  isNewWorkflow: boolean;
  /** Top-level route is /executions (replay canvas). */
  isExecutionsView: boolean;
  selectedExecutionId: string | null;
  basePath: string;
  executionsRefreshKey: number;
  enableCrew: boolean;
  onAddNode: (type: string) => void;
}) {
  const labels = useLabels();
  const canShowExecutions = Boolean(workflowId && !isNewWorkflow);
  const [tab, setTab] = useState<LeftPaneTab>(isExecutionsView ? 'executions' : 'nodes');

  if (isExecutionsView && canShowExecutions) {
    return (
      <WorkflowExecutionsSidebar
        workflowId={workflowId!}
        selectedExecutionId={selectedExecutionId}
        basePath={basePath}
        refreshKey={executionsRefreshKey}
      />
    );
  }

  if (!canShowExecutions) {
    return <NodePalette onAdd={onAddNode} enableCrew={enableCrew} />;
  }

  return (
    <div className="editor-left-pane">
      <div className="editor-left-pane-tabs segmented" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'nodes'}
          className={tab === 'nodes' ? 'is-active' : ''}
          onClick={() => setTab('nodes')}
        >
          {t(labels, 'editor.leftPane.nodes')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'executions'}
          className={tab === 'executions' ? 'is-active' : ''}
          onClick={() => setTab('executions')}
        >
          {t(labels, 'editor.leftPane.executions')}
        </button>
      </div>
      <div className="editor-left-pane-body">
        {tab === 'nodes' ? (
          <NodePalette onAdd={onAddNode} enableCrew={enableCrew} />
        ) : (
          <WorkflowExecutionsSidebar
            workflowId={workflowId!}
            selectedExecutionId={selectedExecutionId}
            basePath={basePath}
            refreshKey={executionsRefreshKey}
          />
        )}
      </div>
    </div>
  );
}
