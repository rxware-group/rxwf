import { t } from '../chat-labels.js';
import type { ChatCitation } from '../chat-types.js';

interface CitationCardProps {
  citations: ChatCitation[];
  title?: string;
}

export function CitationCard({
  citations,
  title,
  labels = {},
}: CitationCardProps & { labels?: Record<string, string> }) {
  const resolvedTitle = title ?? t(labels, 'chat.citations.title');
  if (!citations.length) return null;

  return (
    <div className="chat-citations">
      <p className="chat-citations-title">{resolvedTitle}</p>
      <ul className="chat-citations-list">
        {citations.map((c, i) => (
          <li key={`${c.documentId}-${c.chunkIndex}-${i}`} className="chat-citation-item">
            <span className="chat-citation-meta">
              {c.documentName} · #{c.chunkIndex} · {(c.score * 100).toFixed(0)}%
            </span>
            <p className="chat-citation-excerpt">{c.excerpt}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
