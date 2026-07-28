const STOP = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of', 'in', 'on', 'for',
  '的', '了', '和', '是', '在', '与', '或',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Lightweight BM25 over in-memory documents (chunk id -> text). */
export function scoreBm25(
  query: string,
  documents: Array<{ id: string; text: string }>,
  opts?: { k1?: number; b?: number },
): Array<{ id: string; score: number }> {
  const k1 = opts?.k1 ?? 1.2;
  const b = opts?.b ?? 0.75;
  const qTerms = tokenize(query);
  if (qTerms.length === 0 || documents.length === 0) return [];

  const docTokens = documents.map((d) => ({
    id: d.id,
    terms: tokenize(d.text),
  }));
  const avgLen =
    docTokens.reduce((s, d) => s + d.terms.length, 0) / Math.max(docTokens.length, 1);
  const N = documents.length;

  const df = new Map<string, number>();
  for (const term of new Set(qTerms)) {
    let count = 0;
    for (const d of docTokens) {
      if (d.terms.includes(term)) count++;
    }
    df.set(term, count);
  }

  const scored: Array<{ id: string; score: number }> = [];
  for (const doc of docTokens) {
    const docLen = doc.terms.length;
    let score = 0;
    const termFreq = new Map<string, number>();
    for (const t of doc.terms) {
      termFreq.set(t, (termFreq.get(t) ?? 0) + 1);
    }
    for (const term of qTerms) {
      const n = df.get(term) ?? 0;
      if (n === 0) continue;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const tf = termFreq.get(term) ?? 0;
      const denom = tf + k1 * (1 - b + (b * docLen) / avgLen);
      score += idf * ((tf * (k1 + 1)) / denom);
    }
    if (score > 0) scored.push({ id: doc.id, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}
