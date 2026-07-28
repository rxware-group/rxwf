import { describe, expect, it } from 'vitest';
import { HELP_DOC_NODE_TYPES } from './help-doc-node-types.js';
import { findHelpRegistryCompletenessErrors } from './help-registry-completeness.js';
import { NODE_HELP_PATH } from './help-registry.js';

describe('help registry completeness (NFR-06)', () => {
  it('aligns 45 nodeTypes across meta, registry paths, disk, and bundled docs', () => {
    expect(HELP_DOC_NODE_TYPES).toHaveLength(45);
    expect(Object.keys(NODE_HELP_PATH)).toHaveLength(45);
    expect(findHelpRegistryCompletenessErrors()).toEqual([]);
  });
});
