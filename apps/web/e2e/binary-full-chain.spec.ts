import { test, expect } from '@playwright/test';

/**
 * E2E-P-014 / AC-052 — Binary upload / download / expression full chain (M-5 / standard)
 *
 * Matrix: docs/test/e2e-coverage-matrix.md · row E2E-P-014
 * Scenarios: AC-048 download · AC-049 upload · AC-050 expression · AC-052 full chain
 */

export const SPEC_FILE = 'binary-full-chain.spec.ts';
export const MATRIX_ROW_ID = 'E2E-P-014';

export const REQUIRED_SCENARIO_TAGS = [
  'AC-048',
  'AC-049',
  'AC-050',
  'AC-052',
] as const;

/** Flip to true when all @standard scenarios pass (T-111 Green). */
export const BINARY_FULL_CHAIN_E2E_GREEN = true;

type BinaryAttachment = {
  data: string;
  mimeType: string;
  fileName?: string;
  fileSize?: number;
};

type WorkflowItem = {
  json: Record<string, unknown>;
  binary?: Record<string, BinaryAttachment>;
};

type WorkflowDefinition = {
  schemaVersion: number;
  name: string;
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
    outputIndex?: number;
  }>;
};

type DebugNodeResponse = {
  status: string;
  nodeResults?: Record<
    string,
    {
      status: string;
      outputItems?: WorkflowItem[][];
      errorCode?: string;
      errorMessage?: string;
    }
  >;
};

type ExecutionDetail = {
  status: string;
  nodeRuns?: Array<{
    nodeId: string;
    status: string;
    outputData?: WorkflowItem[][] | null;
  }>;
};

/** Minimal 1×1 PNG (valid header) for stubbed pinData / assertions. */
export const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export function samplePngBinary(key = 'data'): Record<string, BinaryAttachment> {
  const bytes = Buffer.from(SAMPLE_PNG_BASE64, 'base64');
  return {
    [key]: {
      data: SAMPLE_PNG_BASE64,
      mimeType: 'image/png',
      fileName: 'pixel.png',
      fileSize: bytes.length,
    },
  };
}

function uniqueName(base: string): string {
  return `${base} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createWorkflow(
  request: import('@playwright/test').APIRequestContext,
  definition: WorkflowDefinition,
): Promise<string> {
  const name = uniqueName(definition.name);
  const res = await request.post('/api/workflows', {
    data: { name, definition: { ...definition, name } },
  });
  if (!res.ok()) {
    throw new Error(`createWorkflow failed (${res.status()}): ${await res.text()}`);
  }
  return ((await res.json()) as { id: string }).id;
}

async function debugTargetNode(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
  targetNodeId: string,
  pinData?: Record<string, WorkflowItem[]>,
  pinBranchData?: Record<string, WorkflowItem[][]>,
): Promise<DebugNodeResponse> {
  const res = await request.post('/api/workflows/debug-node', {
    data: {
      workflowId,
      definition,
      targetNodeId,
      pinData,
      pinBranchData,
      environment: 'test',
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as DebugNodeResponse;
}

async function waitForExecution(
  request: import('@playwright/test').APIRequestContext,
  executionId: string,
  timeoutMs = 30_000,
): Promise<ExecutionDetail> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await request.get(`/api/executions/${executionId}`);
    expect(res.ok()).toBeTruthy();
    const detail = (await res.json()) as ExecutionDetail;
    if (detail.status !== 'running' && detail.status !== 'queued') {
      return detail;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`execution ${executionId} did not finish within ${timeoutMs}ms`);
}

function firstItem(
  response: DebugNodeResponse,
  nodeId: string,
): WorkflowItem | undefined {
  return response.nodeResults?.[nodeId]?.outputItems?.[0]?.[0];
}

/** httpbin echoes binary POST bodies as data URIs; strip prefix for byte comparison. */
function stripDataUriBase64(value: string | undefined): string {
  if (!value) return '';
  const match = /^data:[^;]+;base64,(.+)$/s.exec(value);
  return match ? match[1]! : value;
}

function httpDownloadWorkflow(): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'Binary HTTP download E2E',
    nodes: [
      {
        id: 't1',
        type: 'manualTrigger',
        name: 'Manual',
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'http1',
        type: 'httpRequest',
        name: 'HTTP',
        position: { x: 220, y: 0 },
        parameters: {
          url: 'https://httpbin.org/image/png',
          method: 'GET',
          sendHeaders: false,
          sendQuery: false,
          sendBody: false,
          responseBinaryMode: 'auto',
        },
      },
    ],
    connections: [{ from: 't1', to: 'http1' }],
  };
}

function webhookUploadWorkflow(hookPath: string): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'Binary Webhook upload E2E',
    nodes: [
      {
        id: 'wh1',
        type: 'webhookTrigger',
        name: 'Webhook',
        position: { x: 0, y: 0 },
        parameters: { path: hookPath, authMode: 'none' },
      },
    ],
    connections: [],
  };
}

function expressionChainWorkflow(): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'Binary expression chain E2E',
    nodes: [
      {
        id: 't1',
        type: 'manualTrigger',
        name: 'Manual',
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'if1',
        type: 'if',
        name: 'IF',
        position: { x: 220, y: 0 },
        parameters: {
          condition: '{{ $binary.data.mimeType === "image/png" }}',
        },
      },
      {
        id: 'set1',
        type: 'set',
        name: 'Set',
        position: { x: 440, y: 0 },
        parameters: {
          mode: 'expression',
          fields: {
            fileName: '{{ $binary.data.fileName }}',
            tag: 'binary-e2e',
          },
        },
      },
    ],
    connections: [
      { from: 't1', to: 'if1' },
      { from: 'if1', to: 'set1', fromOutput: 'true', outputIndex: 0 },
    ],
  };
}

function fullChainWorkflow(hookPath: string): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'Binary full chain E2E',
    nodes: [
      {
        id: 'wh1',
        type: 'webhookTrigger',
        name: 'Webhook',
        position: { x: 0, y: 0 },
        parameters: { path: hookPath, authMode: 'none' },
      },
      {
        id: 'if1',
        type: 'if',
        name: 'IF',
        position: { x: 220, y: 0 },
        parameters: {
          condition: '{{ $binary.file.mimeType === "text/plain" }}',
        },
      },
      {
        id: 'set1',
        type: 'set',
        name: 'Set',
        position: { x: 440, y: 0 },
        parameters: {
          mode: 'expression',
          fields: {
            uploaded: '{{ $binary.file.fileName }}',
            chain: 'ac-052',
          },
        },
      },
    ],
    connections: [
      { from: 'wh1', to: 'if1' },
      { from: 'if1', to: 'set1', fromOutput: 'true', outputIndex: 0 },
    ],
  };
}

test.describe('Binary full chain E2E-P-014', () => {
  test('@any documents matrix row and scenario coverage', () => {
    expect(MATRIX_ROW_ID).toBe('E2E-P-014');
    expect(REQUIRED_SCENARIO_TAGS).toEqual(['AC-048', 'AC-049', 'AC-050', 'AC-052']);
    expect(SPEC_FILE).toBe('binary-full-chain.spec.ts');
  });

  test('@standard AC-052 gate — flip BINARY_FULL_CHAIN_E2E_GREEN when all scenarios pass', () => {
    expect(
      BINARY_FULL_CHAIN_E2E_GREEN,
      'Set BINARY_FULL_CHAIN_E2E_GREEN=true after upload/download/expression scenarios green',
    ).toBe(true);
  });

  test.describe('AC-048 HTTP download → binary @standard', () => {
    test('debug-node stores PNG response in item.binary when responseBinaryMode is auto', async ({
      request,
    }) => {
      const definition = httpDownloadWorkflow();
      const workflowId = await createWorkflow(request, definition);
      const result = await debugTargetNode(request, workflowId, definition, 'http1');

      expect(result.status).toBe('success');
      const item = firstItem(result, 'http1');
      expect(item?.binary?.data?.mimeType).toBe('image/png');
      expect(item?.binary?.data?.data).toBeTruthy();
      expect(item?.json.body).toBeUndefined();
      expect(item?.json.statusCode).toBe(200);
    });
  });

  test.describe('AC-049 Webhook multipart upload → binary @standard', () => {
    test('webhook-test accepts multipart and exposes binary on trigger output', async ({
      request,
    }) => {
      const hookPath = `binary-upload-${Date.now()}`;
      const definition = webhookUploadWorkflow(hookPath);
      const workflowId = await createWorkflow(request, definition);

      const triggerRes = await request.post(`/webhook-test/${workflowId}/${hookPath}`, {
        multipart: {
          note: 'e2e-binary-upload',
          file: {
            name: 'report.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('report-body'),
          },
        },
      });

      expect(
        triggerRes.status(),
        'AC-049 requires webhook multipart ingress (T-108 route content-type parser)',
      ).toBe(202);

      const body = (await triggerRes.json()) as { executionId: string };
      expect(body.executionId).toBeTruthy();

      const detail = await waitForExecution(request, body.executionId);
      expect(detail.status).toBe('success');

      const whRun = detail.nodeRuns?.find((run) => run.nodeId === 'wh1');
      expect(whRun?.status).toBe('success');
      const output = whRun?.outputData?.[0]?.[0];
      expect(output?.json).toMatchObject({ note: 'e2e-binary-upload' });
      expect(output?.binary?.file?.mimeType).toBe('text/plain');
      expect(output?.binary?.file?.fileName).toBe('report.txt');
      expect(Buffer.from(output!.binary!.file.data, 'base64').toString()).toBe('report-body');
    });
  });

  test.describe('AC-050 Expression $binary read/write @standard', () => {
    test('IF routes items when $binary.data.mimeType matches (stubbed pinData)', async ({
      request,
    }) => {
      const definition = expressionChainWorkflow();
      const workflowId = await createWorkflow(request, definition);
      const result = await debugTargetNode(request, workflowId, definition, 'if1', {
        t1: [
          { json: { id: 1 }, binary: samplePngBinary() },
          { json: { id: 2 }, binary: { data: { data: 'eA==', mimeType: 'text/plain' } } },
        ],
      });

      expect(result.status).toBe('success');
      const ifOut = result.nodeResults?.if1?.outputItems;
      expect(ifOut?.[0]).toHaveLength(1);
      expect(ifOut?.[0]?.[0]?.json.id).toBe(1);
      expect(ifOut?.[1]).toHaveLength(1);
      expect(ifOut?.[1]?.[0]?.json.id).toBe(2);
    });

    test('Set preserves binary and resolves $binary.data.fileName (stubbed pinData)', async ({
      request,
    }) => {
      const definition = expressionChainWorkflow();
      const workflowId = await createWorkflow(request, definition);
      const result = await debugTargetNode(
        request,
        workflowId,
        definition,
        'set1',
        { t1: [{ json: { id: 1 }, binary: samplePngBinary() }] },
        { if1: [[{ json: { id: 1 }, binary: samplePngBinary() }], []] },
      );

      expect(result.status).toBe('success');
      const item = firstItem(result, 'set1');
      expect(item?.json).toMatchObject({
        id: 1,
        fileName: 'pixel.png',
        tag: 'binary-e2e',
      });
      expect(item?.binary?.data?.mimeType).toBe('image/png');
    });

    test('HTTP upload sends item binary when bodyContentType is binaryFromItem (stubbed pinData)', async ({
      request,
    }) => {
      const definition: WorkflowDefinition = {
        schemaVersion: 1,
        name: 'Binary HTTP upload E2E',
        nodes: [
          {
            id: 't1',
            type: 'manualTrigger',
            name: 'Manual',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'http1',
            type: 'httpRequest',
            name: 'HTTP',
            position: { x: 220, y: 0 },
            parameters: {
              url: 'https://httpbin.org/post',
              method: 'POST',
              sendBody: true,
              bodyContentType: 'binaryFromItem',
              binaryBodyPropertyName: 'data',
            },
          },
        ],
        connections: [{ from: 't1', to: 'http1' }],
      };

      const workflowId = await createWorkflow(request, definition);
      const result = await debugTargetNode(request, workflowId, definition, 'http1', {
        t1: [{ json: {}, binary: samplePngBinary() }],
      });

      expect(result.status).toBe('success');
      const item = firstItem(result, 'http1');
      expect(item?.json.statusCode).toBe(200);
      const postedBody = (item?.json.body as { data?: string } | undefined)?.data;
      expect(stripDataUriBase64(postedBody)).toBe(SAMPLE_PNG_BASE64);
    });
  });

  test.describe('AC-052 Full chain upload → expression → passthrough @standard', () => {
    test('webhook multipart → IF $binary → Set preserves attachment end-to-end', async ({
      request,
    }) => {
      const hookPath = `binary-chain-${Date.now()}`;
      const definition = fullChainWorkflow(hookPath);
      const workflowId = await createWorkflow(request, definition);

      const triggerRes = await request.post(`/webhook-test/${workflowId}/${hookPath}`, {
        multipart: {
          note: 'full-chain',
          file: {
            name: 'chain.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('chain-body'),
          },
        },
      });

      expect(
        triggerRes.status(),
        'AC-052 live chain requires webhook multipart ingress wired through execution engine',
      ).toBe(202);

      const body = (await triggerRes.json()) as { executionId: string };
      const detail = await waitForExecution(request, body.executionId);
      expect(detail.status).toBe('success');

      const setRun = detail.nodeRuns?.find((run) => run.nodeId === 'set1');
      expect(setRun?.status).toBe('success');
      const item = setRun?.outputData?.[0]?.[0];
      expect(item?.json).toMatchObject({
        note: 'full-chain',
        uploaded: 'chain.txt',
        chain: 'ac-052',
      });
      expect(item?.binary?.file?.mimeType).toBe('text/plain');
      expect(Buffer.from(item!.binary!.file.data, 'base64').toString()).toBe('chain-body');
    });
  });
});
