import { describe, expect, it } from 'vitest';
import { HELP_DOC_NODE_TYPES } from './help-doc-node-types.js';
import {
  buildNodeHelpNavItems,
  buildSettingsHelpNavItems,
  findHelpNavRegistryMismatches,
  flattenHelpNav,
  helpNavItemContainsSlug,
  HELP_NAV,
} from './help-nav.js';

describe('HELP_NAV', () => {
  it('groups editor and node docs into a tree', () => {
    expect(HELP_NAV.map((item) => item.titleKey)).toEqual([
      'help.nav.home',
      'help.nav.expressions',
      'help.nav.editor',
      'help.nav.nodes',
      'help.nav.settings',
    ]);
    expect(HELP_NAV[2]?.children?.map((item) => item.slug)).toEqual(['editor/input-panel']);
    expect(buildNodeHelpNavItems()).toHaveLength(45);
    expect(HELP_NAV[3]?.children).toHaveLength(45);
    expect(buildSettingsHelpNavItems()).toHaveLength(20);
    expect(HELP_NAV[4]?.children).toHaveLength(20);
  });

  it('aligns nav slugs with help registry and node-type-meta', () => {
    expect(findHelpNavRegistryMismatches()).toEqual([]);
    const nodeSlugs = flattenHelpNav()
      .map((item) => item.slug)
      .filter((slug): slug is string => slug?.startsWith('nodes/') ?? false);
    expect(nodeSlugs).toHaveLength(45);
    for (const nodeType of HELP_DOC_NODE_TYPES) {
      expect(nodeSlugs).toContain(`nodes/${nodeType}`);
    }
  });

  it('flattens linkable docs for lookup helpers', () => {
    const slugs = flattenHelpNav().map((item) => item.slug);
    expect(slugs[0]).toBe('');
    expect(slugs[1]).toBe('expressions');
    expect(slugs[2]).toBe('editor/input-panel');
    expect(slugs.filter((slug) => slug?.startsWith('nodes/'))).toHaveLength(45);
  });

  it('detects active descendants for group expansion', () => {
    const nodesGroup = HELP_NAV[3]!;
    expect(helpNavItemContainsSlug(nodesGroup, 'nodes/if')).toBe(true);
    expect(helpNavItemContainsSlug(nodesGroup, 'expressions')).toBe(false);
  });
});
