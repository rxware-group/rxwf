const RAW_DOCS = import.meta.glob('../../../../../docs/help/zh/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const DOC_BY_SLUG = new Map<string, string>();

for (const [filePath, content] of Object.entries(RAW_DOCS)) {
  const match = filePath.match(/docs\/help\/zh\/(.+)\.md$/);
  if (match?.[1]) {
    DOC_BY_SLUG.set(match[1], content);
  }
}

export function listHelpDocSlugs(): string[] {
  return [...DOC_BY_SLUG.keys()].sort();
}

export function getHelpDoc(slug: string): string | null {
  const normalized = slug.replace(/^\/+|\/+$/g, '');
  if (!normalized) {
    return DOC_BY_SLUG.get('index') ?? null;
  }
  return DOC_BY_SLUG.get(normalized) ?? null;
}
