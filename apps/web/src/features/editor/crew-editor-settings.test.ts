import { describe, expect, it } from 'vitest';
import {
  getNodePortsEditorOptions,
  isCrewEditorEnabled,
  isCrewPaletteNodeType,
} from './crew-editor-settings.js';
import { getNodePorts } from './node-port-defs.js';

describe('isCrewEditorEnabled', () => {
  it('defaults automation workflows to disabled', () => {
    expect(isCrewEditorEnabled({ workflowKind: 'automation' })).toBe(false);
  });

  it('defaults agent workflows to enabled', () => {
    expect(isCrewEditorEnabled({ workflowKind: 'agent' })).toBe(true);
    expect(isCrewEditorEnabled({})).toBe(true);
  });

  it('respects explicit enableCrew override', () => {
    expect(isCrewEditorEnabled({ workflowKind: 'agent', enableCrew: false })).toBe(false);
    expect(isCrewEditorEnabled({ workflowKind: 'automation', enableCrew: true })).toBe(true);
  });
});

describe('getNodePorts with enableCrew', () => {
  it('hides aiAgent crew resource outputs when disabled', () => {
    const ports = getNodePorts('aiAgent', {}, { enableCrew: false });
    expect(ports.resourceOutputs ?? []).toHaveLength(0);
    expect(ports.resourceInputs?.some((p) => p.id === 'ai_languageModel')).toBe(true);
  });

  it('shows aiAgent crew resource outputs when enabled', () => {
    const ports = getNodePorts('aiAgent', {}, { enableCrew: true });
    expect(ports.resourceOutputs?.map((p) => p.id)).toEqual([
      'crew_member',
      'crew_manager',
      'group_member',
      'group_orchestrator',
    ]);
  });
});

describe('isCrewPaletteNodeType', () => {
  it('hides crew orchestration types when disabled', () => {
    expect(isCrewPaletteNodeType('crewSequential', false)).toBe(false);
    expect(isCrewPaletteNodeType('groupChat', false)).toBe(false);
    expect(isCrewPaletteNodeType('aiAgent', false)).toBe(true);
  });
});

describe('getNodePortsEditorOptions', () => {
  it('mirrors isCrewEditorEnabled', () => {
    expect(getNodePortsEditorOptions({ workflowKind: 'automation' })).toEqual({
      enableCrew: false,
    });
  });
});
