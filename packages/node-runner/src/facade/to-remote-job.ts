import { randomUUID } from 'node:crypto';
import { applyAuth } from '@rxwf/credential';
import type { RemoteNodeRunJob } from '@rxwf/runner-protocol';
import {
  httpKeyValueRowsToRecord,
  normalizeHttpKeyValueRows,
} from '../http-key-value.js';
import type { NodeRunJob } from './node-runner-facade.js';

export const DEFAULT_REMOTE_JOB_TIMEOUT_MS = 300_000;

export type ToRemoteJobDeps = {
  resolveCredentialForAuth?: (
    credentialId: string,
  ) => Promise<{ type: string; data: Record<string, unknown> }>;
};

async function prepareRemoteNodeConfig(
  nodeType: string,
  nodeConfig: Record<string, unknown>,
  deps?: ToRemoteJobDeps,
): Promise<Record<string, unknown>> {
  const config = { ...nodeConfig };

  if (nodeType === 'httpRequest') {
    const manualHeaders =
      config.headers && typeof config.headers === 'object'
        ? (config.headers as Record<string, unknown>)
        : undefined;
    const sendHeaders = config.sendHeaders === true;
    let headers: Record<string, unknown> | undefined = manualHeaders;

    const credentialId = config.credentialId
      ? String(config.credentialId).trim()
      : '';
    if (credentialId && deps?.resolveCredentialForAuth) {
      const { type, data } = await deps.resolveCredentialForAuth(credentialId);
      const authHeaders = applyAuth(type, data);
      headers = { ...authHeaders, ...manualHeaders };
    }
    if (sendHeaders) {
      const rowHeaders = httpKeyValueRowsToRecord(
        normalizeHttpKeyValueRows(config.headerParameters),
      );
      headers = { ...(headers ?? {}), ...rowHeaders };
    }
    if (headers !== undefined) {
      config.headers = headers;
    }
  }

  delete config.credentialId;
  return config;
}

export async function toRemoteJob(
  job: NodeRunJob,
  deps?: ToRemoteJobDeps,
): Promise<RemoteNodeRunJob> {
  const nodeConfig = await prepareRemoteNodeConfig(job.nodeType, job.nodeConfig, deps);

  return {
    jobId: randomUUID(),
    executionId: job.executionId,
    nodeRunId: job.nodeRunId,
    nodeType: job.nodeType,
    nodeConfig,
    inputItems: job.inputItems,
    inputBranches: job.inputBranches,
    mode: job.mode,
    workflowSettings: job.workflowSettings,
    env: job.env,
    vars: job.vars,
    timeoutMs: DEFAULT_REMOTE_JOB_TIMEOUT_MS,
  };
}
