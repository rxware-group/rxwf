import { describe, expect, it, vi } from 'vitest';
import type { ToolDefinition } from '@rxwf/ai-runtime-stub';
import type { WorkflowDefinition } from '@rxwf/workflow';

const runSubagentTool = vi.hoisted(() => vi.fn(async () => 'sub-ok'));

vi.mock('./run-subagent-tool.js', () => ({
  runSubagentTool: runSubagentTool,
}));

import { createAgentHubInvokeTool } from './agent-hub-invoke-tool.js';

describe('createAgentHubInvokeTool', () => {
  it('routes subagent tools to runSubagentTool', async () => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 't',
      nodes: [
        {
          id: 'hub-1',
          type: 'skillRun',
          name: 'Skill',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'sub-1',
          type: 'toolSubagent',
          name: '子 Tool',
          position: { x: 0, y: 80 },
          parameters: {},
        },
      ],
      connections: [{ from: 'sub-1', to: 'hub-1', toInput: 'ai_tool' }],
    };

    const toolNodeByName = new Map(definition.nodes.map((n) => [n.name.trim(), n]));
    const invoke = createAgentHubInvokeTool({
      deps: { ai: { runAgent: vi.fn() } } as never,
      ctx: {
        config: {},
        workflowDefinition: definition,
        nodeId: 'hub-1',
        inputItems: [],
        subworkflowDepth: 0,
      },
      toolNodeByName,
      agentToolCtx: { scanRoots: ['/tmp'] },
    });

    const def: ToolDefinition = {
      name: '子 Tool',
      description: 'sub',
      parameters: { type: 'object', properties: {} },
      source: { type: 'subagent', hubNodeId: 'sub-1' },
    };

    const out = await invoke(def, { task: 'go' });
    expect(out).toEqual({ answer: 'sub-ok' });
    expect(runSubagentTool).toHaveBeenCalledOnce();
  });
});
