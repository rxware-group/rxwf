export function slugifyName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'bot';
}

export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = slugifyName(base);
  if (!(await exists(slug))) return slug;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${slug}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${slug}-${crypto.randomUUID().slice(0, 8)}`;
}
