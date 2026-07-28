import { describe, expect, it } from 'vitest';
import { HELP_DOC_NODE_TYPES } from './help-doc-node-types.js';
import { buildHelpUrl, NODE_HELP_PATH } from './help-registry.js';

describe('help-registry', () => {
  it('maps all 45 help doc node types to /help/nodes/<type>', () => {
    expect(HELP_DOC_NODE_TYPES).toHaveLength(45);
    expect(Object.keys(NODE_HELP_PATH)).toHaveLength(45);
    for (const nodeType of HELP_DOC_NODE_TYPES) {
      expect(NODE_HELP_PATH[nodeType]).toBe(`/help/nodes/${nodeType}`);
    }
  });

  it('buildHelpUrl resolves mapped node types', () => {
    expect(buildHelpUrl({ nodeType: 'code', origin: 'http://localhost:5173' })).toBe(
      'http://localhost:5173/help/nodes/code',
    );
    expect(buildHelpUrl({ nodeType: 'httpRequest', origin: 'http://localhost:5173' })).toBe(
      'http://localhost:5173/help/nodes/httpRequest',
    );
    expect(buildHelpUrl({ nodeType: 'workflow_run', origin: 'http://localhost:5173' })).toBe(
      'http://localhost:5173/help/nodes/workflow_run',
    );
  });

  it('falls back to help home for unknown node types', () => {
    expect(buildHelpUrl({ nodeType: 'unknown', origin: 'http://localhost:5173' })).toBe(
      'http://localhost:5173/help',
    );
    expect(buildHelpUrl({ nodeType: 'skillRun', origin: 'http://localhost:5173' })).toBe(
      'http://localhost:5173/help',
    );
  });

  it('supports explicit path and hash', () => {
    expect(
      buildHelpUrl({
        path: '/help/expressions',
        hash: 'templates',
        origin: 'http://localhost:5173',
      }),
    ).toBe('http://localhost:5173/help/expressions#templates');
  });
});
