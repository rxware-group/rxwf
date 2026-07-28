import { describe, expect, it } from 'vitest';
import { mergeBuiltinTools } from './builtin-tools.js';

describe('mergeBuiltinTools', () => {
  it('includes read and grep when filesystem:read', () => {
    const tools = mergeBuiltinTools({
      permissions: ['filesystem:read'],
      mode: 'from-skill-permissions',
    });
    expect(tools.map((t) => t.name)).toEqual(expect.arrayContaining(['read_file', 'grep']));
    expect(tools.map((t) => t.name)).not.toContain('run_terminal_cmd');
  });

  it('includes web_search only with network', () => {
    const withNet = mergeBuiltinTools({
      permissions: ['network'],
      mode: 'from-skill-permissions',
      webSearchEnabled: true,
    });
    expect(withNet.map((t) => t.name)).toContain('web_search');

    const without = mergeBuiltinTools({
      permissions: ['filesystem:read'],
      mode: 'from-skill-permissions',
      webSearchEnabled: true,
    });
    expect(without.map((t) => t.name)).not.toContain('web_search');
  });
});
