import { t, useLabels } from '../i18n/labels.js';

export function Toast({
  message,
  code,
  traceId,
  onDismiss,
}: {
  message: string;
  code?: string;
  traceId?: string;
  onDismiss: () => void;
}) {
  const labels = useLabels();

  return (
    <div className="toast" role="alert">
      <p>{message}</p>
      {(code || traceId) && (
        <p className="hint mono">
          {code && <span>{code}</span>}
          {code && traceId ? ' · ' : null}
          {traceId && <span>trace: {traceId}</span>}
        </p>
      )}
      <button type="button" className="btn-link" onClick={onDismiss}>
        {t(labels, 'common.close')}
      </button>
    </div>
  );
}
