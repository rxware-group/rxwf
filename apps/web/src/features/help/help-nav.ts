import { getNodeMeta, NODE_TYPE_META } from '../editor/node-type-meta.js';
import { HELP_DOC_NODE_TYPES } from './help-doc-node-types.js';
import { NODE_HELP_PATH } from './help-registry.js';

export interface HelpNavItem {
  /** URL slug under /help; omit for group-only entries */
  slug?: string;
  /** i18n key; omit when `nodeType` supplies label from node-type-meta */
  titleKey?: string;
  /** When set, nav label comes from NODE_TYPE_META (aligned with editor palette) */
  nodeType?: string;
  children?: HelpNavItem[];
}

const CATEGORY_ORDER: Record<string, number> = {
  trigger: 0,
  logic: 1,
  data: 2,
  action: 3,
  plus: 4,
  agent: 5,
  note: 6,
};

function compareHelpDocNodeTypes(a: string, b: string): number {
  const metaA = NODE_TYPE_META[a];
  const metaB = NODE_TYPE_META[b];
  const catA = CATEGORY_ORDER[metaA?.category ?? ''] ?? 99;
  const catB = CATEGORY_ORDER[metaB?.category ?? ''] ?? 99;
  if (catA !== catB) return catA - catB;
  return (metaA?.label ?? a).localeCompare(metaB?.label ?? b);
}

export function buildNodeHelpNavItems(): HelpNavItem[] {
  return [...HELP_DOC_NODE_TYPES].sort(compareHelpDocNodeTypes).map((nodeType) => ({
    slug: `nodes/${nodeType}`,
    nodeType,
  }));
}

export function buildSettingsHelpNavItems(): HelpNavItem[] {
  return [
    { slug: 'settings/profile', titleKey: 'settings.nav.profile' },
    { slug: 'settings/users', titleKey: 'settings.nav.users' },
    { slug: 'settings/roles', titleKey: 'settings.nav.roles' },
    { slug: 'settings/agent-memory', titleKey: 'settings.nav.agentMemory' },
    { slug: 'settings/variables', titleKey: 'settings.nav.variables' },
    { slug: 'settings/env', titleKey: 'settings.nav.env' },
    { slug: 'settings/runners', titleKey: 'settings.nav.runners' },
    { slug: 'settings/credentials', titleKey: 'settings.nav.credentials' },
    { slug: 'settings/system', titleKey: 'settings.nav.system' },
    { slug: 'settings/plugins', titleKey: 'settings.nav.plugins' },
    { slug: 'settings/mcp', titleKey: 'settings.nav.mcp' },
    { slug: 'settings/rxwf', titleKey: 'settings.nav.rxwf' },
    { slug: 'settings/mcp-tokens', titleKey: 'settings.nav.mcpTokens' },
    { slug: 'settings/models', titleKey: 'settings.nav.models' },
    { slug: 'settings/knowledge', titleKey: 'settings.nav.knowledge' },
    { slug: 'settings/langsmith', titleKey: 'settings.nav.langsmith' },
    { slug: 'settings/web-search', titleKey: 'settings.nav.webSearch' },
    { slug: 'settings/setup', titleKey: 'settings.nav.setup' },
    { slug: 'settings/admin/i18n', titleKey: 'settings.nav.i18nAdmin' },
    { slug: 'settings/admin/theme', titleKey: 'settings.nav.themeAdmin' },
  ];
}

export const HELP_NAV: HelpNavItem[] = [
  { slug: '', titleKey: 'help.nav.home' },
  { slug: 'expressions', titleKey: 'help.nav.expressions' },
  {
    titleKey: 'help.nav.editor',
    children: [{ slug: 'editor/input-panel', titleKey: 'help.nav.inputPanel' }],
  },
  {
    titleKey: 'help.nav.nodes',
    children: buildNodeHelpNavItems(),
  },
  {
    titleKey: 'help.nav.settings',
    children: buildSettingsHelpNavItems(),
  },
];

export function helpNavItemLabel(item: HelpNavItem, labels: Record<string, string>): string {
  if (item.nodeType) {
    return getNodeMeta(item.nodeType).label;
  }
  if (item.titleKey) {
    return labels[item.titleKey] ?? item.titleKey;
  }
  return '';
}

export function helpNavItemKey(item: HelpNavItem): string {
  return item.slug ?? item.nodeType ?? item.titleKey ?? '';
}

export function helpPathSlug(pathname: string): string {
  return pathname.replace(/^\/help\/?/, '').replace(/\/$/, '');
}

export function helpNavItemContainsSlug(item: HelpNavItem, slug: string): boolean {
  if (item.slug !== undefined && item.slug === slug) {
    return true;
  }
  return item.children?.some((child) => helpNavItemContainsSlug(child, slug)) ?? false;
}

export function flattenHelpNav(items: HelpNavItem[] = HELP_NAV): HelpNavItem[] {
  const out: HelpNavItem[] = [];
  for (const item of items) {
    if (item.slug !== undefined) {
      out.push(item);
    }
    if (item.children?.length) {
      out.push(...flattenHelpNav(item.children));
    }
  }
  return out;
}

/** Every registry path must have a nav leaf; every nav node slug must map in registry. */
export function findHelpNavRegistryMismatches(): string[] {
  const errors: string[] = [];
  const nodeItems = flattenHelpNav().filter((item) => item.slug?.startsWith('nodes/'));

  for (const nodeType of HELP_DOC_NODE_TYPES) {
    const expectedSlug = `nodes/${nodeType}`;
    if (!nodeItems.some((item) => item.slug === expectedSlug)) {
      errors.push(`missing nav item for registry nodeType: ${nodeType}`);
    }
    if (NODE_HELP_PATH[nodeType] !== `/help/nodes/${nodeType}`) {
      errors.push(`registry path mismatch for ${nodeType}`);
    }
  }

  for (const item of nodeItems) {
    const nodeType = item.slug!.slice('nodes/'.length);
    if (!NODE_HELP_PATH[nodeType]) {
      errors.push(`orphan nav slug without registry entry: ${item.slug}`);
    }
    if (!NODE_TYPE_META[nodeType]) {
      errors.push(`nav nodeType missing from NODE_TYPE_META: ${nodeType}`);
    }
  }

  return errors;
}
