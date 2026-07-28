import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { WorkflowDefinition } from '../../api/client.js';

const MAX_HISTORY = 50;

type HistoryState = {
  past: WorkflowDefinition[];
  present: WorkflowDefinition;
  future: WorkflowDefinition[];
};

type HistoryAction =
  | {
      type: 'commit';
      updater: (prev: WorkflowDefinition) => WorkflowDefinition;
    }
  | {
      type: 'patch';
      updater: (prev: WorkflowDefinition) => WorkflowDefinition;
    }
  | { type: 'commitDebounced'; baseline: WorkflowDefinition }
  | { type: 'replace'; definition: WorkflowDefinition }
  | { type: 'undo' }
  | { type: 'redo' };

function cloneDefinition(d: WorkflowDefinition): WorkflowDefinition {
  return structuredClone(d);
}

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'commit': {
      const next = action.updater(state.present);
      const past = [...state.past, cloneDefinition(state.present)].slice(-MAX_HISTORY);
      return { past, present: next, future: [] };
    }
    case 'patch': {
      return { ...state, present: action.updater(state.present) };
    }
    case 'commitDebounced': {
      const past = [...state.past, cloneDefinition(action.baseline)].slice(-MAX_HISTORY);
      return { past, present: state.present, future: [] };
    }
    case 'replace':
      return { past: [], present: action.definition, future: [] };
    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1]!;
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [cloneDefinition(state.present), ...state.future],
      };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      const next = state.future[0]!;
      return {
        past: [...state.past, cloneDefinition(state.present)],
        present: next,
        future: state.future.slice(1),
      };
    }
    default:
      return state;
  }
}

export function useWorkflowHistory(
  initial: WorkflowDefinition,
  onNavigate?: () => void,
) {
  const [state, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initial,
    future: [],
  });

  const commitDefinition = useCallback(
    (updater: (prev: WorkflowDefinition) => WorkflowDefinition) => {
      dispatch({ type: 'commit', updater });
    },
    [],
  );

  const patchDefinition = useCallback(
    (updater: (prev: WorkflowDefinition) => WorkflowDefinition) => {
      dispatch({ type: 'patch', updater });
    },
    [],
  );

  const commitDebouncedSnapshot = useCallback((baseline: WorkflowDefinition) => {
    dispatch({ type: 'commitDebounced', baseline: cloneDefinition(baseline) });
  }, []);

  const replaceDefinition = useCallback((definition: WorkflowDefinition) => {
    dispatch({ type: 'replace', definition: cloneDefinition(definition) });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'undo' });
    onNavigate?.();
  }, [onNavigate]);

  const redo = useCallback(() => {
    dispatch({ type: 'redo' });
    onNavigate?.();
  }, [onNavigate]);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  return {
    definition: state.present,
    commitDefinition,
    patchDefinition,
    commitDebouncedSnapshot,
    replaceDefinition,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}

/** 属性面板参数编辑：UI 立即 patch，合并多次按键为一条撤销记录 */
export function useDebouncedCommit(
  patch: (updater: (prev: WorkflowDefinition) => WorkflowDefinition) => void,
  checkpoint: (baseline: WorkflowDefinition) => void,
  getPresent: () => WorkflowDefinition,
  delayMs = 450,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baselineRef = useRef<WorkflowDefinition | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (baselineRef.current) {
      checkpoint(baselineRef.current);
      baselineRef.current = null;
    }
  }, [checkpoint]);

  const debouncedCommit = useCallback(
    (updater: (prev: WorkflowDefinition) => WorkflowDefinition) => {
      if (!timerRef.current) {
        baselineRef.current = cloneDefinition(getPresent());
      }
      patch(updater);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (baselineRef.current) {
          checkpoint(baselineRef.current);
          baselineRef.current = null;
        }
      }, delayMs);
    },
    [patch, checkpoint, getPresent, delayMs],
  );

  useEffect(() => () => flush(), [flush]);

  return { debouncedCommit, flushPending: flush };
}

export function isEditorTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable)
  );
}

export function useEditorUndoRedoShortcuts(
  undo: () => void,
  redo: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditorTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, enabled]);
}

export function useDeleteSelectedNodeShortcut(
  selectedNodeId: string | null,
  onDelete: (nodeId: string) => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditorTypingTarget(e.target)) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (!selectedNodeId) return;
      e.preventDefault();
      onDelete(selectedNodeId);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNodeId, onDelete, enabled]);
}
