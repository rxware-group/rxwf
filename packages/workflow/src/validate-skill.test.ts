import { describe, expect, it } from 'vitest';
import type { WorkflowDefinition } from '@rxwf/workflow';
import { validateWorkflowDefinition } from './validate.js';

function withChatModel(
  definition: WorkflowDefinition,
  skillNodeId: string,
): WorkflowDefinition {
  return {
    ...definition,
    nodes: [
      ...definition.nodes,
      {
        id: 'model-1',
        type: 'aiChatModel',
        name: 'Chat Model',
        position: { x: 0, y: 80 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
    ],
    connections: [
      ...definition.connections,
      { from: 'model-1', to: skillNodeId, toInput: 'ai_languageModel' },
    ],
  };
}

describe('validateSkillRunNodes', () => {
  it('errors E1040 when skill path missing', () => {
    const result = validateWorkflowDefinition({
      schemaVersion: 1,
      name: 't',
      nodes: [
        {
          id: 's1',
          type: 'skillRun',
          name: 'Skill',
          position: { x: 0, y: 0 },
          parameters: { skillSource: 'path' },
        },
      ],
      connections: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E1040')).toBe(true);
    }
  });

  it('errors E1066 for .cursor/skills path', () => {
    const result = validateWorkflowDefinition(
      withChatModel(
        {
          schemaVersion: 1,
          name: 't',
          nodes: [
            {
              id: 's1',
              type: 'skillRun',
              name: 'Skill',
              position: { x: 0, y: 0 },
              parameters: {
                skillSource: 'path',
                skillPath: '.cursor/skills/foo',
              },
            },
          ],
          connections: [],
        },
        's1',
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E1066')).toBe(true);
    }
  });

  it('errors E1043 when aiChatModel satellite missing', () => {
    const result = validateWorkflowDefinition({
      schemaVersion: 1,
      name: 't',
      nodes: [
        {
          id: 's1',
          type: 'skillRun',
          name: 'Skill',
          position: { x: 0, y: 0 },
          parameters: {
            skillSource: 'path',
            skillPath: 'demo',
          },
        },
      ],
      connections: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E1043')).toBe(true);
    }
  });

});

describe('validateWorkflowRunNodes', () => {
  it('E1076 when template missing workflowRelPath', () => {
    const result = validateWorkflowDefinition({
      schemaVersion: 1,
      name: 't',
      nodes: [
        {
          id: 'w1',
          type: 'workflow_run',
          name: 'W',
          position: { x: 0, y: 0 },
          parameters: { workflowSource: 'template' },
        },
      ],
      connections: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E1076')).toBe(true);
    }
  });
});
