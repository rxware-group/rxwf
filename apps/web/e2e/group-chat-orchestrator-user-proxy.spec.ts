import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E Group Chat orchestrator + UserProxy — M-4 T-095 (AC-039 / AC-040) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const orchestratorTemplatePath = path.join(
  repoRoot,
  'fixtures/templates/agent-group-chat-orchestrator.json',
);

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

type ExecutionDetail = {
  status: string;
  nodeRuns: Array<{
    nodeId: string;
    nodeType: string;
    status: string;
    metadata?: Record<string, unknown>;
    outputData?: unknown;
  }>;
};

function loadOrchestratorTemplate(): WorkflowDefinition {
  const raw = JSON.parse(readFileSync(orchestratorTemplatePath, 'utf8')) as WorkflowDefinition;
  return {
    ...raw,
    name: `Group Chat Orchestrator UserProxy ${Date.now()}`,
  };
}

function orchestratorUserProxyDefinition(name: string): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name,
    settings: { workflowKind: 'agent' },
    nodes: [
      {
        id: 'tr',
        type: 'manualTrigger',
        name: 'Manual',
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'gc',
        type: 'groupChat',
        name: 'Group Chat',
        position: { x: 240, y: 0 },
        parameters: {
          maxRounds: 2,
          speakerSelection: 'orchestrator',
          orchestratorProvider: 'ollama',
          orchestratorModel: 'llama3',
          terminationKeywords: 'TERMINATE,FINISH,完成',
          returnTranscript: true,
          userProxyEnabled: true,
          userProxyEveryNRounds: 2,
          userProxyPrompt: '请输入纠偏或补充…',
        },
      },
      {
        id: 'a1',
        type: 'aiAgent',
        name: 'Analyst',
        position: { x: 0, y: 120 },
        parameters: { role: 'Analyst', goal: 'Analyze deployment options' },
      },
      {
        id: 'a2',
        type: 'aiAgent',
        name: 'Reviewer',
        position: { x: 160, y: 120 },
        parameters: { role: 'Reviewer', goal: 'Review risks' },
      },
      {
        id: 'm1',
        type: 'aiChatModel',
        name: 'Model 1',
        position: { x: 0, y: 220 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 'm2',
        type: 'aiChatModel',
        name: 'Model 2',
        position: { x: 160, y: 220 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
    ],
    connections: [
      { from: 'tr', to: 'gc' },
      { from: 'a1', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
      { from: 'a2', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
      { from: 'm1', to: 'a1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 'm2', to: 'a2', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
    ],
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

function transcriptFromNodeRun(
  nodeRun: ExecutionDetail['nodeRuns'][number] | undefined,
): Array<{ author?: string; role?: string; content?: string }> {
  const output = nodeRun?.outputData as
    | Array<Array<{ json?: { transcript?: unknown } }>>
    | null
    | undefined;
  const transcript = output?.[0]?.[0]?.json?.transcript;
  return Array.isArray(transcript) ? (transcript as Array<{ author?: string; role?: string; content?: string }>) : [];
}

test.describe('groupChat orchestrator + UserProxy @any', () => {
  test('orchestrator template validates with UserProxy enabled (lite mock)', async ({ request }) => {
    const definition = loadOrchestratorTemplate();
    const workflowId = await createWorkflow(request, definition);

    const res = await request.post(`/api/workflows/${workflowId}/validate`, {
      data: { definition },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    const gcNode = definition.nodes.find((n) => n.id === 'gc');
    expect(gcNode?.parameters.speakerSelection).toBe('orchestrator');
    expect(gcNode?.parameters.userProxyEnabled).toBe(true);
  });

  test('panel shows orchestrator and UserProxy parameters', async ({ page, request }) => {
    const definition = orchestratorUserProxyDefinition(
      `Group Chat orchestrator UserProxy panel ${Date.now()}`,
    );
    const workflowId = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await page.getByTestId('rf__node-gc').dblclick({ force: true });

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '发言策略' })).toBeVisible();
    await expect(
      modal.locator('.rxwf-form-field-label', { hasText: '启用 UserProxy' }),
    ).toBeVisible();
    await expect(
      modal.locator('.rxwf-form-field-label', { hasText: 'Orchestrator 模型' }),
    ).toBeVisible();
  });
});

test.describe('groupChat orchestrator + UserProxy @plus', () => {
  test.setTimeout(180_000);

  test('UserProxy pauses orchestrator group chat then resumes with user supplement', async ({
    request,
  }) => {
    const ollamaUp = await isOllamaReachable(request);
    test.skip(!ollamaUp, 'Ollama endpoint not reachable; skip live orchestrator UserProxy E2E');

    const definition = orchestratorUserProxyDefinition(
      `Group Chat orchestrator UserProxy run ${Date.now()}`,
    );
    const workflowId = await createWorkflow(request, definition);

    const runRes = await request.post(`/api/workflows/${workflowId}/executions`, {
      data: { mode: 'manual', environment: 'test' },
    });
    expect(runRes.ok()).toBeTruthy();
    const { executionId, status } = (await runRes.json()) as {
      executionId: string;
      status: string;
    };
    expect(status).toBe('waiting');

    const detailRes = await request.get(`/api/executions/${executionId}`);
    expect(detailRes.ok()).toBeTruthy();
    const detail = (await detailRes.json()) as ExecutionDetail;
    expect(detail.status).toBe('waiting');

    const waitingRun = detail.nodeRuns.find((nr) => nr.nodeId === 'gc');
    expect(waitingRun?.status).toBe('waiting');
    expect(waitingRun?.nodeType).toBe('groupChat');

    const hitl = waitingRun?.metadata?.hitl as
      | { allowSupplement?: boolean; prompt?: string }
      | undefined;
    expect(hitl?.allowSupplement).toBe(true);
    expect(hitl?.prompt).toContain('纠偏');

    const checkpoint = (
      waitingRun?.metadata?.groupChat as { checkpoint?: { transcript?: unknown[] } } | undefined
    )?.checkpoint;
    expect(Array.isArray(checkpoint?.transcript)).toBe(true);
    expect((checkpoint?.transcript ?? []).length).toBeGreaterThanOrEqual(1);

    const resumeRes = await request.post(`/api/executions/${executionId}/hitl/resume`, {
      data: {
        nodeId: 'gc',
        decision: 'approve',
        supplement: 'Please focus on security risks for on-prem deployment',
      },
    });
    expect(resumeRes.ok()).toBeTruthy();
    const resumed = (await resumeRes.json()) as { status: string };
    expect(resumed.status).toBe('success');

    const afterRes = await request.get(`/api/executions/${executionId}`);
    expect(afterRes.ok()).toBeTruthy();
    const after = (await afterRes.json()) as ExecutionDetail;
    expect(after.status).toBe('success');

    const gcRuns = after.nodeRuns.filter((nr) => nr.nodeId === 'gc');
    const finalRun = gcRuns.at(-1);
    expect(finalRun?.status).toBe('success');

    const transcript = transcriptFromNodeRun(finalRun);
    expect(
      transcript.some(
        (m) =>
          (m.role === 'user' || m.author === 'User') &&
          String(m.content ?? '').includes('security'),
      ),
    ).toBe(true);

    const agentSteps = finalRun?.metadata?.agentSteps as
      | Array<{ output?: { type?: string } }>
      | undefined;
    expect(
      agentSteps?.some((s) => s.output?.type === 'groupChatTurn') ?? false,
    ).toBe(true);
  });
});
