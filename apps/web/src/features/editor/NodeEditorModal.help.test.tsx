import { describe, expect, it } from 'vitest';
import { HELP_DOC_NODE_TYPES } from '../help/help-doc-node-types.js';
import { buildHelpUrl } from './build-help-url.js';

describe('NodeEditorModal help URL', () => {
  it('opens node-specific help for every mapped nodeType', () => {
    for (const nodeType of HELP_DOC_NODE_TYPES) {
      expect(buildHelpUrl({ nodeType, origin: 'http://localhost:5173' })).toBe(
        `http://localhost:5173/help/nodes/${nodeType}`,
      );
    }
  });

  it('falls back to help home for unmapped node types', () => {
    expect(buildHelpUrl({ nodeType: 'stickyNote', origin: 'http://localhost:5173' })).toBe(
      'http://localhost:5173/help',
    );
  });
});
