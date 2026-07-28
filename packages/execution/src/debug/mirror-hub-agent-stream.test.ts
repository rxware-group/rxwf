import { describe, expect, it } from 'vitest';
import { mirrorSatelliteStreamForHub } from './mirror-hub-agent-stream.js';

const definition = {
  schemaVersion: 1 as const,
  name: 'w',
  nodes: [
    {
      id: 'mdl',
      type: 'aiChatModel',
      name: 'Chat Model',
      position: { x: 0, y: 0 },
      parameters: {},
    },
  ],
  connections: [],
};

describe('mirrorSatelliteStreamForHub', () => {
  it('mirrors satellite_invoke_start as chatModel agent_step', () => {
    const mirrored = mirrorSatelliteStreamForHub(definition, 'mdl', {
      type: 'satellite_invoke_start',
      input: [{ role: 'user', content: 'hi' }],
    });
    expect(mirrored).toMatchObject({
      type: 'agent_step',
      step: {
        kind: 'chatModel',
        phase: 'start',
        satelliteNodeName: 'Chat Model',
      },
    });
  });

  it('mirrors satellite_knowledge_query with chunk payloads', () => {
    const mirrored = mirrorSatelliteStreamForHub(definition, 'mdl', {
      type: 'satellite_knowledge_query',
      query: 'hello',
      knowledgeBaseIds: ['kb-1'],
      chunks: [
        {
          text: 'chunk body',
          score: 0.91,
          documentName: 'a.md',
          knowledgeBaseId: 'kb-1',
          documentId: 'd1',
          chunkIndex: 0,
        },
      ],
    });
    expect(mirrored).toMatchObject({
      type: 'agent_step',
      step: {
        kind: 'knowledge',
        query: 'hello',
        chunkCount: 1,
        chunks: [{ text: 'chunk body', documentName: 'a.md' }],
      },
    });
  });
});
