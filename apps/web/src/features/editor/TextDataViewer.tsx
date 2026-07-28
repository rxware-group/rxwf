import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  rxwfParamCodemirrorBasicSetup,
  rxwfParamCodemirrorShellExtensions,
} from './param-codemirror-theme.js';

export function TextDataViewer({ value }: { value: string }) {
  const extensions = useMemo(
    () => [EditorState.readOnly.of(true), EditorView.editable.of(false)],
    [],
  );

  return (
    <div className="rxwf-param-codemirror rxwf-text-data-viewer">
      <CodeMirror
        value={value}
        height="100%"
        theme="none"
        extensions={[...rxwfParamCodemirrorShellExtensions, ...extensions]}
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
