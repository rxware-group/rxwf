import { useCallback, useState } from 'react';

const STORAGE_KEY = 'rxwf.editor.layout';

export interface EditorLayoutPrefs {
  logCollapsed: boolean;
  logHeightPx: number;
  paletteWidthPx: number;
  chatWidthPx: number;
  modalSplit: [number, number, number];
  logPanelSplit: LogPanelSplit;
}

export interface LogPanelSplit {
  listPct: number;
  inputPct: number;
  ioTopPct: number;
}

type EditorLayoutPrefsUpdate = Omit<Partial<EditorLayoutPrefs>, 'logPanelSplit'> & {
  logPanelSplit?: Partial<LogPanelSplit>;
};

const DEFAULT_LOG_PANEL_SPLIT: LogPanelSplit = {
  listPct: 22,
  inputPct: 50,
  ioTopPct: 60,
};

const DEFAULTS: EditorLayoutPrefs = {
  logCollapsed: false,
  logHeightPx: 180,
  paletteWidthPx: 200,
  chatWidthPx: 360,
  modalSplit: [1, 1, 1],
  logPanelSplit: DEFAULT_LOG_PANEL_SPLIT,
};

export const PALETTE_WIDTH_MIN = 200;
export const PALETTE_WIDTH_MAX = 1200;

export const CHAT_WIDTH_MIN = 280;
export const CHAT_WIDTH_MAX = 720;

export const LOG_HEIGHT_MIN = 80;
export const LOG_HEIGHT_MAX = 480;
/** Minimum canvas area when log panel is expanded */
export const LOG_GRID_MIN = 120;
/** Horizontal resize strip between canvas and log panel (px) */
export const LOG_STRIP_PX = 12;

export function clampLogHeight(height: number, workspaceHeight?: number): number {
  const safe = Number.isFinite(height) ? height : DEFAULTS.logHeightPx;
  let max = LOG_HEIGHT_MAX;
  if (
    workspaceHeight != null &&
    workspaceHeight > LOG_GRID_MIN + LOG_STRIP_PX + LOG_HEIGHT_MIN
  ) {
    max = Math.min(LOG_HEIGHT_MAX, workspaceHeight - LOG_GRID_MIN - LOG_STRIP_PX);
  }
  return Math.min(max, Math.max(LOG_HEIGHT_MIN, safe));
}

export function clampChatWidth(width: number, containerWidth?: number): number {
  const safe = Number.isFinite(width) ? width : DEFAULTS.chatWidthPx;
  const maxAllowed =
    containerWidth != null && containerWidth > 0
      ? Math.max(CHAT_WIDTH_MIN, Math.min(CHAT_WIDTH_MAX, containerWidth - 240))
      : CHAT_WIDTH_MAX;
  return Math.min(maxAllowed, Math.max(CHAT_WIDTH_MIN, safe));
}

export function clampPaletteWidth(width: number, containerWidth?: number): number {
  const safe = Number.isFinite(width) ? width : DEFAULTS.paletteWidthPx;
  const maxAllowed =
    containerWidth != null && containerWidth > 0
      ? Math.max(
          PALETTE_WIDTH_MIN,
          Math.min(PALETTE_WIDTH_MAX, containerWidth - 240),
        )
      : PALETTE_WIDTH_MAX;
  return Math.min(maxAllowed, Math.max(PALETTE_WIDTH_MIN, safe));
}

function loadPrefs(): EditorLayoutPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<EditorLayoutPrefs>;
    return {
      logCollapsed: parsed.logCollapsed ?? DEFAULTS.logCollapsed,
      logHeightPx: clampLogHeight(parsed.logHeightPx ?? DEFAULTS.logHeightPx),
      paletteWidthPx: clampPaletteWidth(
        parsed.paletteWidthPx ?? DEFAULTS.paletteWidthPx,
      ),
      chatWidthPx: clampChatWidth(parsed.chatWidthPx ?? DEFAULTS.chatWidthPx),
      modalSplit: parsed.modalSplit ?? DEFAULTS.modalSplit,
      logPanelSplit: {
        ...DEFAULT_LOG_PANEL_SPLIT,
        ...parsed.logPanelSplit,
      },
    };
  } catch {
    return DEFAULTS;
  }
}

function savePrefs(prefs: EditorLayoutPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function useEditorLayoutPrefs() {
  const [prefs, setPrefs] = useState<EditorLayoutPrefs>(loadPrefs);

  const update = useCallback((patch: EditorLayoutPrefsUpdate) => {
    setPrefs((prev) => {
      const next: EditorLayoutPrefs = {
        ...prev,
        ...patch,
        logPanelSplit: patch.logPanelSplit
          ? { ...prev.logPanelSplit, ...patch.logPanelSplit }
          : prev.logPanelSplit,
      };
      savePrefs(next);
      return next;
    });
  }, []);

  return { prefs, update };
}
