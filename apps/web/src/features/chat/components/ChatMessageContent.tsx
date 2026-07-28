import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

const markdownSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), 'className'],
    span: [...(defaultSchema.attributes?.span ?? []), 'className'],
  },
};

function isProbablyHtml(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.startsWith('<')) return false;
  return /<\/[a-z][\s\S]*>/i.test(trimmed);
}

interface ChatMessageContentProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  streaming?: boolean;
}

export function ChatMessageContent({ role, content, streaming }: ChatMessageContentProps) {
  const text = content ?? '';

  if (role === 'user') {
    return <span className="chat-plain-text">{text}</span>;
  }

  return (
    <div className="chat-markdown">
      {isProbablyHtml(text) ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]]}
        >
          {text}
        </ReactMarkdown>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      )}
      {streaming && <span className="chat-stream-cursor" aria-hidden>|</span>}
    </div>
  );
}
