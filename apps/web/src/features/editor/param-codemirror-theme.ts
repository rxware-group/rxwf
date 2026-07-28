import { foldGutter } from '@codemirror/language';
import { highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { vscodeDarkInit } from '@uiw/codemirror-theme-vscode';
import { jsonViewerHideDefaultSelection, jsonViewerTextRangeHighlight } from './json-viewer-active-line.js';

const FOLD_ICON_PX = 9;

function createFoldMarker(open: boolean): HTMLElement {
  const el = document.createElement('span');
  el.className = 'rxwf-param-fold-marker';
  el.setAttribute('aria-hidden', 'true');
  const path = open ? 'M4.5 6.5L8 10L11.5 6.5' : 'M6.5 4.5L10 8L6.5 11.5';
  el.innerHTML =
    `<svg class="rxwf-param-fold-marker-svg" viewBox="0 0 16 16" width="${FOLD_ICON_PX}" height="${FOLD_ICON_PX}">` +
    `<path d="${path}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return el;
}

const activeLineBg = 'var(--rxwf-surface-hover)';
const gutterBg = 'var(--rxwf-surface)';
const codeBg = 'var(--rxwf-surface-raised)';

export const rxwfParamEditorTheme = vscodeDarkInit({
  settings: {
    background: codeBg,
    gutterBackground: gutterBg,
    gutterForeground: 'var(--rxwf-text-muted)',
    gutterActiveForeground: 'var(--rxwf-fg)',
    lineHighlight: activeLineBg,
    caret: 'var(--rxwf-fg)',
  },
});

export const rxwfParamGutterTheme = EditorView.theme(
  {
    '&': {
      fontSize: '0.8125rem',
      fontFamily: "ui-monospace, 'Cascadia Code', Consolas, monospace",
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-scroller': {
      lineHeight: '1.5',
      backgroundColor: codeBg,
    },
    '.cm-gutters': {
      backgroundColor: gutterBg,
      color: 'var(--rxwf-text-muted)',
      borderRight: '1px solid var(--rxwf-border)',
      padding: '0 0 0 5px',
    },
    '.cm-gutter': {
      overflow: 'visible',
    },
    '.cm-gutterElement': {
      display: 'flex',
      alignItems: 'center',
      boxSizing: 'border-box',
    },
    '.cm-lineNumbers': {
      minWidth: '1rem',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      justifyContent: 'flex-end',
      width: '100%',
      minWidth: 'unset',
      padding: 0,
      textAlign: 'right',
      whiteSpace: 'nowrap',
    },
    '.cm-lineNumbers .cm-gutterElement.cm-activeLineGutter': {
      position: 'relative',
      zIndex: 1,
      backgroundColor: activeLineBg,
    },
    '.cm-foldGutter': {
      width: '0.875rem',
      minWidth: '0.875rem',
    },
    '.cm-foldGutter .cm-gutterElement': {
      justifyContent: 'center',
      width: '100%',
      padding: 0,
    },
    '.cm-foldGutter .cm-gutterElement.cm-activeLineGutter': {
      position: 'relative',
      zIndex: 1,
      backgroundColor: activeLineBg,
    },
    '.cm-foldGutter span, .rxwf-param-fold-marker': {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '0.875rem',
      height: '100%',
      padding: 0,
      lineHeight: 1,
      color: 'inherit',
      cursor: 'pointer',
    },
    '.cm-activeLineGutter': {
      backgroundColor: `${activeLineBg} !important`,
    },
    '.cm-activeLine': {
      backgroundColor: `${activeLineBg} !important`,
    },
  },
  { dark: true },
);

const rxwfParamCodemirrorShellCore: Extension[] = [
  rxwfParamEditorTheme,
  foldGutter({
    markerDOM: createFoldMarker,
  }),
  rxwfParamGutterTheme,
];

export const rxwfParamCodemirrorShellExtensions: Extension[] = [
  ...rxwfParamCodemirrorShellCore,
  highlightActiveLine(),
  highlightActiveLineGutter(),
];

/** JSON read-only viewer: gutter active line + text-range highlight (excludes indent). */
export const rxwfJsonDataViewerShellExtensions: Extension[] = [
  ...rxwfParamCodemirrorShellCore,
  highlightActiveLineGutter(),
  jsonViewerHideDefaultSelection,
  jsonViewerTextRangeHighlight(),
];

export const rxwfParamCodemirrorBasicSetup = {
  lineNumbers: true,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  foldGutter: false,
  bracketMatching: true,
  closeBrackets: true,
  indentOnInput: true,
  tabSize: 2,
} as const;
