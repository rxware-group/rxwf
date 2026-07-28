import { useCallback, useMemo, useRef } from 'react';
import { SuggestTextInput } from '../../components/SuggestTextInput.js';
import { FormField } from '../../components/FormField.js';
import { insertAtCaret, useExpressionDropHandlers } from './use-expression-drop-target.js';
import { useOllamaModelNames } from './use-ollama-model-names.js';

function filterOllamaModels(models: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return models;
  return models.filter((name) => name.toLowerCase().includes(q));
}

export function OllamaModelParamField({
  label,
  value,
  baseUrl,
  placeholder,
  liveOnly,
  fetchOnFocus,
  onValueChange,
}: {
  label: string;
  value: string;
  baseUrl?: string;
  placeholder?: string;
  liveOnly?: boolean;
  fetchOnFocus?: boolean;
  onValueChange: (value: string) => void;
}) {
  const { models, loading, ensureLoaded } = useOllamaModelNames(baseUrl, {
    liveOnly,
    fetchOnFocus,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const { onDragOver, onDrop } = useExpressionDropHandlers(
    (text, caret) => {
      onValueChange(insertAtCaret(value, text, caret));
    },
    () => inputRef.current?.selectionStart ?? value.length,
  );

  const filterSuggestions = useCallback(
    (query: string) => filterOllamaModels(models, query),
    [models],
  );

  const suggestionsEnabled = useMemo(
    () => !loading && models.length > 0 && !value.includes('{{'),
    [loading, models.length, value],
  );

  return (
    <FormField label={label}>
      <div className="ollama-model-param-field">
        <SuggestTextInput
          inputRef={inputRef}
          value={value}
          onChange={onValueChange}
          disabled={loading && models.length === 0}
          placeholder={placeholder ?? '{{ $json.id }}'}
          filterSuggestions={filterSuggestions}
          suggestionsEnabled={suggestionsEnabled}
          className="ollama-model-param-field__input"
          onDragOver={onDragOver}
          onDrop={onDrop}
          onInputFocus={() => {
            if (fetchOnFocus) ensureLoaded();
          }}
        />
      </div>
    </FormField>
  );
}
