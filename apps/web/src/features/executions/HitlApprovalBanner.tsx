import { useState } from 'react';
import { api, type ExecutionDetail } from '../../api/client.js';
import { t, useLabels } from '../../i18n/labels.js';

export interface HitlRequest {
  nodeId: string;
  nodeRunId?: string;
  prompt: string;
  summary?: string;
  allowReject: boolean;
  allowSupplement: boolean;
}

export function findActiveHitlRequest(detail: ExecutionDetail | null): HitlRequest | null {
  if (!detail || detail.status !== 'waiting') return null;
  const waiting = detail.nodeRuns.find((nr) => nr.status === 'waiting');
  if (!waiting) return null;
  const hitl = waiting.metadata?.hitl as
    | {
        prompt?: string;
        summary?: string;
        allowReject?: boolean;
        allowSupplement?: boolean;
      }
    | undefined;
  if (!hitl?.prompt) return null;
  return {
    nodeId: waiting.nodeId,
    prompt: hitl.prompt,
    summary: hitl.summary,
    allowReject: hitl.allowReject !== false,
    allowSupplement: hitl.allowSupplement === true,
  };
}

export function HitlApprovalBanner({
  executionId,
  detail,
  onResolved,
}: {
  executionId: string;
  detail: ExecutionDetail | null;
  onResolved: () => void;
}) {
  const labels = useLabels();
  const hitl = findActiveHitlRequest(detail);
  const [comment, setComment] = useState('');
  const [supplement, setSupplement] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hitl) return null;

  const submit = async (decision: 'approve' | 'reject') => {
    setBusy(true);
    setError(null);
    try {
      await api.executions.resumeHitl(executionId, {
        nodeId: hitl.nodeId,
        decision,
        comment: comment.trim() || undefined,
        supplement: supplement.trim() || undefined,
      });
      onResolved();
    } catch (e) {
      setError(e instanceof Error ? e.message : t(labels, 'common.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hitl-approval-banner" role="region" aria-label="Human approval">
      <div className="hitl-approval-banner-header">
        <span className="hitl-approval-badge">{t(labels, 'hitl.waitingBadge')}</span>
        <strong>{t(labels, 'hitl.approvalRequired')}</strong>
      </div>
      <p className="hitl-approval-prompt">{hitl.prompt}</p>
      {hitl.summary ? (
        <pre className="hitl-approval-summary">{hitl.summary}</pre>
      ) : null}
      <label className="hitl-approval-field">
        <span>{t(labels, 'hitl.commentLabel')}</span>
        <textarea
          rows={2}
          value={comment}
          disabled={busy}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t(labels, 'hitl.commentPlaceholder')}
        />
      </label>
      {hitl.allowSupplement ? (
        <label className="hitl-approval-field">
          <span>{t(labels, 'hitl.supplementLabel')}</span>
          <textarea
            rows={2}
            value={supplement}
            disabled={busy}
            onChange={(e) => setSupplement(e.target.value)}
            placeholder={t(labels, 'hitl.supplementPlaceholder')}
          />
        </label>
      ) : null}
      {error ? <p className="error hitl-approval-error">{error}</p> : null}
      <div className="hitl-approval-actions">
        <button type="button" className="primary" disabled={busy} onClick={() => void submit('approve')}>
          {t(labels, 'hitl.approve')}
        </button>
        {hitl.allowReject ? (
          <button type="button" className="danger" disabled={busy} onClick={() => void submit('reject')}>
            {t(labels, 'hitl.reject')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
