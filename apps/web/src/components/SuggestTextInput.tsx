import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

export function SuggestTextInput({
  value,
  onChange,
  disabled,
  placeholder,
  filterSuggestions,
  minPanelWidth = 220,
  className,
  inputClassName = 'http-kv-input',
  suggestionsEnabled = true,
  onDragOver,
  onDrop,
  inputRef: inputRefProp,
  onInputFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  filterSuggestions: (query: string) => string[];
  minPanelWidth?: number;
  className?: string;
  inputClassName?: string;
  suggestionsEnabled?: boolean;
  onDragOver?: (event: DragEvent<HTMLInputElement>) => void;
  onDrop?: (event: DragEvent<HTMLInputElement>) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  onInputFocus?: () => void;
}) {
  const inputRefLocal = useRef<HTMLInputElement>(null);
  const inputRef = inputRefProp ?? inputRefLocal;
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const listId = useId().replace(/:/g, '');
  const suggestions = suggestionsEnabled ? filterSuggestions(value) : [];
  const showSuggestions = open && suggestions.length > 0 && !disabled && suggestionsEnabled;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [value]);

  const pick = useCallback(
    (option: string) => {
      onChange(option);
      setOpen(false);
      inputRef.current?.focus();
    },
    [onChange],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && suggestions[highlight]) {
      e.preventDefault();
      pick(suggestions[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const rect = inputRef.current?.getBoundingClientRect();
  const panel =
    showSuggestions && rect
      ? createPortal(
          <ul
            ref={panelRef}
            id={listId}
            className="http-kv-suggest-panel"
            role="listbox"
            style={{
              top: rect.bottom + 2,
              left: rect.left,
              width: Math.max(rect.width, minPanelWidth),
            }}
          >
            {suggestions.map((option, idx) => (
              <li
                key={option}
                role="option"
                aria-selected={idx === highlight}
                className={idx === highlight ? 'is-highlighted' : undefined}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(option);
                }}
              >
                {option}
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div className={['http-kv-key-wrap', className].filter(Boolean).join(' ')} ref={wrapRef}>
      <input
        ref={inputRef}
        type="text"
        className={inputClassName}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        spellCheck={false}
        aria-autocomplete="list"
        aria-controls={showSuggestions ? listId : undefined}
        aria-expanded={showSuggestions}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          onInputFocus?.();
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onDragOver={onDragOver}
        onDrop={onDrop}
      />
      {panel}
    </div>
  );
}
