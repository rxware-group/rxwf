import { useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';

const PAN_SCROLL_SPEED = 0.5;

/**
 * Shift+滚轮：视口左右平移（React Flow panOnScroll 仅处理纵向）。
 */
export function CanvasViewportWheel() {
  const { getViewport, setViewport } = useReactFlow();

  useEffect(() => {
    const pane = document.querySelector('.canvas-panel .react-flow__pane');
    if (!pane) return;

    const onWheel: EventListener = (event) => {
      const e = event as WheelEvent;
      if (!e.shiftKey || e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      const { x, y, zoom } = getViewport();
      setViewport({ x: x - delta * PAN_SCROLL_SPEED, y, zoom });
    };

    pane.addEventListener('wheel', onWheel, { passive: false });
    return () => pane.removeEventListener('wheel', onWheel);
  }, [getViewport, setViewport]);

  return null;
}
