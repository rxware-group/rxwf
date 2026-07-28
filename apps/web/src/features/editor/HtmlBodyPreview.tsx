import { useEffect, useRef } from 'react';
import { t, useLabels } from '../../i18n/labels.js';

export function HtmlBodyPreview({ html }: { html: string }) {
  const labels = useLabels();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    iframe.src = url;
    return () => {
      URL.revokeObjectURL(url);
      iframe.removeAttribute('src');
    };
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      className="http-output-html-preview-frame"
      title={t(labels, 'editor.http.outputBodyPreview')}
      sandbox="allow-same-origin allow-popups"
    />
  );
}
