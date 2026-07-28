import { describe, expect, it } from 'vitest';
import { formatPathOutsideScanRootsMessage } from './scan-roots-errors.js';

describe('formatPathOutsideScanRootsMessage', () => {
  it('lists all scanRoots and requested path', () => {
    expect(
      formatPathOutsideScanRootsMessage(['D:\\proj', '/tmp/ws'], { path: 'C:\\outside.txt' }),
    ).toBe(
      'Path outside scanRoots. Allowed roots: D:\\proj; /tmp/ws. Path: C:\\outside.txt',
    );
  });

  it('shows none configured when scanRoots is empty', () => {
    expect(formatPathOutsideScanRootsMessage([])).toBe(
      'Path outside scanRoots. Allowed roots: (none configured)',
    );
  });

  it('includes cwd for shell errors', () => {
    expect(
      formatPathOutsideScanRootsMessage(['/workspace'], { cwd: '/etc' }),
    ).toContain('Allowed roots: /workspace');
  });
});
