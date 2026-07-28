import { useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import {
  autocompletion,
  type Completion,
  type CompletionContext,
} from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';
import {
  rxwfParamCodemirrorBasicSetup,
  rxwfParamCodemirrorShellExtensions,
} from './param-codemirror-theme.js';
import { useCodemirrorContentHeight } from './codemirror-content-height.js';
import { ExpressionDropShell } from './ExpressionDropShell.js';

const SANDBOX_COMPLETIONS: Completion[] = [
  { label: '$input', type: 'variable', detail: '完整输入 items 数组' },
  { label: '$env', type: 'variable', detail: '环境变量' },
  { label: '$vars', type: 'variable', detail: '工作流变量' },
  { label: '$nodes', type: 'variable', detail: '前序节点输出数组' },
  { label: '$now', type: 'variable', detail: '当前时间 ISO' },
  { label: '$today', type: 'variable', detail: '今日 00:00 ISO' },
  { label: '$log', type: 'variable', detail: '调试日志' },
  { label: '$log.debug', type: 'function', detail: '(message)' },
  { label: '$log.info', type: 'function', detail: '(message)' },
  { label: '$log.warn', type: 'function', detail: '(message)' },
  { label: '$log.error', type: 'function', detail: '(message)' },
  { label: 'return', type: 'keyword' },
];

function sandboxCompletions(context: CompletionContext) {
  const word = context.matchBefore(/[$.\w]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const filtered = SANDBOX_COMPLETIONS.filter((c) =>
    c.label.startsWith(word.text),
  );
  if (filtered.length === 0 && !context.explicit) return null;
  return {
    from: word.from,
    options: filtered.length > 0 ? filtered : SANDBOX_COMPLETIONS,
  };
}

export function CodeJsEditor({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { height: editorHeight, remeasure } = useCodemirrorContentHeight({
    wrapRef,
    viewRef,
    value,
    enabled: true,
    containerSelector: '.node-editor-pane-body',
  });

  const extensions = useMemo(
    () => [
      ...rxwfParamCodemirrorShellExtensions,
      javascript(),
      autocompletion({ override: [sandboxCompletions] }),
    ],
    [],
  );

  return (
    <ExpressionDropShell
      containerRef={wrapRef}
      className="rxwf-param-codemirror rxwf-param-codemirror--content"
      style={{ height: editorHeight }}
      value={value}
      onInsert={onChange}
      getCaret={() => viewRef.current?.state.selection.main.head ?? value.length}
      insertFormat="js"
    >
      <CodeMirror
        value={value}
        height={`${editorHeight}px`}
        placeholder={placeholder}
        theme="none"
        extensions={extensions}
        onChange={onChange}
        onCreateEditor={(view) => {
          viewRef.current = view;
          requestAnimationFrame(() => remeasure());
        }}
        basicSetup={{
          ...rxwfParamCodemirrorBasicSetup,
          autocompletion: true,
        }}
      />
    </ExpressionDropShell>
  );
}
