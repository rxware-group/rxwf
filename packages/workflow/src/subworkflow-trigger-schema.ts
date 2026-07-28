import type { WorkflowDefinition, WorkflowNode } from './validate.js';

export type SubworkflowInputMode = 'fields' | 'jsonExample' | 'acceptAll';
export type SubworkflowInputFieldType = 'string' | 'number' | 'boolean' | 'json';

export interface SubworkflowInputField {
  name: string;
  type: SubworkflowInputFieldType;
  description?: string;
  required?: boolean;
  default?: unknown;
}

export interface ResolvedSubworkflowInputSchema {
  mode: SubworkflowInputMode;
  jsonSchema: Record<string, unknown>;
  fields: SubworkflowInputField[];
}

const FIELD_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

const MAIN_TRIGGER_TYPES = new Set([
  'manualTrigger',
  'webhookTrigger',
  'scheduleTrigger',
  'subworkflowTrigger',
]);

export function findSubworkflowTriggerNode(
  definition: WorkflowDefinition,
): WorkflowNode | undefined {
  return definition.nodes.find((n) => n.type === 'subworkflowTrigger');
}

function inferTypeFromValue(value: unknown): SubworkflowInputFieldType {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (value !== null && typeof value === 'object') return 'json';
  return 'string';
}

export function inferFieldsFromJsonExample(example: unknown): SubworkflowInputField[] | null {
  if (typeof example === 'string') {
    const trimmed = example.trim();
    if (!trimmed) return [];
    try {
      example = JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }
  if (!example || typeof example !== 'object' || Array.isArray(example)) {
    return null;
  }
  return Object.entries(example as Record<string, unknown>).map(([name, value]) => ({
    name,
    type: inferTypeFromValue(value),
    required: false,
  }));
}

export function fieldsToJsonSchema(fields: SubworkflowInputField[]): Record<string, unknown> {
  if (fields.length === 0) {
    return { type: 'object', properties: {}, additionalProperties: false };
  }
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const field of fields) {
    const prop: Record<string, unknown> = {
      type: field.type === 'json' ? 'object' : field.type,
    };
    if (field.description) prop.description = field.description;
    if (field.default !== undefined) prop.default = field.default;
    properties[field.name] = prop;
    if (field.required !== false) required.push(field.name);
  }
  const schema: Record<string, unknown> = {
    type: 'object',
    properties,
    additionalProperties: false,
  };
  if (required.length > 0) schema.required = required;
  return schema;
}

export function resolveSubworkflowInputSchemaFromNode(
  node: WorkflowNode,
): ResolvedSubworkflowInputSchema | null {
  if (node.type !== 'subworkflowTrigger') return null;
  const p = node.parameters;
  const mode = (String(p.inputMode ?? 'fields') as SubworkflowInputMode) || 'fields';

  if (mode === 'acceptAll') {
    return {
      mode: 'acceptAll',
      fields: [],
      jsonSchema: { type: 'object', additionalProperties: true },
    };
  }

  if (mode === 'jsonExample') {
    const inferred = inferFieldsFromJsonExample(p.jsonExample ?? {});
    if (inferred === null) return null;
    return {
      mode: 'jsonExample',
      fields: inferred,
      jsonSchema: fieldsToJsonSchema(inferred),
    };
  }

  const rawInputs = Array.isArray(p.inputs) ? p.inputs : [];
  const fields: SubworkflowInputField[] = [];
  for (const entry of rawInputs) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const name = String(row.name ?? '').trim();
    if (!name) continue;
    const type = String(row.type ?? 'string') as SubworkflowInputFieldType;
    fields.push({
      name,
      type: ['string', 'number', 'boolean', 'json'].includes(type) ? type : 'string',
      description: row.description ? String(row.description) : undefined,
      required: row.required === false ? false : true,
      default: row.default,
    });
  }

  return {
    mode: 'fields',
    fields,
    jsonSchema: fieldsToJsonSchema(fields),
  };
}

export function resolveSubworkflowInputSchema(
  definition: WorkflowDefinition,
): ResolvedSubworkflowInputSchema | null {
  const node = findSubworkflowTriggerNode(definition);
  if (!node) return null;
  return resolveSubworkflowInputSchemaFromNode(node);
}

export interface SubworkflowTriggerValidationIssue {
  code: string;
  message: string;
  nodeId?: string;
}

export function validateSubworkflowTriggerNode(
  node: WorkflowNode,
): SubworkflowTriggerValidationIssue[] {
  if (node.type !== 'subworkflowTrigger') return [];
  const issues: SubworkflowTriggerValidationIssue[] = [];
  const p = node.parameters;
  const mode = String(p.inputMode ?? 'fields');

  if (mode === 'fields') {
    const rawInputs = Array.isArray(p.inputs) ? p.inputs : [];
    if (rawInputs.length === 0) {
      issues.push({
        code: 'E1056',
        message: 'subworkflowTrigger fields mode requires at least one input field',
        nodeId: node.id,
      });
    }
    const seen = new Set<string>();
    for (const entry of rawInputs) {
      if (!entry || typeof entry !== 'object') continue;
      const name = String((entry as Record<string, unknown>).name ?? '').trim();
      if (!name) continue;
      if (!FIELD_NAME_RE.test(name)) {
        issues.push({
          code: 'E1058',
          message: `Invalid subworkflow input field name: ${name}`,
          nodeId: node.id,
        });
      }
      if (seen.has(name)) {
        issues.push({
          code: 'E1057',
          message: `Duplicate subworkflow input field: ${name}`,
          nodeId: node.id,
        });
      }
      seen.add(name);
    }
  } else if (mode === 'jsonExample') {
    if (inferFieldsFromJsonExample(p.jsonExample ?? {}) === null) {
      issues.push({
        code: 'E1058',
        message: 'subworkflowTrigger jsonExample must be a JSON object',
        nodeId: node.id,
      });
    }
  } else if (mode !== 'acceptAll') {
    issues.push({
      code: 'E1058',
      message: `Unknown subworkflowTrigger inputMode: ${mode}`,
      nodeId: node.id,
    });
  }

  return issues;
}

export function validateSubworkflowTriggerLayout(
  definition: WorkflowDefinition,
): SubworkflowTriggerValidationIssue[] {
  const issues: SubworkflowTriggerValidationIssue[] = [];
  const executable = definition.nodes.filter((n) => n.type !== 'stickyNote');
  const subTriggers = executable.filter((n) => n.type === 'subworkflowTrigger');
  const otherMainTriggers = executable.filter(
    (n) => MAIN_TRIGGER_TYPES.has(n.type) && n.type !== 'subworkflowTrigger',
  );

  if (subTriggers.length > 0 && otherMainTriggers.length > 0) {
    issues.push({
      code: 'E1051',
      message: 'subworkflowTrigger cannot coexist with manual, webhook, or schedule triggers',
      nodeId: subTriggers[0]?.id,
    });
  }

  if (definition.settings?.exposeAsTool && subTriggers.length !== 1) {
    issues.push({
      code: 'E1052',
      message: 'Workflows exposed as Agent Tool require exactly one subworkflowTrigger',
    });
  }

  for (const node of subTriggers) {
    issues.push(...validateSubworkflowTriggerNode(node));
  }

  return issues;
}

export function hasInputMappingOverride(parameters: Record<string, unknown>): boolean {
  const mapping = parameters.inputMapping;
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return false;
  return Object.keys(mapping as Record<string, unknown>).length > 0;
}
