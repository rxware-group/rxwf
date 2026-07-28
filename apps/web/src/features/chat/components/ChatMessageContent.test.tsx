import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ChatMessageContent } from './ChatMessageContent.js';

describe('ChatMessageContent', () => {
  it('renders assistant markdown with headings and emphasis', () => {
    const html = renderToStaticMarkup(
      createElement(ChatMessageContent, {
        role: 'assistant',
        content: '### **总结**\n\n1. **安装**\n2. **创建流**',
      }),
    );
    expect(html).toContain('<h3>');
    expect(html).toContain('<strong>总结</strong>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<strong>安装</strong>');
    expect(html).not.toContain('**总结**');
  });

  it('keeps user messages as plain text', () => {
    const html = renderToStaticMarkup(
      createElement(ChatMessageContent, {
        role: 'user',
        content: '**not bold**',
      }),
    );
    expect(html).toContain('**not bold**');
    expect(html).not.toContain('<strong>');
  });

  it('renders HTML assistant messages when content is HTML', () => {
    const html = renderToStaticMarkup(
      createElement(ChatMessageContent, {
        role: 'assistant',
        content: '<p><strong>Hello</strong></p>',
      }),
    );
    expect(html).toContain('<strong>Hello</strong>');
  });
});
