import { t, useLabels } from '../../../i18n/labels.js';
import { FormField } from '../../../components/FormField.js';
import { ToolWorkflowSelect } from '../ToolWorkflowSelect.js';
import { SubworkflowInputMappingFields } from '../SubworkflowInputMappingFields.js';

/** Dedicated params panel for toolWorkflow satellite (T-072). */
export function ToolWorkflowParamsPanel({
  workflowId: currentWorkflowId,
  parameters,
  onChange,
}: {
  workflowId?: string;
  parameters: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const labels = useLabels();
  const workflowId = String(parameters.workflowId ?? '');

  return (
    <div className="tool-workflow-params">
      <ToolWorkflowSelect
        value={workflowId}
        currentWorkflowId={currentWorkflowId}
        onChange={(id) => onChange({ ...parameters, workflowId: id })}
      />
      <FormField label={t(labels, 'editor.agentTools.toolDescription')}>
        <textarea
          rows={3}
          value={String(parameters.toolDescription ?? '')}
          onChange={(e) => onChange({ ...parameters, toolDescription: e.target.value })}
        />
      </FormField>
      <SubworkflowInputMappingFields
        workflowId={workflowId}
        mapping={(parameters.inputMapping as Record<string, unknown> | undefined) ?? {}}
        onChange={(inputMapping) => onChange({ ...parameters, inputMapping })}
      />
    </div>
  );
}
