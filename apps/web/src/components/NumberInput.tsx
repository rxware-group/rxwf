import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';

const PARTIAL_NUMBER = /^-?\d*\.?\d*$/;

function parseNumber(value: string): number | null {
  if (value === '' || value === '-' || value === '.' || value === '-.') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPartialNumberDraft(value: string): boolean {
  return value === '' || value === '-' || value === '.' || value === '-.';
}

function clamp(value: number, min?: number, max?: number): number {
  let next = value;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return next;
}

function StepIcon({ direction }: { direction: 'up' | 'down' }) {
  const path = direction === 'up' ? 'M4.5 9.5L8 5.5L11.5 9.5' : 'M4.5 6.5L8 10.5L11.5 6.5';
  return (
    <svg className="rxwf-number-input-step-icon" viewBox="0 0 16 16" width="9" height="9" aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface NumberInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  step?: number;
  min?: number;
  max?: number;
  'aria-label'?: string;
  stepUpAriaLabel?: string;
  stepDownAriaLabel?: string;
}

export function NumberInput({
  id,
  value,
  onChange,
  disabled = false,
  placeholder,
  className,
  step = 1,
  min,
  max,
  'aria-label': ariaLabel,
  stepUpAriaLabel = '增加',
  stepDownAriaLabel = '减少',
}: NumberInputProps) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(value);
    }
  }, [value, focused]);

  const commitDraft = useCallback(
    (next: string) => {
      setDraft(next);
      if (next === '') {
        onChange('');
        return;
      }
      const parsed = parseNumber(next);
      if (parsed !== null) {
        onChange(String(parsed));
      }
    },
    [onChange],
  );

  const applyStep = useCallback(
    (delta: number) => {
      if (disabled) return;
      const current = parseNumber(focused ? draft : value);
      const base = current ?? (min !== undefined && min > 0 ? min : 0);
      const next = clamp(base + delta, min, max);
      const nextText = String(next);
      setDraft(nextText);
      onChange(nextText);
    },
    [disabled, draft, focused, max, min, onChange, value],
  );

  const onFieldChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    if (next !== '' && !PARTIAL_NUMBER.test(next)) return;
    setDraft(next);
    if (next === '' || parseNumber(next) !== null) {
      commitDraft(next);
    }
  };

  const onFieldBlur = (event: FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    const next = event.target.value;
    if (next === '' || parseNumber(next) !== null) {
      commitDraft(next);
      return;
    }
    if (isPartialNumberDraft(next)) {
      setDraft(value);
    }
  };

  const onFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      applyStep(step);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      applyStep(-step);
    }
  };

  const rootClass = ['rxwf-number-input', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        className="rxwf-number-input-field"
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={onFieldChange}
        onFocus={() => setFocused(true)}
        onBlur={onFieldBlur}
        onKeyDown={onFieldKeyDown}
      />
      <div className="rxwf-number-input-stepper">
        <button
          type="button"
          className="rxwf-number-input-step rxwf-number-input-step--up"
          disabled={disabled}
          tabIndex={-1}
          aria-label={stepUpAriaLabel}
          onClick={() => applyStep(step)}
        >
          <StepIcon direction="up" />
        </button>
        <button
          type="button"
          className="rxwf-number-input-step rxwf-number-input-step--down"
          disabled={disabled}
          tabIndex={-1}
          aria-label={stepDownAriaLabel}
          onClick={() => applyStep(-step)}
        >
          <StepIcon direction="down" />
        </button>
      </div>
    </div>
  );
}
