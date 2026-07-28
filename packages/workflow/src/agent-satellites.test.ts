import { describe, expect, it } from 'vitest';
import { collectSatellites, isSatelliteNodeType } from './agent-satellites.js';
import type { WorkflowDefinition } from './validate.js';

const def: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'agent-test',
  nodes: [
    { id: 'agt', type: 'aiAgent', name: 'Agent', position: { x: 0, y: 0 }, parameters: {} },
    {
      id: 'mdl',
      type: 'aiChatModel',
      name: 'Model',
      position: { x: 0, y: 0 },
      parameters: { provider: 'ollama', model: 'llama3' },
    },
    {
      id: 'mem',
      type: 'aiMemory',
      name: 'Memory',
      position: { x: 0, y: 0 },
      parameters: { maxTurns: 10 },
    },
    {
      id: 't1',
      type: 'toolMcp',
      name: 'ListDir',
      position: { x: 0, y: 0 },
      parameters: {
        serverId: 's1',
        tools: ['list_directory'],
        toolDescription: 'List files',
      },
    },
  ],
  connections: [
    { from: 'mdl', to: 'agt', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
    { from: 'mem', to: 'agt', fromOutput: 'ai_memory', toInput: 'ai_memory' },
    { from: 't1', to: 'agt', fromOutput: 'ai_tool', toInput: 'ai_tool' },
  ],
};

describe('collectSatellites', () => {
  it('returns model, memory, and tools for aiAgent', () => {
    const s = collectSatellites(def, 'agt');
    expect(s.model?.id).toBe('mdl');
    expect(s.memory?.id).toBe('mem');
    expect(s.knowledge).toBeNull();
    expect(s.outputParser).toBeNull();
    expect(s.tools).toHaveLength(1);
    expect(s.tools[0]?.type).toBe('toolMcp');
  });

  it('returns empty satellites for unknown agent id', () => {
    const s = collectSatellites(def, 'missing');
    expect(s.model).toBeNull();
    expect(s.memory).toBeNull();
    expect(s.knowledge).toBeNull();
    expect(s.outputParser).toBeNull();
    expect(s.tools).toHaveLength(0);
  });
});

describe('isSatelliteNodeType', () => {
  it('recognizes AI satellite types', () => {
    expect(isSatelliteNodeType('aiChatModel')).toBe(true);
    expect(isSatelliteNodeType('toolHttp')).toBe(true);
    expect(isSatelliteNodeType('toolSkill')).toBe(true);
    expect(isSatelliteNodeType('toolSubagent')).toBe(true);
    expect(isSatelliteNodeType('toolRead')).toBe(true);
    expect(isSatelliteNodeType('toolWebSearch')).toBe(true);
    expect(isSatelliteNodeType('httpRequest')).toBe(false);
  });
});
