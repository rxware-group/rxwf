import { Compartment } from '@codemirror/state';
import { useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  rxwfParamCodemirrorBasicSetup,
  rxwfJsonDataViewerShellExtensions,
} from './param-codemirror-theme.js';
import { useCodemirrorContentHeight } from './codemirror-content-height.js';
import { jsonSearchHighlightExtension } from './json-search-highlight.js';

export function formatJsonData(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export type JsonDataViewerHeightMode = 'fill' | 'content';

export function JsonDataViewer({
  value,
  searchQuery = '',
  heightMode = 'fill',
}: {
  value: string;
  searchQuery?: string;
  heightMode?: JsonDataViewerHeightMode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const searchHighlight = useMemo(() => new Compartment(), []);
  const { height: contentHeight, remeasure } = useCodemirrorContentHeight({
    wrapRef,
    viewRef,
    value,
    enabled: heightMode === 'content',
    containerSelector: '.node-editor-pane-body',
  });

  const extensions = useMemo(
    () => [
      ...rxwfJsonDataViewerShellExtensions,
      json(),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      searchHighlight.of(jsonSearchHighlightExtension('')),
    ],
    [searchHighlight],
  );

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: searchHighlight.reconfigure(jsonSearchHighlightExtension(searchQuery)),
    });
  }, [searchHighlight, searchQuery]);

  const rootClass = [
    'rxwf-param-codemirror',
    'rxwf-json-data-viewer',
    heightMode === 'content' ? 'rxwf-param-codemirror--content' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const cmHeight =
    heightMode === 'content' ? `${contentHeight}px` : '100%';

  const wrapStyle =
    heightMode === 'content' ? { height: contentHeight } : undefined;

  return (
    <div ref={wrapRef} className={rootClass} style={wrapStyle}>
      <CodeMirror
        value={value}
        height={cmHeight}
        theme="none"
        extensions={extensions}
        editable={false}
        onCreateEditor={(view) => {
          viewRef.current = view;
          if (heightMode === 'content') {
            requestAnimationFrame(() => remeasure());
          }
        }}
        basicSetup={{
          ...rxwfParamCodemirrorBasicSetup,
          drawSelection: false,
          closeBrackets: false,
          indentOnInput: false,
        }}
      />
    </div>
  );
}
