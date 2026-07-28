import { useState } from 'react';
import type { NodeOutputPreview, NodeOutputPreviewBranch } from './editor-debug-types.js';
import { t, useLabels } from '../../i18n/labels.js';
import { resolveLabel } from '../../i18n/resolve-label.js';
import { formatJsonData, JsonDataViewer } from './JsonDataViewer.js';

function branchTitle(labels: ReturnType<typeof useLabels>, branch: NodeOutputPreviewBranch): string {
  if (branch.satelliteRound) {
    return t(labels, 'editor.satelliteInvokeRound', { n: branch.label });
  }
  if (branch.loopRound) {
    return t(labels, 'editor.loopIterationRound', { n: branch.label });
  }
  return resolveLabel(labels, branch.label);
}

function OutputBranchItem({ branch }: { branch: NodeOutputPreviewBranch }) {
  const labels = useLabels();
  const [open, setOpen] = useState(true);
  const title = branchTitle(labels, branch);
  const data = branch.data;

  return (
    <li className="input-data-node debug-output-branch">
      <div className="input-data-node-head">
        <button
          type="button"
          className="input-data-node-toggle debug-output-branch-toggle"
          onClick={() => setOpen((o) => !o)}
        >
          <span>{open ? '▾' : '▸'}</span> {title}
        </button>
      </div>
      {open && (
        <div className="input-items-json-preview debug-output-branch-body">
          {data.length === 0 ? (
            <p className="hint debug-output-branch-empty">{t(labels, 'editor.noOutputItems')}</p>
          ) : (
            <JsonDataViewer value={formatJsonData(data)} />
          )}
        </div>
      )}
    </li>
  );
}

export function DebugOutputPreview({ preview }: { preview: NodeOutputPreview }) {
  if (preview.kind === 'single') {
    return <JsonDataViewer value={formatJsonData(preview.data)} />;
  }

  return (
    <ul className="input-data-tree debug-output-branches">
      {preview.branches.map((branch, index) => (
        <OutputBranchItem key={`${branch.label}-${index}`} branch={branch} />
      ))}
    </ul>
  );
}
