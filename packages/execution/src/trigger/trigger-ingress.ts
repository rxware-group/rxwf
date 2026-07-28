import type { WorkflowItem } from '@rxwf/shared';

import {
  type WebhookAuthConfig,
  verifyWebhookAuth,
} from './webhook-auth.js';

export interface IdempotencyRecord {
  executionId: string;
  status: string;
}

export interface WebhookEnqueueInput {
  workflowId: string;
  triggerType: 'webhook';
  mode: 'production' | 'manual';
  idempotencyKey: string;
  body: string;
  inputItems?: WorkflowItem[];
  sessionId?: string;
}

export interface TriggerIngressDeps {
  enqueue(input: WebhookEnqueueInput): Promise<{ executionId: string; status: string }>;
  idempotency: {
    find(key: string, scope: string): Promise<IdempotencyRecord | null>;
  };
  /** Max age of X-RXWF-Timestamp (Unix seconds), default 5 minutes */
  maxTimestampSkewMs?: number;
  now?: () => number;
}

export interface WebhookTriggerInput {
  workflowId: string;
  /** When true, workflow is published and prod webhook may run. */
  published: boolean;
  /** Test webhook (draft definition). */
  testMode?: boolean;
  auth: WebhookAuthConfig;
  /** Raw request body used for HMAC verification */
  body: string | Buffer;
  inputItems?: WorkflowItem[];
  signature: string;
  apiKeyHeader: string;
  idempotencyKey: string;
  /** Unix timestamp in seconds (X-RXWF-Timestamp) */
  timestamp: string;
  sessionId?: string;
}

export type WebhookTriggerResult =
  | { status: 200; executionId: string; executionStatus: string }
  | { status: 202; executionId: string; executionStatus: string }
  | { status: 401; code: string }
  | { status: 403; code: string };

const DEFAULT_TIMESTAMP_SKEW_MS = 300_000;

export function webhookIdempotencyScope(mode: 'production' | 'manual'): string {
  return `webhook:${mode}`;
}

export type TriggerIngress = ReturnType<typeof createTriggerIngress>;

export function createTriggerIngress(deps: TriggerIngressDeps) {
  return {
    async handleWebhook(input: WebhookTriggerInput): Promise<WebhookTriggerResult> {
      if (!input.testMode && !input.published) {
        return { status: 403, code: 'E2001' };
      }

      const nowMs = deps.now?.() ?? Date.now();
      const maxSkew = deps.maxTimestampSkewMs ?? DEFAULT_TIMESTAMP_SKEW_MS;
      const authResult = verifyWebhookAuth({
        config: input.auth,
        apiKeyHeader: input.apiKeyHeader,
        signature: input.signature,
        timestamp: input.timestamp,
        body: input.body,
        nowMs,
        maxTimestampSkewMs: maxSkew,
      });
      if (!authResult.ok) {
        return { status: authResult.status, code: authResult.code };
      }

      const mode = input.testMode ? 'manual' : 'production';
      const idempotencyScope = webhookIdempotencyScope(mode);
      const cached = await deps.idempotency.find(input.idempotencyKey, idempotencyScope);
      if (cached) {
        return {
          status: 200,
          executionId: cached.executionId,
          executionStatus: cached.status,
        };
      }

      const created = await deps.enqueue({
        workflowId: input.workflowId,
        triggerType: 'webhook',
        mode,
        idempotencyKey: input.idempotencyKey,
        body: Buffer.isBuffer(input.body)
          ? input.body.toString('base64')
          : input.body,
        inputItems: input.inputItems,
        sessionId: input.sessionId,
      });
      return {
        status: 202,
        executionId: created.executionId,
        executionStatus: created.status,
      };
    },
  };
}
