import type { RunnerPolicy } from './runner-policy-types.js';
import {
  RunnerCompactEditor,
  type RunnerOption,
} from './RunnerCompactEditor.js';

export type { RunnerOption };

export function RunnerPolicyEditor({
  policy,
  runners,
  onChange,
}: {
  policy: RunnerPolicy;
  runners: RunnerOption[];
  onChange: (policy: RunnerPolicy) => void;
}) {
  return (
    <RunnerCompactEditor
      variant="workflow"
      policy={policy}
      runners={runners}
      onChange={onChange}
    />
  );
}
