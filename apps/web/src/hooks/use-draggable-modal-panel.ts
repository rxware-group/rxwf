import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

const VIEWPORT_MARGIN = 8;

const DRAG_EXCLUDE_SELECTOR =
  '.rxwf-modal-close, button, input, textarea, select, a, [contenteditable="true"]';

export type ModalPosition = { x: number; y: number };

export function clampModalPosition(
  pos: ModalPosition,
  size: { width: number; height: number },
  viewport = { width: window.innerWidth, height: window.innerHeight },
): ModalPosition {
  const maxX = Math.max(VIEWPORT_MARGIN, viewport.width - size.width - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN, viewport.height - size.height - VIEWPORT_MARGIN);
  return {
    x: Math.min(Math.max(VIEWPORT_MARGIN, pos.x), maxX),
    y: Math.min(Math.max(VIEWPORT_MARGIN, pos.y), maxY),
  };
}

function isDragExcludedTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return true;
  return Boolean(target.closest(DRAG_EXCLUDE_SELECTOR));
}

export function useDraggableModalPanel(
  dialogRef: RefObject<HTMLElement | null>,
  options?: { open?: boolean; disabled?: boolean },
) {
  const { open = true, disabled = false } = options ?? {};
  const [position, setPosition] = useState<ModalPosition | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    if (open) setPosition(null);
  }, [open]);

  const onHeaderPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (disabled || e.button !== 0) return;
      if (isDragExcludedTarget(e.target)) return;

      const el = dialogRef.current;
      if (!el) return;

      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);

      const rect = el.getBoundingClientRect();
      const origin = position ?? { x: rect.left, y: rect.top };
      if (!position) setPosition(origin);

      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: origin.x,
        originY: origin.y,
      };
    },
    [disabled, dialogRef, position],
  );

  const onHeaderPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      const el = dialogRef.current;
      if (!el) return;

      const next = clampModalPosition(
        {
          x: drag.originX + (e.clientX - drag.startX),
          y: drag.originY + (e.clientY - drag.startY),
        },
        { width: el.offsetWidth, height: el.offsetHeight },
      );
      setPosition(next);
    },
    [dialogRef],
  );

  const onHeaderPointerUp = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const panelStyle: CSSProperties | undefined = position
    ? {
        position: 'fixed',
        left: position.x,
        top: position.y,
        margin: 0,
        transform: 'none',
      }
    : undefined;

  const headerProps = disabled
    ? {}
    : {
        onPointerDown: onHeaderPointerDown,
        onPointerMove: onHeaderPointerMove,
        onPointerUp: onHeaderPointerUp,
        onPointerCancel: onHeaderPointerUp,
      };

  return { panelStyle, headerProps };
}
