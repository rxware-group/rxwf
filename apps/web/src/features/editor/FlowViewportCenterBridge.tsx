import { useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { FlowPositionGetter } from './flow-viewport-center.js';

const CANVAS_FLOW_SELECTOR = '.canvas-panel .react-flow';

export function FlowViewportCenterBridge({
  onRegister,
}: {
  onRegister?: (getter: FlowPositionGetter) => void;
}) {
  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    if (!onRegister) return;

    const getter: FlowPositionGetter = () => {
      const el = document.querySelector(CANVAS_FLOW_SELECTOR);
      const rect = el?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    };

    onRegister(getter);
    return () => {
      onRegister(() => ({ x: 200, y: 200 }));
    };
  }, [onRegister, screenToFlowPosition]);

  return null;
}
