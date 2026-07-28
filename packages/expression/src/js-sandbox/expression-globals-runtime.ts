import type { WorkflowItem } from '@rxwf/shared';
import type { ExpressionContext } from '../types.js';
import type { NodesDataEntry, SandboxBootstrapData } from './build-globals.js';

export interface InputProxy {
  all: () => WorkflowItem[];
  first: () => WorkflowItem | undefined;
  last: () => WorkflowItem | undefined;
  item: WorkflowItem;
  itemIndex: number;
  length: number;
  [index: number]: WorkflowItem | undefined;
}

export interface NodeOutputProxy {
  name: string;
  json: Record<string, unknown>;
  binary?: WorkflowItem['binary'];
  items: WorkflowItem[];
  first: () => WorkflowItem | undefined;
  all: () => WorkflowItem[];
  last: () => WorkflowItem | undefined;
}

export type NodesProxy = Record<string, NodeOutputProxy>;

export interface ExpressionGlobals {
  $json: Record<string, unknown>;
  $binary: WorkflowItem['binary'];
  $env: Record<string, string | number | boolean>;
  $vars: Record<string, string>;
  $itemIndex: number;
  $execution: ExpressionContext['execution'];
  $workflow: ExpressionContext['workflow'];
  $now: string;
  $today: string;
  $input: InputProxy;
  $nodes: NodesProxy;
}

export function buildInputProxy(items: WorkflowItem[], itemIndex: number): InputProxy {
  const list = items ?? [];
  const idx = Math.min(Math.max(0, itemIndex), Math.max(0, list.length - 1));
  const current = list[idx] ?? { json: {} };
  const proxy: InputProxy = {
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

export function buildNodesProxy(nodesByName: Record<string, NodesDataEntry>): NodesProxy {
  const out: NodesProxy = {};
  for (const name of Object.keys(nodesByName ?? {})) {
    const entry = nodesByName[name]!;
    const items = entry.items ?? [];
    out[name] = {
      name: entry.name,
      get json() {
        return items[0] ? items[0].json : {};
      },
      get binary() {
        return items[0] ? items[0].binary : undefined;
      },
      items,
      first: () => items[0],
      all: () => items.slice(),
      last: () => items[items.length - 1],
    };
  }
  return out;
}

export function createExpressionGlobals(data: SandboxBootstrapData): ExpressionGlobals {
  return {
    $json: data.json,
    $binary: data.binary,
    $env: data.env,
    $vars: data.vars,
    $itemIndex: data.itemIndex,
    $execution: data.execution,
    $workflow: data.workflow,
    $now: data.nowIso,
    $today: data.todayIso,
    $input: buildInputProxy(data.inputItems, data.itemIndex),
    $nodes: buildNodesProxy(data.nodesByName),
  };
}
