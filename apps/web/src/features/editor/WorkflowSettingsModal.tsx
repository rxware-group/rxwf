import { useState } from 'react';
import { t, useLabels } from '../../i18n/labels.js';
import { Modal } from '../../components/Modal.js';
import { RunnerCompactEditor, type RunnerOption } from '../runners/RunnerCompactEditor.js';
import { ExposeAsToolSettings } from './ExposeAsToolSettings.js';
import { EnableCrewSettings } from './EnableCrewSettings.js';
import { WorkflowCollaboratorsPanel } from './WorkflowCollaboratorsPanel.js';
import type { RunnerPolicy } from '../runners/runner-policy-types.js';

export function WorkflowSettingsModal({
  open,
  onClose,
  runnerPolicy,
  runners,
  onRunnerPolicyChange,
  exposeAsTool,
  exposeAsToolDescription,
  onExposeAsToolChange,
  enableCrew,
  onEnableCrewChange,
  workflowId,
  canShowCollaborators,
  canShare,
}: {
  open: boolean;
  onClose: () => void;
  runnerPolicy: RunnerPolicy;
  runners: RunnerOption[];
  onRunnerPolicyChange: (policy: RunnerPolicy) => void;
  exposeAsTool: boolean;
  exposeAsToolDescription: string;
  onExposeAsToolChange: (patch: {
    exposeAsTool?: boolean;
    exposeAsToolDescription?: string;
  }) => void;
  enableCrew: boolean;
  onEnableCrewChange: (enabled: boolean) => void;
  workflowId: string | undefined;
  canShowCollaborators: boolean;
  canShare: boolean;
}) {
  const labels = useLabels();
  const [settingsTab, setSettingsTab] = useState<'runner' | 'agentTool' | 'collab'>('runner');

  return (
    <Modal
      open={open}
      title={t(labels, 'auto.t_7debf9cb')}
      onClose={onClose}
      closeOnBackdrop
      size="lg"
      maximizable
      panelClassName="workflow-settings-modal"
    >
      <div className="segmented workflow-settings-tabs">
        <button
          type="button"
          className={settingsTab === 'runner' ? 'is-active' : ''}
          onClick={() => setSettingsTab('runner')}
        >
          {t(labels, 'settings.nav.runners')}
        </button>
        <button
          type="button"
          className={settingsTab === 'agentTool' ? 'is-active' : ''}
          onClick={() => setSettingsTab('agentTool')}
        >
          Agent Tool
        </button>
        <button
          type="button"
          className={settingsTab === 'collab' ? 'is-active' : ''}
          onClick={() => setSettingsTab('collab')}
        >
          {t(labels, 'editor.collaborators')}
        </button>
      </div>
      {settingsTab === 'runner' && (
        <>
          <RunnerCompactEditor
            variant="workflow"
            policy={runnerPolicy}
            runners={runners}
            onChange={onRunnerPolicyChange}
          />
          <EnableCrewSettings checked={enableCrew} onChange={onEnableCrewChange} />
        </>
      )}
      {settingsTab === 'agentTool' && (
        <ExposeAsToolSettings
          exposeAsTool={exposeAsTool}
          description={exposeAsToolDescription}
          onChange={onExposeAsToolChange}
        />
      )}
      {settingsTab === 'collab' && canShowCollaborators && workflowId && (
        <WorkflowCollaboratorsPanel workflowId={workflowId} readOnly={!canShare} />
      )}
    </Modal>
  );
}
