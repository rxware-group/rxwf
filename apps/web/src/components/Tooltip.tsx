import {
  cloneElement,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';

export type TooltipSide = 'right' | 'left' | 'top' | 'bottom';
export type TooltipPlacement = TooltipSide | 'cursor';

const CURSOR_OFFSET = 12;
const VIEWPORT_PAD = 8;

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(node);
      else (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

function clampCoords(
  top: number,
  left: number,
  tooltip: HTMLElement | null,
): { top: number; left: number } {
  const width = tooltip?.offsetWidth ?? 0;
  const height = tooltip?.offsetHeight ?? 0;
  return {
    top: Math.min(
      Math.max(VIEWPORT_PAD, top),
      Math.max(VIEWPORT_PAD, window.innerHeight - height - VIEWPORT_PAD),
    ),
    left: Math.min(
      Math.max(VIEWPORT_PAD, left),
      Math.max(VIEWPORT_PAD, window.innerWidth - width - VIEWPORT_PAD),
    ),
  };
}

function anchorCoords(rect: DOMRect, side: TooltipSide): { top: number; left: number } {
  const gap = 8;
  if (side === 'left') {
    return { top: rect.top + rect.height / 2, left: rect.left - gap };
  }
  if (side === 'top') {
    return { top: rect.top - gap, left: rect.left + rect.width / 2 };
  }
  if (side === 'bottom') {
    return { top: rect.bottom + gap, left: rect.left + rect.width / 2 };
  }
  return { top: rect.top + rect.height / 2, left: rect.right + gap };
}

function TooltipPortal({
  label,
  placement,
  coords,
  tooltipRef,
}: {
  label: string;
  placement: TooltipPlacement;
  coords: { top: number; left: number };
  tooltipRef: React.RefObject<HTMLDivElement | null>;
}) {
  return createPortal(
    <div
      ref={tooltipRef}
      className={`rxwf-tooltip rxwf-tooltip--portal rxwf-tooltip--${placement}`}
      style={{ top: coords.top, left: coords.left }}
      role="tooltip"
    >
      {label}
    </div>,
    document.body,
  );
}

export function Tooltip({
  label,
  children,
  side = 'right',
}: {
  label: string;
  children: ReactElement;
  side?: TooltipSide;
}) {
  const text = label.trim();
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<TooltipPlacement>(side);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const followCursorRef = useRef(false);

  const setAtCursor = useCallback((clientX: number, clientY: number) => {
    setPlacement('cursor');
    setCoords(
      clampCoords(
        clientY + CURSOR_OFFSET,
        clientX + CURSOR_OFFSET,
        tooltipRef.current,
      ),
    );
  }, []);

  const setAtAnchor = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    setPlacement(side);
    const raw = anchorCoords(el.getBoundingClientRect(), side);
    setCoords(clampCoords(raw.top, raw.left, tooltipRef.current));
  }, [side]);

  useLayoutEffect(() => {
    if (!open) return;
    setCoords((prev) => {
      const next = clampCoords(prev.top, prev.left, tooltipRef.current);
      if (next.top === prev.top && next.left === prev.left) return prev;
      return next;
    });
  }, [open, placement, text]);

  const showFromMouse = (e: MouseEvent) => {
    followCursorRef.current = true;
    setAtCursor(e.clientX, e.clientY);
    setOpen(true);
  };

  const showFromFocus = () => {
    followCursorRef.current = false;
    setAtAnchor();
    setOpen(true);
  };

  const hide = () => {
    followCursorRef.current = false;
    setOpen(false);
  };

  if (!text) return children;

  const child = children as ReactElement<{
    onMouseEnter?: (e: MouseEvent) => void;
    onMouseLeave?: (e: MouseEvent) => void;
    onMouseMove?: (e: MouseEvent) => void;
    onFocus?: (e: FocusEvent) => void;
    onBlur?: (e: FocusEvent) => void;
    ref?: React.Ref<HTMLElement>;
  }>;

  return (
    <>
      {cloneElement(child, {
        ref: mergeRefs(anchorRef, child.props.ref),
        onMouseEnter: (e: MouseEvent) => {
          showFromMouse(e);
          child.props.onMouseEnter?.(e);
        },
        onMouseMove: (e: MouseEvent) => {
          if (followCursorRef.current) {
            setAtCursor(e.clientX, e.clientY);
          }
          child.props.onMouseMove?.(e);
        },
        onMouseLeave: (e: MouseEvent) => {
          hide();
          child.props.onMouseLeave?.(e);
        },
        onFocus: (e: FocusEvent) => {
          showFromFocus();
          child.props.onFocus?.(e);
        },
        onBlur: (e: FocusEvent) => {
          hide();
          child.props.onBlur?.(e);
        },
      })}
      {open ? (
        <TooltipPortal
          label={text}
          placement={placement}
          coords={coords}
          tooltipRef={tooltipRef}
        />
      ) : null}
    </>
  );
}
