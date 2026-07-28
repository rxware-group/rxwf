import { describe, it, expect } from 'vitest';
import { validateWorkflowDefinition } from './validate.js';

const base = {
  schemaVersion: 1 as const,
  name: 'test',
  nodes: [
    {
      id: 't1',
      type: 'manualTrigger',
      name: 'Start',
      position: { x: 0, y: 0 },
      parameters: {},
    },
  ],
  connections: [] as { from: string; to: string }[],
};

describe('validateWorkflowDefinition', () => {
  it('rejects subworkflow nesting depth at 5 with E1003', () => {
    const result = validateWorkflowDefinition(
      {
        ...base,
        nodes: [
          ...base.nodes,
          {
            id: 'sw1',
            type: 'executeWorkflow',
            name: 'Child',
            position: { x: 1, y: 0 },
            parameters: { workflowId: 'wf-child' },
          },
        ],
      },
      { subworkflowDepth: 5 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('E1003');
  });

  it('rejects error workflow recursion depth above 2 with E1004', () => {
    const result = validateWorkflowDefinition(base, { errorWorkflowDepth: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('E1004');
  });

  describe('runner policy validation (§6.6)', () => {
    it('rejects preferRemote node when workflow fallback is embedded with E1005', () => {
      const result = validateWorkflowDefinition({
        ...base,
        settings: {
          runnerPolicy: { mode: 'auto', fallback: 'embedded' },
        },
        nodes: [
          ...base.nodes,
          {
            id: 'n1',
            type: 'httpRequest',
            name: 'Remote',
            position: { x: 1, y: 0 },
            parameters: { preferRemote: true },
          },
        ],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors[0]?.code).toBe('E1005');
    });

    it('rejects preferRemote node when effective mode is embedded with E1005', () => {
      const result = validateWorkflowDefinition({
        ...base,
        settings: {
          runnerPolicy: { mode: 'embedded', fallback: 'fail' },
        },
        nodes: [
          ...base.nodes,
          {
            id: 'n1',
            type: 'httpRequest',
            name: 'Remote',
            position: { x: 1, y: 0 },
            parameters: { preferRemote: true },
          },
        ],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.some((e) => e.code === 'E1005')).toBe(true);
    });

    it('rejects pinned workflow policy without runnerId', () => {
      const result = validateWorkflowDefinition({
        ...base,
        settings: {
          runnerPolicy: { mode: 'pinned' },
        },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.some((e) => e.code === 'E1015')).toBe(true);
    });

    it('rejects label workflow policy without labels', () => {
      const result = validateWorkflowDefinition({
        ...base,
        settings: {
          runnerPolicy: { mode: 'label' },
        },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.some((e) => e.code === 'E1016')).toBe(true);
    });

    it('rejects label workflow policy with empty labels array', () => {
      const result = validateWorkflowDefinition({
        ...base,
        settings: {
          runnerPolicy: { mode: 'label', labels: [] },
        },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.some((e) => e.code === 'E1016')).toBe(true);
    });

    it('warns when pinned runnerId is not in knownRunnerIds', () => {
      const result = validateWorkflowDefinition(
        {
          ...base,
          settings: {
            runnerPolicy: { mode: 'pinned', runnerId: 'missing-agent' },
          },
        },
        { knownRunnerIds: ['agent-1', 'embedded'] },
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.warnings.some((w) => w.code === 'E1010')).toBe(true);
      }
    });

    it('does not warn for unknown runnerId when knownRunnerIds omitted', () => {
      const result = validateWorkflowDefinition({
        ...base,
        settings: {
          runnerPolicy: { mode: 'pinned', runnerId: 'missing-agent' },
        },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.warnings.some((w) => w.code === 'E1010')).toBe(false);
      }
    });

    it('rejects node pinned override without runnerId', () => {
      const result = validateWorkflowDefinition({
        ...base,
        settings: {
          runnerPolicy: { mode: 'auto', fallback: 'fail' },
        },
        nodes: [
          ...base.nodes,
          {
            id: 'n1',
            type: 'set',
            name: 'Set',
            position: { x: 1, y: 0 },
            parameters: {},
            runner: { mode: 'pinned' },
          },
        ],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'E1015' && e.nodeId === 'n1')).toBe(true);
      }
    });

    it('rejects node label override without labels', () => {
      const result = validateWorkflowDefinition({
        ...base,
        settings: {
          runnerPolicy: { mode: 'auto', fallback: 'fail' },
        },
        nodes: [
          ...base.nodes,
          {
            id: 'n1',
            type: 'set',
            name: 'Set',
            position: { x: 1, y: 0 },
            parameters: {},
            runner: { mode: 'label' },
          },
        ],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'E1016' && e.nodeId === 'n1')).toBe(true);
      }
    });
  });

  it('rejects empty node name with E1002', () => {
    const result = validateWorkflowDefinition({
      ...base,
      nodes: [
        {
          id: 'n1',
          type: 'set',
          name: '   ',
          position: { x: 0, y: 0 },
          parameters: {},
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'E1002')).toBe(true);
  });

  it('rejects duplicate node names with E1006', () => {
    const result = validateWorkflowDefinition({
      ...base,
      nodes: [
        ...base.nodes,
        { id: 'a', type: 'set', name: 'Set', position: { x: 1, y: 0 }, parameters: {} },
        { id: 'b', type: 'set', name: 'Set', position: { x: 2, y: 0 }, parameters: {} },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'E1006')).toBe(true);
  });

  it('rejects cyclic connections with E1003', () => {
    const result = validateWorkflowDefinition({
      ...base,
      nodes: [
        { id: 'a', type: 'set', name: 'A', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'b', type: 'set', name: 'B', position: { x: 1, y: 0 }, parameters: {} },
      ],
      connections: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'E1003')).toBe(true);
  });

  it('E1012 when aiAgent has no Chat Model', () => {
    const result = validateWorkflowDefinition({
      ...base,
      nodes: [
        ...base.nodes,
        {
          id: 'agt',
          type: 'aiAgent',
          name: 'Agent',
          position: { x: 1, y: 0 },
          parameters: {},
        },
      ],
      connections: [{ from: 't1', to: 'agt' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'E1012')).toBe(true);
  });

  it('allows aiAgent with Chat Model only (Tool optional 0~n)', () => {
    const result = validateWorkflowDefinition({
      ...base,
      nodes: [
        ...base.nodes,
        {
          id: 'agt',
          type: 'aiAgent',
          name: 'Agent',
          position: { x: 1, y: 0 },
          parameters: {},
        },
        {
          id: 'mdl',
          type: 'aiChatModel',
          name: 'Model',
          position: { x: 2, y: 0 },
          parameters: { provider: 'ollama', model: 'llama3' },
        },
      ],
      connections: [
        { from: 't1', to: 'agt' },
        {
          from: 'mdl',
          to: 'agt',
          fromOutput: 'ai_languageModel',
          toInput: 'ai_languageModel',
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it('E1014 when aiAgent has multiple Chat Models', () => {
    const result = validateWorkflowDefinition({
      ...base,
      nodes: [
        ...base.nodes,
        {
          id: 'agt',
          type: 'aiAgent',
          name: 'Agent',
          position: { x: 1, y: 0 },
          parameters: {},
        },
        {
          id: 'mdl1',
          type: 'aiChatModel',
          name: 'Model1',
          position: { x: 2, y: 0 },
          parameters: { provider: 'ollama', model: 'llama3' },
        },
        {
          id: 'mdl2',
          type: 'aiChatModel',
          name: 'Model2',
          position: { x: 3, y: 0 },
          parameters: { provider: 'ollama', model: 'llama3' },
        },
        {
          id: 't1',
          type: 'toolMcp',
          name: 'Tool',
          position: { x: 4, y: 0 },
          parameters: { serverId: 's', tools: ['x'], toolDescription: 'd' },
        },
      ],
      connections: [
        { from: 't1', to: 'agt' },
        {
          from: 'mdl1',
          to: 'agt',
          fromOutput: 'ai_languageModel',
          toInput: 'ai_languageModel',
        },
        {
          from: 'mdl2',
          to: 'agt',
          fromOutput: 'ai_languageModel',
          toInput: 'ai_languageModel',
        },
        { from: 't1', to: 'agt', fromOutput: 'ai_tool', toInput: 'ai_tool' },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'E1014')).toBe(true);
  });

  describe('crew validation (P4-C)', () => {
    function workerBundle(
      id: string,
      name: string,
      role: string,
    ): {
      nodes: (typeof base.nodes)[number][];
      connections: { from: string; to: string; fromOutput?: string; toInput?: string }[];
    } {
      const mdl = `${id}-mdl`;
      const tool = `${id}-tool`;
      return {
        nodes: [
          {
            id,
            type: 'aiAgent',
            name,
            position: { x: 0, y: 0 },
            parameters: { role, goal: name },
          },
          {
            id: mdl,
            type: 'aiChatModel',
            name: `${name} Model`,
            position: { x: 0, y: 0 },
            parameters: { provider: 'ollama', model: 'llama3' },
          },
          {
            id: tool,
            type: 'toolHttp',
            name: `${name} Tool`,
            position: { x: 0, y: 0 },
            parameters: {
              method: 'GET',
              url: 'https://example.com',
              toolDescription: `${name} tool`,
            },
          },
        ],
        connections: [
          {
            from: mdl,
            to: id,
            fromOutput: 'ai_languageModel',
            toInput: 'ai_languageModel',
          },
          { from: tool, to: id, fromOutput: 'ai_tool', toInput: 'ai_tool' },
        ],
      };
    }

    it('E1030 when crewSequential has fewer than two crew_member workers', () => {
      const w1 = workerBundle('w1', 'Researcher', 'Researcher');
      const result = validateWorkflowDefinition({
        ...base,
        nodes: [
          ...base.nodes,
          {
            id: 'crew',
            type: 'crewSequential',
            name: 'Crew',
            position: { x: 1, y: 0 },
            parameters: {},
          },
          ...w1.nodes,
        ],
        connections: [
          { from: 't1', to: 'crew' },
          {
            from: 'w1',
            to: 'crew',
            fromOutput: 'crew_member',
            toInput: 'crew_member',
          },
          ...w1.connections,
        ],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.some((e) => e.code === 'E1030')).toBe(true);
    });

    it('E1031 when crewHierarchical has no crew_manager', () => {
      const w1 = workerBundle('w1', 'Worker', 'Worker');
      const result = validateWorkflowDefinition({
        ...base,
        nodes: [
          ...base.nodes,
          {
            id: 'crew',
            type: 'crewHierarchical',
            name: 'Crew',
            position: { x: 1, y: 0 },
            parameters: {},
          },
          ...w1.nodes,
        ],
        connections: [
          { from: 't1', to: 'crew' },
          {
            from: 'w1',
            to: 'crew',
            fromOutput: 'crew_member',
            toInput: 'crew_member',
          },
          ...w1.connections,
        ],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.some((e) => e.code === 'E1031')).toBe(true);
    });

    it('E1032 when crewSupervisor has no crew_member workers', () => {
      const result = validateWorkflowDefinition({
        ...base,
        nodes: [
          ...base.nodes,
          {
            id: 'sup',
            type: 'crewSupervisor',
            name: 'Supervisor',
            position: { x: 1, y: 0 },
            parameters: { supervisorModel: 'llama3' },
          },
        ],
        connections: [{ from: 't1', to: 'sup' }],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.some((e) => e.code === 'E1032')).toBe(true);
    });

    it('E1035 when crewSupervisor has no supervisorModel and no crew_manager model', () => {
      const w1 = workerBundle('w1', 'Worker', 'Worker');
      const result = validateWorkflowDefinition({
        ...base,
        nodes: [
          ...base.nodes,
          {
            id: 'sup',
            type: 'crewSupervisor',
            name: 'Supervisor',
            position: { x: 1, y: 0 },
            parameters: {},
          },
          ...w1.nodes,
        ],
        connections: [
          { from: 't1', to: 'sup' },
          {
            from: 'w1',
            to: 'sup',
            fromOutput: 'crew_member',
            toInput: 'crew_member',
          },
          ...w1.connections,
        ],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.some((e) => e.code === 'E1035')).toBe(true);
    });

    function memberNoTool(
      id: string,
      name: string,
      role: string,
    ): {
      nodes: (typeof base.nodes)[number][];
      connections: { from: string; to: string; fromOutput?: string; toInput?: string }[];
    } {
      const mdl = `${id}-mdl`;
      return {
        nodes: [
          {
            id,
            type: 'aiAgent',
            name,
            position: { x: 0, y: 0 },
            parameters: { role, goal: name },
          },
          {
            id: mdl,
            type: 'aiChatModel',
            name: `${name} Model`,
            position: { x: 0, y: 0 },
            parameters: { provider: 'ollama', model: 'llama3' },
          },
        ],
        connections: [
          {
            from: mdl,
            to: id,
            fromOutput: 'ai_languageModel',
            toInput: 'ai_languageModel',
          },
        ],
      };
    }

    function crewSequentialCrewai(
      w1: ReturnType<typeof workerBundle>,
      w2: ReturnType<typeof workerBundle>,
    ) {
      return {
        ...base,
        nodes: [
          ...base.nodes,
          {
            id: 'crew',
            type: 'crewSequential',
            name: 'Crew',
            position: { x: 1, y: 0 },
            parameters: { executionBackend: 'crewai' },
          },
          ...w1.nodes,
          ...w2.nodes,
        ],
        connections: [
          { from: 't1', to: 'crew' },
          {
            from: 'w1',
            to: 'crew',
            fromOutput: 'crew_member',
            toInput: 'crew_member',
          },
          {
            from: 'w2',
            to: 'crew',
            fromOutput: 'crew_member',
            toInput: 'crew_member',
          },
          ...w1.connections,
          ...w2.connections,
        ],
      };
    }

    it('E1040 when crewSequential has executionBackend crewai and crewaiRunnerConfigured is false', () => {
      const w1 = workerBundle('w1', 'A', 'RoleA');
      const w2 = workerBundle('w2', 'B', 'RoleB');
      const result = validateWorkflowDefinition(crewSequentialCrewai(w1, w2), {
        crewaiRunnerConfigured: false,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.some((e) => e.code === 'E1040')).toBe(true);
    });

    it('no E1040 when crewaiRunnerConfigured is true', () => {
      const w1 = workerBundle('w1', 'A', 'RoleA');
      const w2 = workerBundle('w2', 'B', 'RoleB');
      const result = validateWorkflowDefinition(crewSequentialCrewai(w1, w2), {
        crewaiRunnerConfigured: true,
      });
      const errors = result.ok ? [] : result.errors;
      expect(errors.some((e) => e.code === 'E1040')).toBe(false);
    });

    it('W1013 when crewai backend and members lack tools', () => {
      const w1 = memberNoTool('w1', 'A', 'RoleA');
      const w2 = memberNoTool('w2', 'B', 'RoleB');
      const result = validateWorkflowDefinition(crewSequentialCrewai(w1, w2), {
        crewaiRunnerConfigured: true,
      });
      expect(result.warnings.some((w) => w.code === 'W1013' && w.nodeId === 'crew')).toBe(
        true,
      );
    });

    it('no W1013 when crewai backend has enableBuiltinTools', () => {
      const w1 = memberNoTool('w1', 'A', 'RoleA');
      const w2 = memberNoTool('w2', 'B', 'RoleB');
      const def = crewSequentialCrewai(w1, w2);
      const crew = def.nodes.find((n) => n.id === 'crew');
      if (crew) {
        crew.parameters = {
          ...crew.parameters,
          enableBuiltinTools: ['SerperDevTool'],
        };
      }
      const result = validateWorkflowDefinition(def, {
        crewaiRunnerConfigured: true,
        allowedCrewaiBuiltinTools: ['SerperDevTool'],
      });
      expect(result.warnings.some((w) => w.code === 'W1013')).toBe(false);
    });

    it('E1041 when enableBuiltinTools contains disallowed name', () => {
      const w1 = workerBundle('w1', 'A', 'RoleA');
      const w2 = workerBundle('w2', 'B', 'RoleB');
      const def = crewSequentialCrewai(w1, w2);
      const crew = def.nodes.find((n) => n.id === 'crew');
      if (crew) {
        crew.parameters = {
          ...crew.parameters,
          enableBuiltinTools: ['EvilTool'],
        };
      }
      const result = validateWorkflowDefinition(def, {
        crewaiRunnerConfigured: true,
        allowedCrewaiBuiltinTools: ['SerperDevTool'],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.some((e) => e.code === 'E1041')).toBe(true);
    });

    it('E1046 when crewaiProcess is consensual', () => {
      const w1 = workerBundle('w1', 'A', 'RoleA');
      const w2 = workerBundle('w2', 'B', 'RoleB');
      const def = crewSequentialCrewai(w1, w2);
      const crew = def.nodes.find((n) => n.id === 'crew');
      if (crew) {
        crew.parameters = {
          ...crew.parameters,
          crewaiProcess: 'consensual',
        };
      }
      const result = validateWorkflowDefinition(def, { crewaiRunnerConfigured: true });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.some((e) => e.code === 'E1046')).toBe(true);
    });

    it('W1012 when crew member has no role (warning only)', () => {
      const w1 = workerBundle('w1', 'A', 'RoleA');
      const w2 = workerBundle('w2', 'B', '');
      w2.nodes[0] = {
        ...w2.nodes[0]!,
        parameters: { goal: 'B' },
      };
      const result = validateWorkflowDefinition({
        ...base,
        nodes: [
          ...base.nodes,
          {
            id: 'crew',
            type: 'crewSequential',
            name: 'Crew',
            position: { x: 1, y: 0 },
            parameters: {},
          },
          ...w1.nodes,
          ...w2.nodes,
        ],
        connections: [
          { from: 't1', to: 'crew' },
          {
            from: 'w1',
            to: 'crew',
            fromOutput: 'crew_member',
            toInput: 'crew_member',
          },
          {
            from: 'w2',
            to: 'crew',
            fromOutput: 'crew_member',
            toInput: 'crew_member',
          },
          ...w1.connections,
          ...w2.connections,
        ],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.warnings.some((w) => w.code === 'W1012' && w.nodeId === 'w2')).toBe(
          true,
        );
      }
    });
  });

  describe('group chat validation (P4-E)', () => {
    it('E1048 when groupChat has fewer than two members', () => {
      const result = validateWorkflowDefinition({
        ...base,
        nodes: [
          ...base.nodes,
          {
            id: 'gc',
            type: 'groupChat',
            name: 'Chat',
            position: { x: 1, y: 0 },
            parameters: {},
          },
          {
            id: 'a1',
            type: 'aiAgent',
            name: 'A',
            position: { x: 0, y: 0 },
            parameters: {},
          },
        ],
        connections: [
          { from: 't1', to: 'gc' },
          { from: 'a1', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
        ],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.some((e) => e.code === 'E1048')).toBe(true);
    });
  });
});
