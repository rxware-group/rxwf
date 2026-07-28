/**
 * Phase 3 MCP skill_* tools — HTTP `/mcp/tools` (AC-S3).
 */
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AiRuntime } from '@rxwf/ai-runtime-stub';
import { createTestDb } from '@rxwf/providers-lite';
import { createAuthService, createUserService } from '@rxwf/identity';
import { buildApp } from '../app.js';
import {
  setSkillMcpBindings,
  SKILL_MCP_TOOL_NAMES,
} from '../mcp/skill-mcp-handlers.js';

const MCP_SKILL_ANSWER = 'mcp-skill-run-ok';

function createMockAi(): AiRuntime {
  return {
    async *chat() {
      yield MCP_SKILL_ANSWER;
    },
    async runAgent() {
      return { items: [{ json: { answer: MCP_SKILL_ANSWER } }] };
    },
  };
}

function writeMcpTestSkill(workspaceRoot: string, rel = 'mcp-test-skill'): void {
  const pkg = join(workspaceRoot, '.rxwf', 'skills', rel);
  mkdirSync(pkg, { recursive: true });
  writeFileSync(
    join(pkg, 'SKILL.md'),
    `---
name: ${rel}
description: MCP integration test skill
permissions:
  - filesystem:read
---

Run the skill for MCP tests.
`,
  );
}

describe('skill MCP integration (AC-S3)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let apiKey: string;
  let workspaceRoot: string;
  const mockAi = createMockAi();

  beforeAll(async () => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'rxwf-mcp-skill-'));
    writeMcpTestSkill(workspaceRoot);

    const db = await createTestDb();
    const built = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
      featurePlus: true,
      aiRuntime: mockAi,
    });
    app = built.app;

    setSkillMcpBindings({ ai: mockAi, defaultWorkspaceRoot: workspaceRoot });

    const users = createUserService(db);
    const auth = createAuthService(db);
    const admin = await users.createUser({
      email: 'mcp-skill@example.com',
      password: 'secret',
      role: 'admin',
    });
    apiKey = (await auth.createApiKey(admin.id, 'mcp-skill')).key;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const headers = () => ({ 'x-api-key': apiKey });

  it('lists skill_* tools on GET /mcp/tools', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/mcp/tools',
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { tools: Array<{ name: string }> };
    const names = body.tools.map((t) => t.name);
    for (const tool of SKILL_MCP_TOOL_NAMES) {
      expect(names).toContain(tool);
    }
  });

  it('skill_run executes via POST /mcp/tools/call (path skillId)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/mcp/tools/call',
      headers: headers(),
      payload: {
        name: 'skill_run',
        arguments: {
          skillId: 'mcp-test-skill',
          prompt: 'Execute for MCP test',
          workspaceRoot,
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    };
    expect(body.isError).not.toBe(true);
    const parsed = JSON.parse(body.content[0]!.text) as {
      answer: string;
      skillId: string;
    };
    expect(parsed.answer).toBe(MCP_SKILL_ANSWER);
    expect(parsed.skillId).toContain('mcp-test-skill');
  });

  it('skill_run uses registry id after /api/skills/scan', async () => {
    const scanRes = await app.inject({
      method: 'POST',
      url: '/api/skills/scan',
      headers: headers(),
      payload: { workspaceRoot },
    });
    expect(scanRes.statusCode).toBe(200);
    const scanned = scanRes.json() as { skillsFound: number };
    expect(scanned.skillsFound).toBeGreaterThan(0);

    const listRes = await app.inject({
      method: 'POST',
      url: '/mcp/tools/call',
      headers: headers(),
      payload: { name: 'skill_list', arguments: {} },
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json() as {
      content: Array<{ text: string }>;
    };
    const items = JSON.parse(listBody.content[0]!.text) as Array<{ id: string; slug: string }>;
    const row = items.find((s) => s.slug === 'mcp-test-skill');
    expect(row?.id).toBeTruthy();

    const runRes = await app.inject({
      method: 'POST',
      url: '/mcp/tools/call',
      headers: headers(),
      payload: {
        name: 'skill_run',
        arguments: {
          skillId: row!.id,
          prompt: 'Run by registry id',
          workspaceRoot,
        },
      },
    });
    expect(runRes.statusCode).toBe(200);
    const runBody = runRes.json() as {
      content: Array<{ text: string }>;
      isError?: boolean;
    };
    expect(runBody.isError).not.toBe(true);
    const parsed = JSON.parse(runBody.content[0]!.text) as { answer: string };
    expect(parsed.answer).toBe(MCP_SKILL_ANSWER);
  });

  it('skill_run returns error when prompt missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/mcp/tools/call',
      headers: headers(),
      payload: {
        name: 'skill_run',
        arguments: { skillId: 'mcp-test-skill', workspaceRoot },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      content: Array<{ text: string }>;
      isError?: boolean;
    };
    expect(body.isError).toBe(true);
    expect(body.content[0]!.text).toMatch(/E1040|skillId and prompt required/i);
  });
});
