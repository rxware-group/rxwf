import type { WorkflowDefinition } from '../../api/client.js';
import { getNodePortsEditorOptions } from './crew-editor-settings.js';
import { getNodePorts } from './node-port-defs.js';

export function isValidWorkflowConnection(
  definition: WorkflowDefinition,
  connection: {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  },
): boolean {
  if (connection.source === connection.target) return false;
  const sourceNode = definition.nodes.find((n) => n.id === connection.source);
  const targetNode = definition.nodes.find((n) => n.id === connection.target);
  if (!sourceNode || !targetNode) return false;
  if (sourceNode.type === 'stickyNote' || targetNode.type === 'stickyNote') {
    return false;
  }

  const sourceHandle = connection.sourceHandle ?? 'main';
  const targetHandle = connection.targetHandle ?? 'main';
  const portOptions = getNodePortsEditorOptions(definition.settings);
  const sourcePorts = getNodePorts(sourceNode.type, sourceNode.parameters, portOptions);
  const targetPorts = getNodePorts(targetNode.type, targetNode.parameters, portOptions);

  const sourceMain = sourcePorts.outputs.some((p) => p.id === sourceHandle);
  const sourceResource = (sourcePorts.resourceOutputs ?? []).some(
    (p) => p.id === sourceHandle,
  );
  const targetMain = targetPorts.inputs.some((p) => p.id === targetHandle);
  const targetResource = (targetPorts.resourceInputs ?? []).some(
    (p) => p.id === targetHandle,
  );

  if (sourceResource && targetResource) {
    return sourceHandle === targetHandle;
  }
  if (sourceMain && targetMain) {
    return true;
  }
  return false;
}
