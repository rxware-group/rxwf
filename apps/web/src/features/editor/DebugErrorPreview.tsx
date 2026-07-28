import { t, useLabels } from '../../i18n/labels.js';
import type { NodeDebugState } from './editor-debug-types.js';
import { resolveNodeErrorPreview } from './editor-log-utils.js';
import { formatJsonData, JsonDataViewer } from './JsonDataViewer.js';

export function DebugErrorPreview({ debug }: { debug: NodeDebugState }) {
  const labels = useLabels();
  const detail = resolveNodeErrorPreview(debug);
  if (!detail) {
    return <p className="error">{t(labels, 'auto.t_9746cfc7')}</p>;
  }
  return (
    <div className="debug-error-preview">
      <JsonDataViewer value={formatJsonData(detail)} />
    </div>
  );
}
