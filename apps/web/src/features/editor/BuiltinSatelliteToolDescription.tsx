import { t, useLabels } from '../../i18n/labels.js';
import { FormField } from '../../components/FormField.js';
import { FIXED_CAPABILITY_TOOL_AGENT_DESC_KEYS } from './fixed-capability-tool-types.js';

export function BuiltinSatelliteToolDescription({ nodeType }: { nodeType: string }) {
  const labels = useLabels();
  const descKey = FIXED_CAPABILITY_TOOL_AGENT_DESC_KEYS[nodeType];
  const agentDescription = descKey ? t(labels, descKey) : null;

  if (!agentDescription || agentDescription === descKey) return null;

  return (
    <FormField label={t(labels, 'editor.agentTools.toolDescription')}>
      <div className="node-builtin-tool-description" aria-readonly="true">
        <p className="node-builtin-tool-description-agent">{agentDescription}</p>
      </div>
    </FormField>
  );
}
