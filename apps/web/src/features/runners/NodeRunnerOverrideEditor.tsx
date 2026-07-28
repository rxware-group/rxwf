import type { RunnerPolicy, NodeRunnerOverride } from './runner-policy-types.js';
import {
  RunnerCompactEditor,
  type RunnerOption,
} from './RunnerCompactEditor.js';

export type { RunnerOption };

export function NodeRunnerOverrideEditor({
  node,
  workflowRunnerPolicy,
  runners,
  onChange,
}: {
  node: { type: string; runner?: unknown };
  workflowRunnerPolicy: RunnerPolicy;
  runners: RunnerOption[];
  onChange: (override: NodeRunnerOverride) => void;
}) {
  return (
    <RunnerCompactEditor
      variant="node"
      node={node}
      workflowRunnerPolicy={workflowRunnerPolicy}
      runners={runners}
      onChange={onChange}
    />
  );
}
