import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Readable } from 'node:stream';
import type { WorkflowDefinition } from '@rxwf/workflow';
import type { WorkflowItem } from '@rxwf/shared';
import type { LiteDatabase } from '@rxwf/providers-lite';
import { createLiteWorkflowLoader } from '@rxwf/providers-lite';
import type { TriggerIngress } from '@rxwf/execution';
import {
  parseWebhookAuthFromParameters,
  WEBHOOK_API_KEY_HEADER,
  type WebhookAuthConfig,
} from '@rxwf/execution';
import { parseWebhookBody } from '../webhook/parse-webhook-body.js';
import type { ExecutionRuntime } from '../execution/create-execution-runtime.js';
import { tryHandleWebhookListenDebug } from '../webhook/handle-webhook-listen-debug.js';

const WEBHOOK_SIGNATURE_HEADER = 'x-rxwf-signature';
const WEBHOOK_TIMESTAMP_HEADER = 'x-rxwf-timestamp';
const IDEMPOTENCY_HEADER = 'idempotency-key';
const SESSION_HEADER = 'x-rxwf-session-id';

type WebhookRequest = FastifyRequest & {
  rawBodyBuffer?: Buffer;
};

export interface WebhookNodeConfig {
  path: string;
  auth: WebhookAuthConfig;
}

export function findWebhookNode(
  definition: WorkflowDefinition,
  webhookPath: string,
): WebhookNodeConfig | null {
  for (const node of definition.nodes) {
    if (node.type !== 'webhookTrigger') continue;
    const path = String(node.parameters.path ?? node.parameters.webhookPath ?? '');
    if (path === webhookPath) {
      return {
        path,
        auth: parseWebhookAuthFromParameters(node.parameters as Record<string, unknown>),
      };
    }
  }
  return null;
}

function headerValue(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value;
  return value?.[0] ?? '';
}

function resolveRawBody(request: WebhookRequest): Buffer {
  if (request.rawBodyBuffer?.length) {
    return request.rawBodyBuffer;
  }
  if (typeof request.body === 'string') {
    return Buffer.from(request.body);
  }
  if (Buffer.isBuffer(request.body)) {
    return request.body;
  }
  return Buffer.from(JSON.stringify(request.body ?? {}));
}

export function findWebhookNodeId(
  definition: WorkflowDefinition,
  webhookPath: string,
): string | null {
  for (const node of definition.nodes) {
    if (node.type !== 'webhookTrigger') continue;
    const path = String(node.parameters.path ?? node.parameters.webhookPath ?? '');
    if (path === webhookPath) return node.id;
  }
  return null;
}

async function handleWebhookRequest(
  request: WebhookRequest,
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  ingress: TriggerIngress,
  workflow: { status: string; definition: WorkflowDefinition },
  workflowId: string,
  webhookPath: string,
  mode: 'production' | 'manual',
  executionRuntime?: ExecutionRuntime,
) {
  const webhookNode = findWebhookNode(workflow.definition, webhookPath);
  if (!webhookNode) {
    return reply.status(404).send({
      code: 'E1001',
      message: 'Webhook path not found on workflow',
    });
  }

  const signature = headerValue(request.headers[WEBHOOK_SIGNATURE_HEADER]);
  const apiKeyHeader = headerValue(request.headers[WEBHOOK_API_KEY_HEADER]);
  const idempotencyKey =
    headerValue(request.headers[IDEMPOTENCY_HEADER]) ||
    `webhook:${mode}:${workflowId}:${webhookPath}:${signature.slice(0, 16)}:${apiKeyHeader.slice(0, 8)}`;

  const contentType = headerValue(request.headers['content-type']);
  const rawBody = resolveRawBody(request);
  const inputItems: WorkflowItem[] = parseWebhookBody({
    rawBody,
    contentType,
  });
  const body = rawBody;

  const timestamp = headerValue(request.headers[WEBHOOK_TIMESTAMP_HEADER]);
  const sessionId = headerValue(request.headers[SESSION_HEADER]).trim() || undefined;

  if (mode === 'manual' && executionRuntime) {
    // Editor listen-test only: production URL (mode=production) always enqueues below.
    const listenResult = await tryHandleWebhookListenDebug(executionRuntime, {
      workflowId,
      webhookPath,
      inputItems,
      auth: webhookNode.auth,
      body,
      signature,
      apiKeyHeader,
      timestamp,
    });
    if (listenResult.handled) {
      if (listenResult.status === 401 || listenResult.status === 403) {
        const body = listenResult.body as { code?: string; listenId: string };
        return reply.status(listenResult.status).send({
          code: body.code ?? 'E2005',
          listenId: body.listenId,
        });
      }
      return reply.status(listenResult.status).send(listenResult.body);
    }
  }

  const result = await ingress.handleWebhook({
    workflowId,
    published: workflow.status === 'published',
    testMode: mode === 'manual',
    auth: webhookNode.auth,
    body,
    inputItems,
    signature,
    apiKeyHeader,
    idempotencyKey,
    timestamp,
    sessionId,
  });

  if (result.status === 401 || result.status === 403) {
    return reply.status(result.status).send({ code: result.code });
  }

  return reply.status(result.status).send({
    executionId: result.executionId,
    status: result.executionStatus,
  });
}

export function registerWebhookRoutes(
  app: FastifyInstance,
  db: LiteDatabase,
  getTriggerIngress: () => TriggerIngress,
  executionRuntime?: ExecutionRuntime,
): void {
  const workflowLoader = createLiteWorkflowLoader(db);

  void app.register(async (webhookApp) => {
    webhookApp.addContentTypeParser(
      /^multipart\/form-data(?:;|$)/i,
      { parseAs: 'buffer', bodyLimit: 50 * 1024 * 1024 },
      (_request, body, done) => {
        done(null, body);
      },
    );

    webhookApp.addHook('preParsing', async (request, _reply, payload) => {
      const chunks: Buffer[] = [];
      for await (const chunk of payload) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const rawBody = Buffer.concat(chunks);
      (request as WebhookRequest).rawBodyBuffer = rawBody;
      return Readable.from(rawBody);
    });

    const registerRoute = (
      path: string,
      mode: 'production' | 'manual',
      source: 'draft' | 'published',
    ) => {
      webhookApp.post(path, async (request, reply) => {
        const { workflowId, webhookPath } = request.params as {
          workflowId: string;
          webhookPath: string;
        };

        const draftLoaded = await workflowLoader.loadWorkflowForSource(workflowId, 'draft');
        if (!draftLoaded) {
          return reply.status(404).send({ code: 'E1001', message: 'Workflow not found' });
        }

        if (source === 'published') {
          if (draftLoaded.status !== 'published') {
            return reply.status(403).send({ code: 'E2001' });
          }
          const publishedLoaded = await workflowLoader.loadWorkflowForSource(
            workflowId,
            'published',
          );
          if (!publishedLoaded) {
            return reply.status(403).send({ code: 'E2001' });
          }
          const ingress = getTriggerIngress();
          return handleWebhookRequest(
            request as WebhookRequest,
            reply,
            ingress,
            { status: publishedLoaded.status, definition: publishedLoaded.definition },
            workflowId,
            webhookPath,
            mode,
            executionRuntime,
          );
        }

        const ingress = getTriggerIngress();
        return handleWebhookRequest(
          request as WebhookRequest,
          reply,
          ingress,
          { status: draftLoaded.status, definition: draftLoaded.definition },
          workflowId,
          webhookPath,
          mode,
          executionRuntime,
        );
      });
    };

    registerRoute('/webhook/:workflowId/:webhookPath', 'production', 'published');
    registerRoute('/webhook-test/:workflowId/:webhookPath', 'manual', 'draft');
  });
}

// Re-export for route tests
export { WEBHOOK_API_KEY_HEADER };
