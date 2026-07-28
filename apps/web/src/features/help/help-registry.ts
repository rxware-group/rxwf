import { HELP_DOC_NODE_TYPES } from './help-doc-node-types.js';

export { HELP_DOC_NODE_TYPES, type HelpDocNodeType } from './help-doc-node-types.js';

export const NODE_HELP_PATH: Record<string, string> = Object.fromEntries(
  HELP_DOC_NODE_TYPES.map((nodeType) => [nodeType, `/help/nodes/${nodeType}`]),
);

export function buildHelpUrl(options: {
  nodeType?: string;
  path?: string;
  hash?: string;
  origin?: string;
}): string {
  const baseOrigin =
    options.origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  let path = options.path ?? '/help';
  const mapped = options.nodeType ? NODE_HELP_PATH[options.nodeType] : undefined;
  if (mapped) {
    path = mapped;
  }
  const hash = options.hash ? `#${options.hash}` : '';
  return `${baseOrigin}${path}${hash}`;
}

export function helpPathFromSlug(slug: string): string {
  const normalized = slug.replace(/^\/+|\/+$/g, '');
  return normalized ? `/help/${normalized}` : '/help';
}
