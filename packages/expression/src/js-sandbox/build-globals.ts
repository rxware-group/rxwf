import type { ExpressionContext, NodeOutputEntry } from '../types.js';
import type { WorkflowItem } from '@rxwf/shared';
import { parsePlatformEnvMap } from '@rxwf/env';

export interface NodesDataEntry {
  name: string;
  json: Record<string, unknown>;
  binary?: WorkflowItem['binary'];
  items: WorkflowItem[];
}

/** Serializable snapshot for ivm bootstrap (no functions). */
export interface SandboxBootstrapData {
  json: Record<string, unknown>;
  binary?: WorkflowItem['binary'];
  env: Record<string, string | number | boolean>;
  vars: Record<string, string>;
  itemIndex: number;
  inputItems: WorkflowItem[];
  nodesByName: Record<string, NodesDataEntry>;
  execution?: ExpressionContext['execution'];
  workflow?: ExpressionContext['workflow'];
  nowIso: string;
  todayIso: string;
}

export function startOfLocalDayIso(date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function toTypedEnv(
  env: ExpressionContext['env'],
): Record<string, string | number | boolean> {
  if (!env) return {};
  const asStrings: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    asStrings[key] = typeof value === 'string' ? value : String(value);
  }
  return parsePlatformEnvMap(asStrings);
}

export function buildBootstrapData(context: ExpressionContext): SandboxBootstrapData {
  const inputItems = context.input ?? [];
  const itemIndex = context.itemIndex ?? 0;
  const nodesByName: Record<string, NodesDataEntry> = {};
  for (const entry of context.nodes ?? []) {
    nodesByName[entry.name] = {
      name: entry.name,
      json: entry.json,
      binary: entry.items[0]?.binary,
      items: entry.items,
    };
  }
  return {
    json: context.json ?? {},
    binary: context.binary,
    env: toTypedEnv(context.env),
    vars: context.vars ?? {},
    itemIndex,
    inputItems,
    nodesByName,
    execution: context.execution,
    workflow: context.workflow,
    nowIso: context.nowIso ?? new Date().toISOString(),
    todayIso: context.todayIso ?? startOfLocalDayIso(),
  };
}

/** Script run inside isolate before user expression to define $input / $nodes proxies. */
export const BOOTSTRAP_SCRIPT = `
(function () {
  const $__data = globalThis.__bootstrapData;
  if (!$__data) throw new Error('bootstrap data missing');

  function __buildInputProxy(items, itemIndex) {
    const list = items || [];
    const idx = Math.min(Math.max(0, itemIndex), Math.max(0, list.length - 1));
    const current = list[idx] || { json: {} };
    const proxy = {
      all: () => list.slice(),
      first: () => list[0],
      last: () => list[list.length - 1],
      item: current,
      itemIndex: idx,
      length: list.length,
    };
    for (let i = 0; i < list.length; i++) {
      proxy[i] = list[i];
    }
    return proxy;
  }

  function __buildNodesProxy(nodesByName) {
    const out = {};
    for (const name of Object.keys(nodesByName || {})) {
      const e = nodesByName[name];
      const items = e.items || [];
      out[name] = {
        name: e.name,
        get json() { return items[0] ? items[0].json : {}; },
        get binary() { return items[0] ? items[0].binary : undefined; },
        items,
        first: () => items[0],
        all: () => items.slice(),
        last: () => items[items.length - 1],
      };
    }
    return out;
  }

  globalThis.$json = $__data.json;
  globalThis.$binary = $__data.binary;
  globalThis.$env = $__data.env;
  globalThis.$vars = $__data.vars;
  globalThis.$itemIndex = $__data.itemIndex;
  globalThis.$execution = $__data.execution;
  globalThis.$workflow = $__data.workflow;
  globalThis.$now = $__data.nowIso;
  globalThis.$today = $__data.todayIso;
  globalThis.$input = __buildInputProxy($__data.inputItems, $__data.itemIndex);
  globalThis.$nodes = __buildNodesProxy($__data.nodesByName);
})();
`;
