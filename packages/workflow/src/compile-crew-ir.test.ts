import { describe, expect, it } from 'vitest';
import { compileCrewIr } from './compile-crew-ir.js';
import type { WorkflowDefinition } from './validate.js';

const baseDef: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'crew-ir-test',
  nodes: [
    {
      id: 'crew',
      type: 'crewSequential',
      name: 'Crew',
      position: { x: 200, y: 0 },
      parameters: { executionBackend: 'crewai' },
    },
    {
      id: 'a1',
      type: 'aiAgent',
      name: 'Writer',
      position: { x: 0, y: 0 },
      parameters: { role: 'Writer', goal: 'Write', backstory: 'Pro' },
    },
    {
      id: 'a2',
      type: 'aiAgent',
      name: 'Editor',
      position: { x: 100, y: 0 },
      parameters: { role: 'Editor' },
    },
    {
      id: 'm1',
      type: 'aiChatModel',
      name: 'Model',
      position: { x: 0, y: 100 },
      parameters: { provider: 'ollama', model: 'llama3' },
    },
    {
      id: 't1',
      type: 'toolMcp',
      name: 'ListDir',
      position: { x: 0, y: 200 },
      parameters: { serverId: 's1', tools: ['list_directory'], toolDescription: 'List files' },
    },
  ],
  connections: [
    { from: 'a1', to: 'crew', fromOutput: 'crew_member', toInput: 'crew_member' },
    { from: 'a2', to: 'crew', fromOutput: 'crew_member', toInput: 'crew_member' },
    { from: 'm1', to: 'a1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
    { from: 't1', to: 'a1', fromOutput: 'ai_tool', toInput: 'ai_tool' },
    { from: 'm1', to: 'a2', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
  ],
};

describe('compileCrewIr', () => {
  it('builds sequential crewai IR with two members and tools', () => {
    const ir = compileCrewIr({
      definition: baseDef,
      crewNodeId: 'crew',
      process: 'sequential',
      inputTask: '{"topic":"AI"}',
      execution: {
        executionId: 'ex-1',
        workflowId: 'wf-1',
        environment: 'test',
        toolBridgeBaseUrl: 'http://127.0.0.1:8787',
        toolBridgeToken: 'tok',
      },
    });
    expect(ir.irVersion).toBe(1);
    expect(ir.executionBackend).toBe('crewai');
    expect(ir.process).toBe('sequential');
    expect(ir.members).toHaveLength(2);
    const firstTool = ir.members[0]?.tools[0];
    expect(firstTool?.type).toBe('mcp');
    if (firstTool?.type === 'mcp') {
      expect(firstTool.bridgeId).toMatch(/^bridge_/);
    }
  });

  it('defaults executionBackend to native when not set', () => {
    const def = structuredClone(baseDef);
    def.nodes[0]!.parameters = {};
    const ir = compileCrewIr({
      definition: def,
      crewNodeId: 'crew',
      process: 'sequential',
      inputTask: 'task',
      execution: {
        executionId: 'ex-1',
        workflowId: 'wf-1',
        environment: 'test',
        toolBridgeBaseUrl: 'http://127.0.0.1:8787',
        toolBridgeToken: 'tok',
      },
    });
    expect(ir.executionBackend).toBe('native');
  });

  it('builds supervisor manager from inline supervisorModel when no crew_manager agent', () => {
    const def: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'supervisor-ir',
      nodes: [
        {
          id: 'sup',
          type: 'crewSupervisor',
          name: 'Supervisor',
          position: { x: 0, y: 0 },
          parameters: {
            executionBackend: 'crewai',
            supervisorProvider: 'ollama',
            supervisorModel: 'llama3',
          },
        },
        {
          id: 'w1',
          type: 'aiAgent',
          name: 'Worker',
          position: { x: 0, y: 100 },
          parameters: { role: 'Worker' },
        },
        {
          id: 'm1',
          type: 'aiChatModel',
          name: 'Model',
          position: { x: 0, y: 200 },
          parameters: { provider: 'ollama', model: 'llama3' },
        },
      ],
      connections: [
        { from: 'w1', to: 'sup', fromOutput: 'crew_member', toInput: 'crew_member' },
        { from: 'm1', to: 'w1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      ],
    };

    const ir = compileCrewIr({
      definition: def,
      crewNodeId: 'sup',
      process: 'supervisor',
      inputTask: 'task',
      execution: {
        executionId: 'ex-1',
        workflowId: 'wf-1',
        environment: 'test',
        toolBridgeBaseUrl: 'http://127.0.0.1:8787',
        toolBridgeToken: 'tok',
      },
    });

    expect(ir.process).toBe('supervisor');
    expect(ir.manager?.model.model).toBe('llama3');
    expect(ir.manager?.role).toBe('Supervisor');
  });

  it('maps enableBuiltinTools to crewai-builtin member tools', () => {
    const def = structuredClone(baseDef);
    def.nodes[0]!.parameters = {
      executionBackend: 'crewai',
      enableBuiltinTools: ['SerperDevTool'],
    };
    const ir = compileCrewIr({
      definition: def,
      crewNodeId: 'crew',
      process: 'sequential',
      inputTask: 'task',
      execution: {
        executionId: 'ex-1',
        workflowId: 'wf-1',
        environment: 'test',
        toolBridgeBaseUrl: 'http://127.0.0.1:8787',
        toolBridgeToken: 'tok',
      },
    });
    expect(ir.members[0]?.tools.some((t) => t.type === 'crewai-builtin' && t.name === 'SerperDevTool')).toBe(
      true,
    );
  });

  it('attaches flowGraph when crewaiFlowMode is flow', () => {
    const def = structuredClone(baseDef);
    def.nodes[0]!.parameters = {
      executionBackend: 'crewai',
      crewaiFlowMode: 'flow',
    };
    const ir = compileCrewIr({
      definition: def,
      crewNodeId: 'crew',
      process: 'sequential',
      inputTask: 'task',
      execution: {
        executionId: 'ex-1',
        workflowId: 'wf-1',
        environment: 'test',
        toolBridgeBaseUrl: 'http://127.0.0.1:8787',
        toolBridgeToken: 'tok',
      },
    });
    expect(ir.flowGraph?.entryNodeId).toBe('flow_start');
    expect(ir.flowGraph?.nodes.filter((n) => n.type === 'task')).toHaveLength(2);
  });

  it('passes crewaiKnowledgeMode native from crew params', () => {
    const def = structuredClone(baseDef);
    def.nodes[0]!.parameters = {
      executionBackend: 'crewai',
      crewaiKnowledgeMode: 'native',
    };
    const ir = compileCrewIr({
      definition: def,
      crewNodeId: 'crew',
      process: 'sequential',
      inputTask: 'task',
      execution: {
        executionId: 'ex-1',
        workflowId: 'wf-1',
        environment: 'test',
        toolBridgeBaseUrl: 'http://127.0.0.1:8787',
        toolBridgeToken: 'tok',
      },
    });
    expect(ir.crewParams.crewaiKnowledgeMode).toBe('native');
  });
});
