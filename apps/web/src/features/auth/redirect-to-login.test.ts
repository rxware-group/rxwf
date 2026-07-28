import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './redirect-to-login.js';

describe('safeRedirectPath', () => {
  it('allows in-app paths', () => {
    expect(safeRedirectPath('/help/nodes/code')).toBe('/help/nodes/code');
  });

  it('rejects external and protocol-relative URLs', () => {
    expect(safeRedirectPath('https://evil.test')).toBe('/');
    expect(safeRedirectPath('//evil.test')).toBe('/');
    expect(safeRedirectPath(null)).toBe('/');
  });
});
