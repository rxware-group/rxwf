import type { EditorState, Extension } from '@codemirror/state';
import type { ViewUpdate } from '@codemirror/view';
import { Decoration, type DecorationSet, EditorView, ViewPlugin } from '@codemirror/view';

const activeLineTextMark = Decoration.mark({ class: 'cm-json-activeLineText' });
const selectionTextMark = Decoration.mark({ class: 'cm-json-selectionText' });

/** Highlight from first non-whitespace char through last non-whitespace char on a line. */
export function activeLineTextRange(lineText: string): { start: number; end: number } | null {
  const start = lineText.search(/\S/);
  if (start < 0) return null;
  const end = lineText.trimEnd().length;
  if (start >= end) return null;
  return { start, end };
}

/** Trim a document selection segment on one line to its text content (excludes indent / trailing blank). */
export function trimRangeToLineText(
  lineText: string,
  lineFrom: number,
  selFrom: number,
  selTo: number,
): { from: number; to: number } | null {
  const textRange = activeLineTextRange(lineText);
  if (!textRange) return null;
  const textFrom = lineFrom + textRange.start;
  const textTo = lineFrom + textRange.end;
  const from = Math.max(selFrom, textFrom);
  const to = Math.min(selTo, textTo);
  if (from >= to) return null;
  return { from, to };
}

function buildTrimmedSelectionDecorations(state: EditorState): DecorationSet {
  const marks: ReturnType<typeof activeLineTextMark.range>[] = [];

  for (const range of state.selection.ranges) {
    if (range.empty) continue;

    let pos = range.from;
    while (pos < range.to) {
      const line = state.doc.lineAt(pos);
      const trimmed = trimRangeToLineText(
        line.text,
        line.from,
        Math.max(range.from, line.from),
        Math.min(range.to, line.to),
      );
      if (trimmed) {
        marks.push(selectionTextMark.range(trimmed.from, trimmed.to));
      }
      pos = line.to + 1;
    }
  }

  return marks.length ? Decoration.set(marks) : Decoration.none;
}

function buildActiveLineTextDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const main = state.selection.main;
  if (!main.empty) return Decoration.none;

  const line = state.doc.lineAt(main.head);
  const range = activeLineTextRange(line.text);
  if (!range) return Decoration.none;

  return Decoration.set([
    activeLineTextMark.range(line.from + range.start, line.from + range.end),
  ]);
}

function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  if (!state.selection.ranges.every((range) => range.empty)) {
    return buildTrimmedSelectionDecorations(state);
  }
  return buildActiveLineTextDecorations(view);
}

/** Hide CodeMirror drawSelection full-width layer; use text-range marks instead. */
export const jsonViewerHideDefaultSelection = EditorView.theme({
  '.cm-selectionBackground': { display: 'none !important' },
});

export function jsonViewerTextRangeHighlight(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.selectionSet || update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

/** @deprecated Use jsonViewerTextRangeHighlight */
export const jsonViewerActiveLineTextHighlight = jsonViewerTextRangeHighlight;
