import type { NodeOutputEntry } from '@rxwf/expression';
import { substituteFromAiInString } from '@rxwf/expression';
import type { WorkflowItem } from '@rxwf/shared';
import { AwfError } from '@rxwf/shared';
import type { ResolvedSubworkflowInputSchema } from '@rxwf/workflow';
import { resolveItemTemplateString } from '../expression/item-context.js';

export interface BuildSubworkflowPayloadInput {
  llmArgs: Record<string, unknown>;
  inputMapping?: unknown;
  childSchema?: ResolvedSubworkflowInputSchema | null;
  inputItems: WorkflowItem[];
  env?: Record<string, string>;
  nodes?: NodeOutputEntry[];
  vars?: Record<string, string>;
}

function hasInputMappingOverride(inputMapping: unknown): boolean {
  if (!inputMapping || typeof inputMapping !== 'object' || Array.isArray(inputMapping)) {
    return false;
  }
  return Object.keys(inputMapping as Record<string, unknown>).length > 0;
}

function validateRequiredFields(
  args: Record<string, unknown>,
  schema: ResolvedSubworkflowInputSchema,
): void {
  if (schema.mode === 'acceptAll') return;
  for (const field of schema.fields) {
    if (field.required === false) continue;
    if (!(field.name in args) || args[field.name] === undefined) {
      throw new AwfError(
        'E1054',
        `Missing required subworkflow input field: ${field.name}`,
      );
    }
  }
}

export async function buildSubworkflowPayload(
  input: BuildSubworkflowPayloadInput,
): Promise<Record<string, unknown>> {
  const mapping = input.inputMapping;
  if (hasInputMappingOverride(mapping)) {
    const mappingObj = mapping as Record<string, unknown>;
    if (
      Object.keys(mappingObj).length === 1 &&
      typeof mappingObj._payload === 'string'
    ) {
      const substituted = substituteFromAiInString(mappingObj._payload, input.llmArgs);
      const resolved = await resolveItemTemplateString(
        substituted,
        input.llmArgs,
        input.inputItems,
        input.env,
        input.nodes,
        input.vars,
      );
      const trimmed = resolved.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          return JSON.parse(trimmed) as Record<string, unknown>;
        } catch {
          // fall through to wrap as value
        }
      }
      if (
        trimmed === '' &&
        input.inputItems[0]?.json &&
        typeof input.inputItems[0].json === 'object'
      ) {
        return { ...(input.inputItems[0].json as Record<string, unknown>) };
      }
      return { value: resolved };
    }

    const payload: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(mappingObj)) {
      if (key === '_payload') continue;
      const substituted =
        typeof raw === 'string'
          ? substituteFromAiInString(raw, input.llmArgs)
          : raw;
      payload[key] =
        typeof substituted === 'string'
          ? await resolveItemTemplateString(
              substituted,
              input.llmArgs,
              input.inputItems,
              input.env,
              input.nodes,
              input.vars,
            )
          : substituted;
    }
    return payload;
  }

  if (!input.childSchema || input.childSchema.mode === 'acceptAll') {
    return { ...input.llmArgs };
  }

  validateRequiredFields(input.llmArgs, input.childSchema);
  const payload: Record<string, unknown> = {};
  for (const field of input.childSchema.fields) {
    if (field.name in input.llmArgs) {
      payload[field.name] = input.llmArgs[field.name];
    } else if (field.default !== undefined) {
      payload[field.name] = field.default;
    }
  }
  return payload;
}
