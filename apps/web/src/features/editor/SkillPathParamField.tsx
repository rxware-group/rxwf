import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { SuggestTextInput } from '../../components/SuggestTextInput.js';
import { FormField } from '../../components/FormField.js';
import { insertAtCaret, useExpressionDropHandlers } from './use-expression-drop-target.js';

function filterSkillNames(names: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return names;
  return names.filter((name) => name.toLowerCase().includes(q));
}

export function SkillPathParamField({
  label,
  value,
  workspaceRoot,
  placeholder,
  onValueChange,
}: {
  label: string;
  value: string;
  workspaceRoot?: string;
  placeholder?: string;
  onValueChange: (value: string) => void;
}) {
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const root = workspaceRoot?.trim() || undefined;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api.skills
      .scan({ workspaceRoot: root })
      .then((res) => {
        if (cancelled) return;
        setNames(res.items.map((item) => item.name || item.skillRelPath).filter(Boolean));
      })
      .catch(() => {
        if (!cancelled) setNames([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [root]);

  const { onDragOver, onDrop } = useExpressionDropHandlers(
    (text, caret) => {
      onValueChange(insertAtCaret(value, text, caret));
    },
    () => inputRef.current?.selectionStart ?? value.length,
  );

  const filterSuggestions = useCallback(
    (query: string) => filterSkillNames(names, query),
    [names],
  );

  const suggestionsEnabled = useMemo(
    () => !loading && names.length > 0 && !value.includes('{{'),
    [loading, names.length, value],
  );

  return (
    <FormField label={label}>
      <div className="skill-path-param-field">
        <SuggestTextInput
          inputRef={inputRef}
          value={value}
          onChange={onValueChange}
          disabled={loading && names.length === 0}
          placeholder={placeholder ?? 'sample-skill'}
          filterSuggestions={filterSuggestions}
          suggestionsEnabled={suggestionsEnabled}
          className="skill-path-param-field__input"
          onDragOver={onDragOver}
          onDrop={onDrop}
        />
      </div>
    </FormField>
  );
}
