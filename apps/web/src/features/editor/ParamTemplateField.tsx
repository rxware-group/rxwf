import { useRef } from 'react';
import { FormField } from '../../components/FormField.js';
import { useExpressionDropHandlers, insertAtCaret } from './use-expression-drop-target.js';

export function ParamTemplateField({
  label,
  value,
  multiline,
  placeholder,
  className,
  onValueChange,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  onValueChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const rows = multiline ? 4 : 2;

  const { onDragOver, onDrop } = useExpressionDropHandlers(
    (text, caret) => {
      onValueChange(insertAtCaret(value, text, caret));
    },
    () => inputRef.current?.selectionStart ?? value.length,
  );

  return (
    <FormField label={label} className={className}>
      <textarea
        ref={inputRef}
        className="param-field-mode-editor param-template-field"
        rows={rows}
        spellCheck={false}
        placeholder={placeholder ?? '{{ $json.id }}'}
        value={value}
        onChange={(ev) => onValueChange(ev.target.value)}
        onDragOver={onDragOver}
        onDrop={onDrop}
      />
    </FormField>
  );
}
