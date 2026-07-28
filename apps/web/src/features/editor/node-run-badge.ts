import { t, type LabelMap } from '../../i18n/labels.js';
import type { NodeDebugState } from './editor-debug-types.js';
import { countSatelliteInvocations } from './node-debug-run-state.js';
import { outputHandleToIndex, type OutputHandleIndexContext } from './node-port-defs.js';
import type { EdgeSourceRunStatus } from './workflow-edge-utils.js';

const AI_SATELLITE_TYPES = new Set([
  'aiChatModel',
  'aiMemory',
  'aiKnowledge',
  'aiOutputParser',
  'toolMcp',
  'toolHttp',
  'toolWorkflow',
  'toolSkill',
  'toolSubagent',
  'toolRead',
  'toolWrite',
  'toolGrep',
  'toolShell',
  'toolWebSearch',
]);

function branchItemCount(
  debug: NodeDebugState,
  fromOutput: string | undefined,
  handleContext?: OutputHandleIndexContext,
): number {
  const idx = outputHandleToIndex(fromOutput, handleContext);
  if (debug.outputItems?.length) {
    return debug.outputItems[idx]?.length ?? 0;
  }
  return debug.itemCount ?? 0;
}

/** Badge on node body: running / failed / waiting / non-item success hints. */
export function resolveNodeBodyBadge(
  labels: LabelMap,
  nodeType: string,
  debug?: NodeDebugState,
): string | null {
  if (!debug || debug.status === 'idle') return null;
  if (debug.status === 'running') return t(labels, 'common.running');
  if (debug.status === 'waiting') return t(labels, 'hitl.waitingBadge');
  if (debug.status === 'failed') return t(labels, 'common.failed');
  return null;
}

/** Badge on outgoing edge: item counts after successful execution. */
export function resolveEdgeOutputBadge(
  labels: LabelMap,
  nodeType: string | undefined,
  nodeId: string,
  fromOutput: string | undefined,
  nodeDebug: Record<string, NodeDebugState>,
  handleContext?: OutputHandleIndexContext,
): { text: string; status: EdgeSourceRunStatus } | undefined {
  const debug = nodeDebug[nodeId];
  if (!debug || debug.status !== 'success' || !nodeType) return undefined;

  if (AI_SATELLITE_TYPES.has(nodeType)) {
    const n = Math.max(debug.itemCount ?? 0, countSatelliteInvocations(debug));
    if (n <= 0) return undefined;
    return {
      text: t(labels, 'editor.satelliteInvokeCount', { n: String(n) }),
      status: 'success',
    };
  }

  const n = branchItemCount(debug, fromOutput, handleContext);
  if (n <= 0) {
    if (nodeType === 'loop') {
      const idx = outputHandleToIndex(fromOutput, handleContext);
      if (idx === 0) {
        const batchCount = debug.loopBatchItemCount ?? 0;
        if (batchCount > 0) {
          return {
            text: t(labels, 'common.nItems', { n: String(batchCount) }),
            status: 'success',
          };
        }
      }
    }
    return undefined;
  }
  return {
    text: t(labels, 'common.nItems', { n: String(n) }),
    status: 'success',
  };
}
