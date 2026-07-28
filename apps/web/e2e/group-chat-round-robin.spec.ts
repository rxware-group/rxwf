import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** AC-039 / AC-E2 — Group Chat round-robin E2E (M-4 / plus) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TEMPLATE_PATH = path.join(repoRoot, 'fixtures/templates/agent-group-chat-round-robin.json');
const SPEC_FILE = 'group-chat-round-robin.spec.ts';

type WorkflowDefinition = {
  schemaVersion: number;
  name: string;
  settings?: { workflowKind?: string };
  nodes: Array<{
    id: string;
    type: string;
    name: string;
    position: { x: number; y: number };
    parameters: Record<string, unknown>;
  }>;
  connections: Array<{
    from: string;
    to: string;
    fromOutput?: string;
    toInput?: string;
  }>;
};

type TranscriptMessage = {
  author: string;
  authorNodeId?: string;
  content?: string;
  round?: number;
};

type DebugNodeResponse = {
  status: string;
  nodeResults?: Record<
    string,
    {
      status: string;
      outputItems?: Array<Array<{ json: Record<string, unknown> }>>;
      errorCode?: string;
      errorMessage?: string;
      metadata?: Record<string, unknown>;
    }
  >;
};

function loadRoundRobinTemplate(): WorkflowDefinition {
  const raw = readFileSync(TEMPLATE_PATH, 'utf8');
  const parsed = JSON.parse(raw) as WorkflowDefinition & { category?: string; description?: string };
  const { category: _c, description: _d, ...definition } = parsed;
  return definition;
}

function roundRobinDefinition(options?: {
  maxRounds?: number;
  name?: string;
}): WorkflowDefinition {
  const definition = loadRoundRobinTemplate();
  const gcNode = definition.nodes.find((node) => node.id === 'gc');
  if (!gcNode) {
    throw new Error('round-robin template missing groupChat node "gc"');
  }
  gcNode.parameters = {
    ...gcNode.parameters,
    maxRounds: options?.maxRounds ?? 4,
    speakerSelection: 'roundRobin',
  };
  return {
    ...definition,
    name: options?.name ?? `Group Chat round-robin AC-039 ${Date.now()}`,
  };
}

async function createWorkflow(
  request: import('@playwright/test').APIRequestContext,
  definition: WorkflowDefinition,
) {
  const res = await request.post('/api/workflows', {
    data: { name: definition.name, definition },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`createWorkflow failed (${res.status()}): ${body}`);
  }
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function debugGroupChatNode(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
  nodeId: string,
): Promise<DebugNodeResponse> {
  const res = await request.post('/api/workflows/debug-node', {
    data: {
      workflowId,
      definition,
      targetNodeId: nodeId,
      environment: 'test',
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as DebugNodeResponse;
}

async function isOllamaReachable(
  request: import('@playwright/test').APIRequestContext,
): Promise<boolean> {
  try {
    const res = await request.get('/api/models/providers');
    if (!res.ok()) return false;
    const body = (await res.json()) as {
      providers?: Array<{ kind?: string; enabled?: boolean; baseUrl?: string }>;
    };
    const ollama = body.providers?.find((p) => p.kind === 'ollama' && p.enabled);
    if (!ollama?.baseUrl?.trim()) return false;
    const ping = await fetch(`${ollama.baseUrl.replace(/\/$/, '')}/api/tags`, {
      signal: AbortSignal.timeout(3_000),
    });
    return ping.ok;
  } catch {
    return false;
  }
}

function expectAlternatingAuthors(authors: string[], first: string, second: string) {
  expect(authors.length).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < authors.length; i += 1) {
    expect(authors[i]).toBe(i % 2 === 0 ? first : second);
  }
}

test.describe('groupChat round-robin AC-039 @any', () => {
  test('round-robin template defines Analyst, Reviewer, and speakerSelection roundRobin', () => {
    const definition = loadRoundRobinTemplate();
    const gc = definition.nodes.find((node) => node.id === 'gc');
    const agents = definition.nodes.filter((node) => node.type === 'aiAgent');

    expect(gc?.parameters.speakerSelection).toBe('roundRobin');
    expect(agents.map((node) => node.name).sort()).toEqual(['Analyst', 'Reviewer']);
    expect(
      definition.connections.filter(
        (edge) => edge.toInput === 'group_member' && edge.to === 'gc',
      ).length,
    ).toBeGreaterThanOrEqual(2);
  });

  test('editor renders round-robin group chat workflow from template', async ({ page, request }) => {
    const definition = roundRobinDefinition({ maxRounds: 2 });
    const workflowId = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await expect(
      canvas.locator('.workflow-node-caption-title').filter({ hasText: /^Group Chat$/ }),
    ).toHaveCount(1);
    await expect(
      canvas.locator('.workflow-node-caption-title').filter({ hasText: /^Analyst$/ }),
    ).toHaveCount(1);
    await expect(
      canvas.locator('.workflow-node-caption-title').filter({ hasText: /^Reviewer$/ }),
    ).toHaveCount(1);

    await page.getByTestId('rf__node-gc').dblclick({ force: true });
    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '发言策略' })).toBeVisible();
  });
});

test.describe('groupChat round-robin AC-E2 @plus', () => {
  test('debug-node completes round-robin with alternating Analyst and Reviewer (AC-035)', async ({
    request,
  }) => {
    const ollamaUp = await isOllamaReachable(request);
    test.skip(!ollamaUp, 'Ollama endpoint not reachable; skip live round-robin E2E');

    const definition = roundRobinDefinition({ maxRounds: 4 });
    const workflowId = await createWorkflow(request, definition);
    const result = await debugGroupChatNode(request, workflowId, definition, 'gc');

    expect(result.status).toBe('success');
    const gcResult = result.nodeResults?.gc;
    expect(gcResult?.status).toBe('success');

    const json = gcResult?.outputItems?.[0]?.[0]?.json ?? {};
    const transcript = (json.transcript ?? []) as TranscriptMessage[];
    expect(transcript.length).toBeGreaterThanOrEqual(2);

    const authors = transcript.map((entry) => entry.author);
    expectAlternatingAuthors(authors, 'Analyst', 'Reviewer');

    const agentSteps = gcResult?.metadata?.agentSteps as
      | Array<{ output?: { type?: string; speaker?: string } }>
      | undefined;
    const turns = agentSteps?.filter((step) => step.output?.type === 'groupChatTurn') ?? [];
    expect(turns.length).toBeGreaterThanOrEqual(2);
    expect(turns.map((step) => step.output?.speaker)).toEqual(authors);
  });

  test('fixture template agent-group-chat-round-robin runs at least 2 rounds (AC-E2)', async ({
    request,
  }) => {
    const ollamaUp = await isOllamaReachable(request);
    test.skip(!ollamaUp, 'Ollama endpoint not reachable; skip live round-robin E2E');

    const definition = roundRobinDefinition({ maxRounds: 2, name: SPEC_FILE });
    const workflowId = await createWorkflow(request, definition);
    const result = await debugGroupChatNode(request, workflowId, definition, 'gc');

    expect(result.status).toBe('success');
    const gcResult = result.nodeResults?.gc;
    expect(gcResult?.status).toBe('success');

    const transcript = (gcResult?.outputItems?.[0]?.[0]?.json?.transcript ??
      []) as TranscriptMessage[];
    expect(transcript.length).toBeGreaterThanOrEqual(2);
    expect(transcript[0]?.author).toBe('Analyst');
    expect(transcript[1]?.author).toBe('Reviewer');
  });
});
