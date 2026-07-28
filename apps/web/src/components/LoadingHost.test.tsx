import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { LoadingHost } from './LoadingHost.js';

describe('LoadingHost', () => {
  it('renders overlay with aria-busy when loading', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        <LoadingHost loading label="Loading">
          <p>Content</p>
        </LoadingHost>,
      );
    });

    const loadingHost = document.body.querySelector('.loading-host');
    expect(loadingHost?.getAttribute('aria-busy')).toBe('true');
    expect(document.body.querySelector('.loading-overlay')).toBeTruthy();
    expect(document.body.querySelector('.loading-spinner')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Loading/);
    expect(document.body.textContent).toContain('Content');

    root.unmount();
    host.remove();
  });

  it('does not render overlay when idle', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        <LoadingHost loading={false}>
          <p>Ready</p>
        </LoadingHost>,
      );
    });

    expect(document.body.querySelector('.loading-overlay')).toBeFalsy();
    expect(document.body.querySelector('.loading-host')?.getAttribute('aria-busy')).toBeNull();

    root.unmount();
    host.remove();
  });
});
