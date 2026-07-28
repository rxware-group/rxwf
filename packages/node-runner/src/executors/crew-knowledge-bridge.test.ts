import { describe, expect, it, vi } from 'vitest';
import { AwfError } from '@rxwf/shared';
import { SATELLITE_NODE_TYPES, type AwfCrewIrV1 } from '@rxwf/workflow';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { enrichCrewIrWithKnowledge } from './crew-knowledge-bridge.js';
import type { NodeExecutionContext } from '../types/node-executor.js';
import { registerPlusExecutors, type PlusExecutorDeps } from './register-plus.js';

function baseIr(): AwfCrewIrV1 {
  return {
    irVersion: 1,
    process: 'sequential',
    executionBackend: 'crewai',
    inputTask: 'What is AWF?',
    crewParams: {},
    members: [
      {
        nodeId: 'a1',
        name: 'Writer',
        model: { provider: 'ollama', model: 'llama3' },
        tools: [],
        knowledge: { knowledgeBaseIds: ['kb-1'] },
      },
    ],
    execution: {
      executionId: 'ex-1',
      workflowId: 'wf-1',
      crewNodeId: 'crew',
      environment: 'test',
      toolBridgeBaseUrl: 'http://127.0.0.1:8787',
      toolBridgeToken: '',
    },
  };
}

const ctx: NodeExecutionContext = {
  config: {},
  inputItems: [{ json: {} }],
};

describe('aiKnowledge satellite audit', () => {
  it('aiKnowledge is a satellite without standalone Plus executor', () => {
    expect(SATELLITE_NODE_TYPES.has('aiKnowledge')).toBe(true);
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry, {});
    expect(registry.has('aiKnowledge')).toBe(false);
  });
});

describe('crew-knowledge-bridge', () => {
  it('enrichCrewIrWithKnowledge no-ops when knowledge runtime is missing', async () => {
    const ir = baseIr();
    await enrichCrewIrWithKnowledge(ir, ctx, {});
    expect(ir.members[0]?.backstory).toBeUndefined();
  });

  it('enrichCrewIrWithKnowledge skips when inputTask is empty', async () => {
    const ir = baseIr();
    ir.inputTask = '   ';
    const queryMany = vi.fn();
    await enrichCrewIrWithKnowledge(ir, ctx, { knowledge: { queryMany } });
    expect(queryMany).not.toHaveBeenCalled();
  });

  it('enrichCrewIrWithKnowledge propagates E3003 from queryMany', async () => {
    const ir = baseIr();
    const deps: PlusExecutorDeps = {
      knowledge: {
        queryMany: vi.fn(async () => {
          throw new AwfError('E3003', 'RAG 未找到相关内容');
        }),
      },
    };
    await expect(enrichCrewIrWithKnowledge(ir, ctx, deps)).rejects.toMatchObject({
      code: 'E3003',
    });
  });

  it('enrichCrewIrWithKnowledge appends RAG block to member backstory', async () => {
    const ir = baseIr();
    const deps: PlusExecutorDeps = {
      knowledge: {
        queryMany: vi.fn(async () => [
          {
            id: 'c1',
            knowledgeBaseId: 'kb-1',
            documentId: 'd1',
            documentName: 'doc',
            chunkIndex: 0,
            score: 0.9,
            text: 'AWF is a workflow engine.',
            metadata: {},
          },
        ]),
      },
    };

    await enrichCrewIrWithKnowledge(ir, ctx, deps);

    expect(deps.knowledge!.queryMany).toHaveBeenCalledWith(['kb-1'], 'What is AWF?');
    expect(ir.members[0]?.backstory).toContain('Knowledge context');
    expect(ir.members[0]?.backstory).toContain('AWF is a workflow engine');
  });

  it('enrichCrewIrWithKnowledge native mode populates chunks without backstory', async () => {
    const ir = baseIr();
    ir.crewParams.crewaiKnowledgeMode = 'native';
    const deps: PlusExecutorDeps = {
      knowledge: {
        queryMany: vi.fn(async () => [
          {
            id: 'c1',
            knowledgeBaseId: 'kb-1',
            documentId: 'd1',
            documentName: 'doc',
            chunkIndex: 0,
            score: 0.9,
            text: 'AWF is a workflow engine.',
            metadata: {},
          },
        ]),
      },
    };

    await enrichCrewIrWithKnowledge(ir, ctx, deps);

    expect(ir.members[0]?.knowledge?.chunks).toEqual([
      { text: 'AWF is a workflow engine.', documentName: 'doc', score: 0.9 },
    ]);
    expect(ir.members[0]?.backstory).toBeUndefined();
  });

  it('enrichCrewIrWithKnowledge enriches manager backstory in inject mode', async () => {
    const ir = baseIr();
    ir.manager = {
      nodeId: 'mgr',
      name: 'Manager',
      model: { provider: 'ollama', model: 'llama3' },
      tools: [],
      knowledge: { knowledgeBaseIds: ['kb-mgr'] },
      role: 'Manager',
    };
    const deps: PlusExecutorDeps = {
      knowledge: {
        queryMany: vi.fn(async () => [
          {
            id: 'c2',
            knowledgeBaseId: 'kb-mgr',
            documentId: 'd2',
            documentName: 'mgr-doc',
            chunkIndex: 0,
            score: 0.8,
            text: 'Manager knowledge snippet.',
            metadata: {},
          },
        ]),
      },
    };

    await enrichCrewIrWithKnowledge(ir, ctx, deps);

    expect(deps.knowledge!.queryMany).toHaveBeenCalledWith(['kb-mgr'], 'What is AWF?');
    expect(ir.manager?.backstory).toContain('Knowledge context');
    expect(ir.manager?.backstory).toContain('Manager knowledge snippet');
  });
});
