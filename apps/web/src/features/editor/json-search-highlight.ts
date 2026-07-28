import { type Extension, RangeSetBuilder } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, ViewPlugin } from '@codemirror/view';

const searchMatchMark = Decoration.mark({ class: 'cm-json-search-match' });

function buildSearchDecorations(doc: string, query: string): DecorationSet {
  const needle = query.trim();
  if (!needle) {
    return Decoration.none;
  }
  const lowerNeedle = needle.toLowerCase();
  const lowerDoc = doc.toLowerCase();
  const builder = new RangeSetBuilder<Decoration>();
  let from = 0;
  while (from < doc.length) {
    const index = lowerDoc.indexOf(lowerNeedle, from);
    if (index < 0) break;
    builder.add(index, index + needle.length, searchMatchMark);
    from = index + needle.length;
  }
  return builder.finish();
}

export function jsonSearchHighlightExtension(query: string): Extension {
  const needle = query.trim();
  if (!needle) {
    return [];
  }

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildSearchDecorations(view.state.doc.toString(), needle);
      }

      update(update: { docChanged: boolean; view: EditorView }) {
        if (update.docChanged) {
          this.decorations = buildSearchDecorations(
            update.view.state.doc.toString(),
            needle,
          );
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
