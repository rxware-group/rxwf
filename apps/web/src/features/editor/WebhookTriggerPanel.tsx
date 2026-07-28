import { t, useLabels } from '../../i18n/labels.js';
import { useMemo, useState } from 'react';
import type { WorkflowDefinition } from '../../api/client.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { FormField } from '../../components/FormField.js';
import { Select } from '../../components/Select.js';
import { formatWebhookListenError, type WebhookListenError } from './webhook-listen-error.js';

type WorkflowNode = WorkflowDefinition['nodes'][number];
type WebhookAuthMode = 'none' | 'apiKey' | 'apiKeyHmac';

function randomSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function resolveAuthMode(parameters: Record<string, unknown>): WebhookAuthMode {
  const raw = String(parameters.authMode ?? '').trim();
  if (raw === 'none' || raw === 'apiKey' || raw === 'apiKeyHmac') {
    return raw;
  }
  if (String(parameters.hmacSecret ?? '').trim()) {
    return 'apiKeyHmac';
  }
  return 'none';
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function buildCurlExample(
  url: string,
  authMode: WebhookAuthMode,
  apiKey: string,
  hmacSecret: string,
): Promise<string> {
  const body = '{"example":true}';
  const lines = [`curl -X POST '${url}' \\`, `  -H 'Content-Type: application/json' \\`];
  if (authMode === 'apiKey' || authMode === 'apiKeyHmac') {
    lines.push(`  -H 'X-RXWF-Api-Key: ${apiKey || '<api-key>'}' \\`);
  }
  if (authMode === 'apiKeyHmac') {
    const ts = Math.floor(Date.now() / 1000);
    const signature = hmacSecret
      ? await hmacSha256Hex(hmacSecret, body)
      : '<hmac-sha256-hex>';
    lines.push(`  -H 'X-RXWF-Signature: ${signature}' \\`);
    lines.push(`  -H 'X-RXWF-Timestamp: ${ts}' \\`);
  }
  lines.push(`  -H 'Idempotency-Key: ${crypto.randomUUID()}' \\`);
  lines.push(`  -d '${body}'`);
  return lines.join('\n');
}

export function WebhookTriggerPanel({
  workflowId,
  node,
  publicUrl,
  published,
  isListening = false,
  listenError,
  onUpdateNode,
}: {
  workflowId: string;
  node: WorkflowNode;
  publicUrl: string;
  published: boolean;
  isListening?: boolean;
  listenError?: WebhookListenError;
  onUpdateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
}) {
  const labels = useLabels();
  const { confirm, dialog } = useConfirm();
  const path = String(node.parameters.path ?? 'hook');
  const authMode = resolveAuthMode(node.parameters);
  const apiKey = String(node.parameters.apiKey ?? '');
  const hmacSecret = String(node.parameters.hmacSecret ?? '');
  const base = publicUrl.replace(/\/$/, '');
  const prodUrl = `${base}/webhook/${workflowId}/${path}`;
  const testUrl = `${base}/webhook-test/${workflowId}/${path}`;
  const [copied, setCopied] = useState<string | null>(null);

  const authModeOptions = useMemo(
    () => [
      { value: 'none', label: t(labels, 'webhook.authMode.none') },
      { value: 'apiKey', label: t(labels, 'webhook.authMode.apiKey') },
      { value: 'apiKeyHmac', label: t(labels, 'webhook.authMode.apiKeyHmac') },
    ],
    [labels],
  );

  const patchParams = (patch: Record<string, unknown>) => {
    onUpdateNode(node.id, {
      parameters: { ...node.parameters, ...patch },
    });
  };

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyCurl = async (url: string, label: string) => {
    const text = await buildCurlExample(url, authMode, apiKey, hmacSecret);
    await copy(text, label);
  };

  const rotateHmacSecret = async () => {
    const ok = await confirm({
      title: t(labels, 'auto.Webhook_Secret_79544e1b'),
      message: t(labels, 'auto.HMAC_dc3b7e1f'),
      danger: true,
      confirmLabel: t(labels, 'auto.t_d822d7f6'),
    });
    if (!ok) return;
    patchParams({ hmacSecret: randomSecret() });
  };

  const rotateApiKey = async () => {
    const ok = await confirm({
      title: t(labels, 'webhook.rotateApiKeyTitle'),
      message: t(labels, 'webhook.rotateApiKeyMessage'),
      danger: true,
      confirmLabel: t(labels, 'auto.t_d822d7f6'),
    });
    if (!ok) return;
    patchParams({ apiKey: randomSecret() });
  };

  return (
    <section className="webhook-panel">
      {dialog}
      {isListening && (
        <div className="webhook-listening-banner" role="status">
          <strong>{t(labels, 'webhook.listening')}</strong>
          <p className="hint">{t(labels, 'webhook.listeningHint')}</p>
        </div>
      )}
      {listenError && (
        <div className="webhook-listen-error" role="alert">
          <strong>{t(labels, 'webhook.listenAuthFailed')}</strong>
          <p>{formatWebhookListenError(listenError, labels)}</p>
        </div>
      )}
      <FormField label="Path">
        <input
          type="text"
          value={path}
          onChange={(e) => patchParams({ path: e.target.value })}
        />
      </FormField>
      <FormField label={t(labels, 'webhook.authMode.label')}>
        <Select
          value={authMode}
          onChange={(value) => patchParams({ authMode: value })}
          options={authModeOptions}
          aria-label={t(labels, 'webhook.authMode.label')}
        />
      </FormField>

      {(authMode === 'apiKey' || authMode === 'apiKeyHmac') && (
        <FormField label={t(labels, 'webhook.apiKey.label')}>
          <div className="row">
            <input
              type="password"
              readOnly
              value={apiKey || t(labels, 'webhook.apiKey.notSet')}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                if (apiKey) {
                  void copy(apiKey, 'api-key');
                } else {
                  patchParams({ apiKey: randomSecret() });
                }
              }}
            >
              {apiKey
                ? copied === 'api-key'
                  ? t(labels, 'auto.t_e381a576')
                  : t(labels, 'auto.t_4edd1d00')
                : t(labels, 'auto.t_4aa23063')}
            </button>
            {apiKey && (
              <button type="button" className="btn-secondary" onClick={() => void rotateApiKey()}>
                {t(labels, 'webhook.rotate')}
              </button>
            )}
          </div>
        </FormField>
      )}

      {authMode === 'apiKey' && !apiKey && (
        <p className="hint">{t(labels, 'webhook.noApiKeyHint')}</p>
      )}

      {authMode === 'apiKeyHmac' && (
        <FormField label="HMAC Secret">
          <div className="row">
            <input
              type="password"
              readOnly
              value={hmacSecret || t(labels, 'webhook.notSet')}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                if (hmacSecret) {
                  void copy(hmacSecret, 'hmac-secret');
                } else {
                  patchParams({ hmacSecret: randomSecret() });
                }
              }}
            >
              {hmacSecret
                ? copied === 'hmac-secret'
                  ? t(labels, 'auto.t_e381a576')
                  : t(labels, 'auto.t_4edd1d00')
                : t(labels, 'auto.t_4aa23063')}
            </button>
            {hmacSecret && (
              <button type="button" className="btn-secondary" onClick={() => void rotateHmacSecret()}>
                {t(labels, 'webhook.rotate')}
              </button>
            )}
          </div>
        </FormField>
      )}

          {authMode === 'apiKeyHmac' && (!apiKey || !hmacSecret) && (
        <p className="hint">{t(labels, 'webhook.authNotConfiguredHint')}</p>
      )}

      <p className="hint webhook-executions-hint">{t(labels, 'webhook.executionsHint')}</p>

      <div className="webhook-url-block">
        <strong>{t(labels, 'webhook.testUrl')}</strong>
        <code className="mono">{testUrl}</code>
        <button type="button" className="btn-link" onClick={() => void copy(testUrl, 'test')}>
          {copied === 'test' ? t(labels, 'auto.t_e381a576') : t(labels, 'auto.t_4edd1d00')}
        </button>
        <button
          type="button"
          className="btn-link"
          onClick={() => void copyCurl(testUrl, 'curl-test')}
        >
          {copied === 'curl-test' ? t(labels, 'auto.curl_c68ec717') : t(labels, 'auto.curl_ac6e0cd7')}
        </button>
      </div>
      <div className={`webhook-url-block${published ? '' : ' muted'}`}>
        <strong>{t(labels, 'webhook.prodUrl')}</strong>
        {published && (
          <p className="webhook-prod-active-hint">{t(labels, 'webhook.prodListening')}</p>
        )}
        <code className="mono">{prodUrl}</code>
        <button
          type="button"
          className="btn-link"
          disabled={!published}
          onClick={() => void copy(prodUrl, 'prod')}
        >
          {copied === 'prod' ? t(labels, 'auto.t_e381a576') : t(labels, 'auto.t_4edd1d00')}
        </button>
        {published && (
          <button
            type="button"
            className="btn-link"
            onClick={() => void copyCurl(prodUrl, 'curl-prod')}
          >
            {copied === 'curl-prod' ? t(labels, 'auto.curl_c68ec717') : t(labels, 'auto.curl_ac6e0cd7')}
          </button>
        )}
      </div>
    </section>
  );
}
