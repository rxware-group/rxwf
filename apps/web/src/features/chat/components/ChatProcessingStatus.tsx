import type { ChatProcessingPhase } from '../../../api/client.js';
import { t } from '../chat-labels.js';

const STATUS_LABEL_KEY: Record<ChatProcessingPhase, string> = {
  rag_search: 'chat.status.rag_search',
  rag_fallback: 'chat.status.rag_fallback',
  thinking: 'chat.status.thinking',
};

export function ChatProcessingStatus({
  phase,
  labels,
}: {
  phase: ChatProcessingPhase;
  labels?: Record<string, string>;
}) {
  return (
    <div className="chat-processing-status" role="status" aria-live="polite">
      <span className="chat-processing-status-dot" aria-hidden />
      <span>{t(labels, STATUS_LABEL_KEY[phase])}</span>
    </div>
  );
}
