import { describe, expect, it, afterAll, beforeAll } from 'vitest';
import { createAuthService, createUserService } from '@rxwf/identity';
import { createLiteWorkflowRepository, createTestDb } from '@rxwf/providers-lite';
import { createWorkflowService } from '@rxwf/workflow';
import { parseWebhookBody } from '../webhook/parse-webhook-body.js';
import { parseWebhookMultipartBody } from '../../../../packages/node-runner/src/executors/triggers/webhook-binary.js';
import { buildApp } from '../app.js';
import { createApiTriggerIngress } from '../trigger/create-trigger-ingress.js';
import {
  createExecutionRuntime,
  type ExecutionRuntime,
} from '../execution/create-execution-runtime.js';

function buildMultipartRaw(
  boundary: string,
  parts: Array<{ headers: string[]; body: string }>,
): { rawBody: Buffer; contentType: string } {
  const chunks = parts.flatMap((part) => [
    `--${boundary}`,
    ...part.headers,
    '',
    part.body,
  ]);
  chunks.push(`--${boundary}--`, '');
  const rawBody = Buffer.from(chunks.join('\r\n'));
  return {
    rawBody,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe('Webhook multipart → binary (AC-049 / BIN-09 verify)', () => {
  describe('parseWebhookBody vs node-runner webhook-binary (CONF-05)', () => {
    it('maps form field names to binary keys consistently', () => {
      const boundary = '----rxwf-parity';
      const { rawBody, contentType } = buildMultipartRaw(boundary, [
        {
          headers: ['Content-Disposition: form-data; name="title"'],
          body: 'hello',
        },
        {
          headers: [
            'Content-Disposition: form-data; name="upload"; filename="a.txt"',
            'Content-Type: text/plain',
          ],
          body: 'file-content',
        },
      ]);

      const apiItems = parseWebhookBody({ rawBody, contentType });
      const runnerItems = parseWebhookMultipartBody(rawBody, contentType);
      expect(runnerItems).toEqual(apiItems);
      expect(apiItems[0]?.json).toEqual({ title: 'hello' });
      expect(apiItems[0]?.binary?.upload?.fileName).toBe('a.txt');
      expect(Buffer.from(apiItems[0]!.binary!.upload.data, 'base64').toString()).toBe(
        'file-content',
      );
    });
  });

  describe('execution pipeline preserves multipart binary inputItems', () => {
    let app: Awaited<ReturnType<typeof buildApp>>['app'];
    let db: Awaited<ReturnType<typeof buildApp>>['db'];
    let workflowId: string;
    let headers: Record<string, string>;

    let runtime: ExecutionRuntime;

    beforeAll(async () => {
      db = await createTestDb();
      runtime = await createExecutionRuntime(db, { os: 'linux', arch: 'x64' });
      const built = await buildApp({
        db,
        disableScheduler: true,
        disableJobProcessor: true,
      });
      app = built.app;
      const users = createUserService(db);
      const auth = createAuthService(db);
      const user = await users.createUser({
        email: `wh-binary-${crypto.randomUUID()}@example.com`,
        password: 'secret1234',
        role: 'admin',
      });
      headers = { 'x-api-key': (await auth.createApiKey(user.id, 'wh-binary')).key };

      const workflows = createWorkflowService(createLiteWorkflowRepository(db));
      const created = await workflows.create({
        name: 'Webhook Binary Upload',
        definition: {
          schemaVersion: 1,
          name: 'Webhook Binary Upload',
          nodes: [
            {
              id: 'wh-bin',
              type: 'webhookTrigger',
              name: 'Hook',
              position: { x: 0, y: 0 },
              parameters: { path: 'upload', authMode: 'none' },
            },
          ],
          connections: [],
        },
      });
      workflowId = created.id;
      await workflows.publish(workflowId, user.id);
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
      await runtime.close?.();
    });

    it('POST /webhook-test accepts multipart/form-data without 415 (AC-049 ingress)', async () => {
      const boundary = '----rxwf-route-multipart';
      const { rawBody, contentType } = buildMultipartRaw(boundary, [
        {
          headers: ['Content-Disposition: form-data; name="note"'],
          body: 'route-multipart',
        },
        {
          headers: [
            'Content-Disposition: form-data; name="file"; filename="route.txt"',
            'Content-Type: text/plain',
          ],
          body: 'route-body',
        },
      ]);

      const res = await app.inject({
        method: 'POST',
        url: `/webhook-test/${workflowId}/upload`,
        headers: { 'content-type': contentType },
        payload: rawBody,
      });

      expect(res.statusCode, 'multipart POST must not return 415 Unsupported Media Type').not.toBe(
        415,
      );
      expect(res.statusCode).toBe(202);
      const json = res.json() as { executionId: string };
      expect(json.executionId).toBeTruthy();
    });

    it('runs webhook trigger with multipart-parsed inputItems and exposes binary on node run', async () => {
      const boundary = '----rxwf-exec-binary';
      const { rawBody, contentType } = buildMultipartRaw(boundary, [
        {
          headers: ['Content-Disposition: form-data; name="note"'],
          body: 'text-field',
        },
        {
          headers: [
            'Content-Disposition: form-data; name="file"; filename="report.txt"',
            'Content-Type: text/plain',
          ],
          body: 'report-body',
        },
      ]);
      const inputItems = parseWebhookBody({ rawBody, contentType });
      const ingress = createApiTriggerIngress(db, runtime);

      const result = await ingress.handleWebhook({
        workflowId,
        published: true,
        auth: { authMode: 'none', apiKey: '', hmacSecret: '' },
        body: rawBody,
        inputItems,
        signature: '',
        apiKeyHeader: '',
        idempotencyKey: `wh-binary-exec-${crypto.randomUUID()}`,
        timestamp: String(Math.floor(Date.now() / 1000)),
      });
      expect(result.status).toBe(202);

      const executionId = result.status === 202 ? result.executionId : '';
      expect(executionId).toBeTruthy();

      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/executions/${executionId}`,
        headers,
      });
      expect(detailRes.statusCode).toBe(200);
      const detail = detailRes.json() as {
        nodeRuns: Array<{ nodeId: string; outputData?: unknown[][] | null }>;
      };
      const whRun = detail.nodeRuns.find((r) => r.nodeId === 'wh-bin');
      expect(whRun).toBeTruthy();
      const outputItems = whRun?.outputData?.[0] as
        | Array<{
            json: Record<string, unknown>;
            binary?: Record<string, { mimeType: string; data: string; fileName?: string }>;
          }>
        | undefined;
      expect(outputItems?.[0]?.json).toEqual({ note: 'text-field' });
      expect(outputItems?.[0]?.binary?.file?.mimeType).toBe('text/plain');
      expect(outputItems?.[0]?.binary?.file?.fileName).toBe('report.txt');
      expect(Buffer.from(outputItems![0]!.binary!.file.data, 'base64').toString()).toBe(
        'report-body',
      );
    });
  });
});
