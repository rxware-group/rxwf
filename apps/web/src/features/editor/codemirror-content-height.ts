import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { EditorView } from '@codemirror/view';

export function estimateHeightFromLines(
  value: string,
  lineHeightPx = 19,
  chromePx = 8,
): number {
  const lines = Math.max(1, value.split('\n').length);
  return lines * lineHeightPx + chromePx;
}

export function clampEditorHeightPx(
  contentPx: number,
  maxAvailPx: number,
  minPx = 80,
): number {
  return Math.max(minPx, Math.min(contentPx, maxAvailPx));
}

export function getMaxAvailableHeightPx(
  wrap: HTMLElement,
  containerSelector: string,
  minPx = 80,
): number {
  const container = wrap.closest(containerSelector) as HTMLElement | null;
  if (!container) return 480;
  const containerRect = container.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  const offsetInContainer = wrapRect.top - containerRect.top;
  const availableByClient = container.clientHeight - offsetInContainer;
  const availableByRect = containerRect.bottom - wrapRect.top;
  const available = Math.min(availableByClient, availableByRect);
  return Math.max(minPx, Math.floor(available));
}

export function useCodemirrorContentHeight(options: {
  wrapRef: RefObject<HTMLElement | null>;
  viewRef: RefObject<EditorView | null>;
  value: string;
  enabled: boolean;
  containerSelector: string;
  minHeightPx?: number;
}): { height: number; remeasure: () => void } {
  const {
    wrapRef,
    viewRef,
    value,
    enabled,
    containerSelector,
    minHeightPx = 80,
  } = options;

  const [editorHeight, setEditorHeight] = useState(() =>
    enabled ? minHeightPx : 0,
  );

  const remeasure = useCallback(() => {
    if (!enabled) return;
    const wrap = wrapRef.current;
    if (!wrap) return;

    const maxAvail = getMaxAvailableHeightPx(wrap, containerSelector, minHeightPx);
    const view = viewRef.current;
    const contentPx = view
      ? view.scrollDOM.scrollHeight
      : estimateHeightFromLines(value);
    setEditorHeight(clampEditorHeightPx(contentPx, maxAvail, minHeightPx));
  }, [enabled, wrapRef, viewRef, value, containerSelector, minHeightPx]);

  useEffect(() => {
    if (!enabled) return;
    const wrap = wrapRef.current;
    if (!wrap) return;

    remeasure();
    const ro = new ResizeObserver(() => remeasure());
    const container = wrap.closest(containerSelector);
    const splitPane = wrap.closest('.node-editor-split-pane');
    if (container) ro.observe(container);
    if (splitPane) ro.observe(splitPane);
    return () => ro.disconnect();
  }, [enabled, remeasure, value, containerSelector, wrapRef]);

  useEffect(() => {
    if (!enabled) return;
    requestAnimationFrame(() => remeasure());
  }, [value, enabled, remeasure]);

  return { height: editorHeight, remeasure };
}
