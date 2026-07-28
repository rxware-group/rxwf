import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type SelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  className?: string;
  /** Widen dropdown panel to fit option labels; trigger width unchanged. */
  panelFitContent?: boolean;
  'aria-label'?: string;
}

function measureSelectPanelWidth(
  trigger: HTMLElement,
  options: SelectOption[],
): number {
  const probe = document.createElement('span');
  const cs = getComputedStyle(trigger);
  probe.style.cssText = [
    'position:fixed',
    'visibility:hidden',
    'pointer-events:none',
    'white-space:nowrap',
    `font:${cs.font}`,
  ].join(';');
  let max = 0;
  for (const option of options) {
    const text = typeof option.label === 'string' ? option.label : '';
    if (!text) continue;
    probe.textContent = text;
    document.body.appendChild(probe);
    max = Math.max(max, probe.offsetWidth);
    document.body.removeChild(probe);
  }
  // Match .rxwf-select-option horizontal padding (0.65rem × 2) + small buffer.
  return max + 28;
}

export function Select({
  id,
  value,
  onChange,
  options,
  disabled = false,
  className,
  panelFitContent = false,
  'aria-label': ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const listId = useId().replace(/:/g, '');

  const enabledOptions = options.filter((option) => !option.disabled);
  const selected =
    options.find((option) => option.value === value) ??
    options.find((option) => option.value === '') ??
    options[0];

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const cs = getComputedStyle(trigger);
    const width = panelFitContent
      ? Math.max(rect.width, measureSelectPanelWidth(trigger, options))
      : rect.width;
    setPanelStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width,
      fontSize: cs.fontSize,
      fontFamily: cs.fontFamily,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
    });
  }, [options, panelFitContent]);

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const onScrollOrResize = () => updatePanelPosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setHighlightIndex(-1);
    }
  }, [open]);

  const choose = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        const selectedIndex = enabledOptions.findIndex((option) => option.value === value);
        setHighlightIndex(selectedIndex >= 0 ? selectedIndex : 0);
        return;
      }
    }

    if (!open) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightIndex((current) => (current + 1) % enabledOptions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightIndex((current) =>
        current <= 0 ? enabledOptions.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = enabledOptions[highlightIndex];
      if (option) {
        choose(option.value);
      }
    }
  };

  const rootClass = ['rxwf-select', className].filter(Boolean).join(' ');

  const panel =
    open && typeof document !== 'undefined'
      ? createPortal(
          <ul
            ref={panelRef}
            id={listId}
            className={[
              'rxwf-select-panel',
              'rxwf-select-panel--portal',
              panelFitContent ? 'rxwf-select-panel--fit-content' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="listbox"
            style={panelStyle}
          >
            {options.map((option, index) => {
              const enabledIndex = enabledOptions.indexOf(option);
              const isHighlighted = enabledIndex >= 0 && enabledIndex === highlightIndex;

              return (
                <li key={`${option.value}-${index}`} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    className={[
                      'rxwf-select-option',
                      option.value === value ? 'is-selected' : '',
                      isHighlighted ? 'is-highlighted' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={option.disabled}
                    onMouseEnter={() => {
                      if (enabledIndex >= 0) {
                        setHighlightIndex(enabledIndex);
                      }
                    }}
                    onClick={() => {
                      if (!option.disabled) {
                        choose(option.value);
                      }
                    }}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={wrapRef} className={rootClass}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className="rxwf-select-trigger"
        disabled={disabled || options.length === 0}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled || options.length === 0) return;
          setOpen((current) => !current);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="rxwf-select-trigger-text">{selected?.label ?? ''}</span>
        <span className="rxwf-select-chevron" aria-hidden />
      </button>
      {panel}
    </div>
  );
}
