import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  rxwfParamCodemirrorBasicSetup,
  rxwfParamCodemirrorShellExtensions,
} from './param-codemirror-theme.js';

export function HtmlDataViewer({ value }: { value: string }) {
  const extensions = useMemo(
    () => [
      ...rxwfParamCodemirrorShellExtensions,
      html(),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
    ],
    [],
  );

  return (
    <div className="rxwf-param-codemirror rxwf-html-data-viewer">
      <CodeMirror
        value={value}
        height="100%"
        theme="none"
        extensions={extensions}
        editable={false}
        basicSetup={{
          ...rxwfParamCodemirrorBasicSetup,
          closeBrackets: false,
          indentOnInput: false,
        }}
      />
    </div>
  );
}
