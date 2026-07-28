import type { WorkflowDefinition } from '../../api/client.js';
import type { SchemaDisplayNode } from './data-inspector/types.js';
import { buildDragPayload, serializeExprDrag } from './drag-expression.js';
import { parsePlatformEnvMap, type PlatformEnvParsedValue } from '@rxwf/env';

const CONTEXT_SOURCE_ID = '__context__';

export function testSettingsToMap(
  items: Array<{ key: string; value: string }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of items) {
    out[item.key] = item.value;
  }
  return out;
}

export function platformEnvItemsToMap(
  items: Array<{ key: string; value: string }>,
): Record<string, PlatformEnvParsedValue> {
  const strings: Record<string, string> = {};
  for (const item of items) {
    strings[item.key] = item.value;
  }
  return parsePlatformEnvMap(strings);
}

function previewValue(value: PlatformEnvParsedValue): string {
  if (typeof value === 'string') return value;
  return String(value);
}

function valueTypeLabel(value: PlatformEnvParsedValue): string {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'string';
}

function startOfLocalDayIso(date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function contextLeaf(
  key: string,
  path: string[],
  preview: string,
  type = 'string',
): SchemaDisplayNode {
  const expression = buildDragPayload('context', path).expression;
  return {
    id: `ctx:${path.join('.')}`,
    key,
    path,
    type,
    preview,
    draggable: true,
    expression: serializeExprDrag(buildDragPayload('context', path)),
  };
}

function contextContainer(
  key: string,
  path: string[],
  children: SchemaDisplayNode[],
  type: 'object' | 'array' = 'object',
): SchemaDisplayNode {
  return {
    id: `ctx:${path.join('.')}`,
    key,
    path,
    type,
    draggable: true,
    expression: serializeExprDrag(buildDragPayload('context', path)),
    children,
  };
}

export function buildEditorContextSource(input: {
  definition: WorkflowDefinition;
  workflowId?: string;
  nodeId: string;
  env?: Record<string, PlatformEnvParsedValue>;
  vars?: Record<string, string>;
  executionPreview?: {
    id?: string;
    mode?: string;
    environment?: string;
    startedAt?: string;
  };
}) {
  const now = new Date().toISOString();
  const today = startOfLocalDayIso();

  const envChildren = Object.entries(input.env ?? {}).map(([key, value]) =>
    contextLeaf(key, ['$env', key], previewValue(value), valueTypeLabel(value)),
  );

  const varsChildren = Object.entries(input.vars ?? {}).map(([key, value]) =>
    contextLeaf(key, ['$vars', key], value),
  );

  const execution = input.executionPreview;
  const executionChildren = execution
    ? [
        ...(execution.id
          ? [contextLeaf('id', ['$execution', 'id'], execution.id)]
          : []),
        ...(execution.mode
          ? [contextLeaf('mode', ['$execution', 'mode'], execution.mode)]
          : []),
        ...(execution.environment
          ? [
              contextLeaf(
                'environment',
                ['$execution', 'environment'],
                execution.environment,
              ),
            ]
          : []),
      ]
    : [contextLeaf('id', ['$execution', 'id'], '[filled at execution time]')];

  const workflowChildren = [
    contextLeaf('id', ['$workflow', 'id'], input.workflowId ?? ''),
    contextLeaf('name', ['$workflow', 'name'], input.definition.name ?? ''),
  ];

  const contextChildren: SchemaDisplayNode[] = [
    contextLeaf('$now', ['$now'], now),
    contextLeaf('$today', ['$today'], today),
    contextContainer('$execution', ['$execution'], executionChildren),
    contextContainer('$workflow', ['$workflow'], workflowChildren),
    contextContainer('$env', ['$env'], envChildren),
    contextContainer('$vars', ['$vars'], varsChildren),
  ];

  const executionJson: Record<string, unknown> = execution
    ? {
        ...(execution.id ? { id: execution.id } : {}),
        ...(execution.mode ? { mode: execution.mode } : {}),
        ...(execution.environment ? { environment: execution.environment } : {}),
      }
    : { id: '[filled at execution time]' };

  return {
    id: CONTEXT_SOURCE_ID,
    label: 'Variables and context',
    items: [
      {
        json: {
          $now: now,
          $today: today,
          $execution: executionJson,
          $workflow: {
            id: input.workflowId ?? '',
            name: input.definition.name ?? '',
          },
          $env: input.env ?? {},
          $vars: input.vars ?? {},
        },
      },
    ],
    icon: 'context' as const,
    contextChildren,
  };
}
