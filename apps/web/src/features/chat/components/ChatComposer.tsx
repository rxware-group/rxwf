import { useCallback, useRef, type KeyboardEvent } from 'react';
import { t } from '../chat-labels.js';

interface ChatComposerProps {
  disabled?: boolean;
  isStreaming: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
  labels?: Record<string, string>;
}

export function ChatComposer({ disabled, isStreaming, onSend, onStop, labels }: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const content = el.value.trim();
    if (!content || disabled || isStreaming) return;
    onSend(content);
    el.value = '';
    el.style.height = 'auto';
  }, [disabled, isStreaming, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  return (
    <div className="chat-composer">
      <textarea
        ref={textareaRef}
        className="chat-composer-input"
        placeholder={t(labels, 'chat.placeholder')}
        rows={1}
        disabled={disabled || isStreaming}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
      />
      <div className="chat-composer-actions">
        {isStreaming ? (
          <button type="button" className="btn-secondary" onClick={onStop}>
            {t(labels, 'chat.stop')}
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            disabled={disabled}
            onClick={submit}
          >
            {t(labels, 'chat.send')}
          </button>
        )}
      </div>
    </div>
  );
}
