import { useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { WorkflowDefinition } from '../../api/client.js';

export function FocusNodeBridge({
  definition,
  focusNodeId,
}: {
  definition: WorkflowDefinition;
  focusNodeId: string | null;
}) {
  const { setCenter } = useReactFlow();

  useEffect(() => {
    if (!focusNodeId) return;
    const node = definition.nodes.find((n) => n.id === focusNodeId);
    if (!node) return;
    setCenter(node.position.x + 80, node.position.y + 40, { zoom: 1.1, duration: 300 });
  }, [focusNodeId, definition.nodes, setCenter]);

  return null;
}
