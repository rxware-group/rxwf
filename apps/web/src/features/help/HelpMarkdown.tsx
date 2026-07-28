import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const helpLinkComponents: Components = {
  a: ({ href, children, ...props }) => {
    if (href?.startsWith('/help')) {
      return (
        <Link to={href} {...props}>
          {children}
        </Link>
      );
    }
    if (href?.startsWith('/')) {
      return (
        <a href={href} {...props}>
          {children}
        </a>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
};

export function HelpMarkdown({ content }: { content: string }) {
  return (
    <div className="help-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={helpLinkComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
