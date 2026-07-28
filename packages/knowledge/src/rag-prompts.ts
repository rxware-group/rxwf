import type { ScoredChunk } from '@rxwf/providers-contracts';

export const RAG_TEMPLATES = {
  support: `你是技术支持助手。仅根据下列「参考资料」回答；若资料不足，明确说明未找到相关内容，不要编造。`,
  code: `你是代码助手。优先引用参考资料中的命令与配置；无法从资料推断时请说明。`,
} as const;

export type RagTemplateId = keyof typeof RAG_TEMPLATES;

export function buildRagSystemPrompt(
  chunks: ScoredChunk[],
  templateId: RagTemplateId = 'support',
): string {
  const base = RAG_TEMPLATES[templateId];
  if (chunks.length === 0) {
    return `${base}\n\n（当前无检索到的参考资料）`;
  }
  const refs = chunks
    .map(
      (c, i) =>
        `[${i + 1}] (${c.documentName}#${c.chunkIndex}, score=${c.score.toFixed(3)})\n${c.text}`,
    )
    .join('\n\n');
  return `${base}\n\n## 参考资料\n\n${refs}`;
}

export function chunksToCitations(chunks: ScoredChunk[]) {
  return chunks.map((c) => ({
    documentId: c.documentId,
    documentName: c.documentName,
    chunkIndex: c.chunkIndex,
    score: c.score,
    excerpt: c.text.slice(0, 500),
  }));
}
