import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SkillLoader } from '@rxwf/skill-runtime';
import { validateWorkflowDefinition } from '@rxwf/workflow';

describe('skill P1 integration (AC-S1)', () => {
  it('loads nested .rxwf/skills/team/ops/foo (AC-S1c)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rxwf-nested-'));
    const pkg = join(root, '.rxwf', 'skills', 'team', 'ops', 'foo');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, 'SKILL.md'),
      '---\nname: foo\npermissions:\n  - filesystem:read\n---\n\nNested skill.\n',
    );
    const loader = new SkillLoader({ workspaceRoot: root });
    const ir = await loader.loadFromPath('.rxwf/skills/team/ops/foo');
    expect(ir.skillRelPath).toBe('team/ops/foo');
  });

  it('validate accepts registry source with skillId and chat model', () => {
    const result = validateWorkflowDefinition({
      schemaVersion: 1,
      name: 't',
      nodes: [
        {
          id: 's1',
          type: 'skillRun',
          name: 'S',
          position: { x: 0, y: 0 },
          parameters: {
            skillSource: 'registry',
            skillId: 'abc-123',
          },
        },
        {
          id: 'm1',
          type: 'aiChatModel',
          name: 'Model',
          position: { x: 0, y: 80 },
          parameters: { provider: 'ollama', model: 'm' },
        },
      ],
      connections: [{ from: 'm1', to: 's1', toInput: 'ai_languageModel' }],
    });
    expect(result.ok).toBe(true);
  });

  it('validate rejects registry source without chat model (E1043)', () => {
    const result = validateWorkflowDefinition({
      schemaVersion: 1,
      name: 't',
      nodes: [
        {
          id: 's1',
          type: 'skillRun',
          name: 'S',
          position: { x: 0, y: 0 },
          parameters: {
            skillSource: 'registry',
            skillId: 'abc-123',
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

  it('validate rejects .cursor/skills (E1066)', () => {
    const result = validateWorkflowDefinition({
      schemaVersion: 1,
      name: 't',
      nodes: [
        {
          id: 's1',
          type: 'skillRun',
          name: 'S',
          position: { x: 0, y: 0 },
          parameters: {
            skillSource: 'path',
            skillPath: '.cursor/skills/x',
          },
        },
      ],
      connections: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E1066')).toBe(true);
    }
  });
});
