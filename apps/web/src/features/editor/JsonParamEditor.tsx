import { useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import type { EditorView } from '@codemirror/view';
import {
  rxwfParamCodemirrorBasicSetup,
  rxwfParamCodemirrorShellExtensions,
} from './param-codemirror-theme.js';
import { ExpressionDropShell } from './ExpressionDropShell.js';

export function JsonParamEditor({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const viewRef = useRef<EditorView | null>(null);
  const extensions = useMemo(
    () => [...rxwfParamCodemirrorShellExtensions, json()],
    [],
  );

  return (
    <ExpressionDropShell
      className="rxwf-param-codemirror"
      value={value}
      onInsert={onChange}
      getCaret={() => viewRef.current?.state.selection.main.head ?? value.length}
    >
      <CodeMirror
        value={value}
        height="100%"
        placeholder={placeholder}
        theme="none"
        extensions={extensions}
        onChange={onChange}
        onCreateEditor={(view) => {
          viewRef.current = view;
        }}
        basicSetup={rxwfParamCodemirrorBasicSetup}
      />
    </ExpressionDropShell>
  );
}
