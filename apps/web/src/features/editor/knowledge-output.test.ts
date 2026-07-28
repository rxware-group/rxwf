import { describe, expect, it } from 'vitest';
import {
  formatKnowledgeRetrievalDetail,
  resolveKnowledgeQueryFromDebug,
} from './knowledge-output.js';

describe('knowledge-output', () => {
  it('formatKnowledgeRetrievalDetail includes query and chunk bodies', () => {
    const detail = formatKnowledgeRetrievalDetail('hello', [
      {
        text: 'world',
        score: 0.9,
        documentName: 'a.md',
        knowledgeBaseId: 'kb-1',
        documentId: 'd1',
        chunkIndex: 0,
      },
    ]);
    expect(detail).toContain('hello');
    expect(detail).toContain('a.md');
    expect(detail).toContain('world');
  });

  it('resolveKnowledgeQueryFromDebug reads outputItems and agentStream', () => {
    const result = {
      query: 'what is RAG?',
      knowledgeBaseIds: ['kb-1'],
      chunks: [
        {
          text: 'RAG combines retrieval and generation.',
          score: 0.92,
          documentName: 'guide.md',
          knowledgeBaseId: 'kb-1',
          documentId: 'doc-1',
          chunkIndex: 0,
        },
      ],
    };
    expect(
      resolveKnowledgeQueryFromDebug({
        status: 'success',
        outputItems: [[{ json: result }]],
      }),
    ).toEqual(result);
    expect(
      resolveKnowledgeQueryFromDebug({
        status: 'success',
        agentStream: [{ type: 'satellite_knowledge_query', ...result }],
      }),
    ).toEqual(result);
  });
});
