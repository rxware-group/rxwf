import type { ParamFieldType } from './node-param-schemas.js';

const MODES_KEY = '_fieldModes';

export function isStringFieldType(type: ParamFieldType): boolean {
  return type === 'text' || type === 'textarea' || type === 'expression';
}

export type FieldMode = 'fixed' | 'expression' | 'fromAi';

export function getFieldMode(
  parameters: Record<string, unknown>,
  key: string,
  options?: { defaultExpression?: boolean },
): FieldMode {
  const modes = parameters[MODES_KEY] as Record<string, string> | undefined;
  if (modes?.[key] === 'fromAi') return 'fromAi';
  if (modes?.[key] === 'expression') return 'expression';
  if (modes?.[key] === 'fixed') return 'fixed';
  if (options?.defaultExpression) return 'expression';
  return 'fixed';
}

export function setFieldMode(
  parameters: Record<string, unknown>,
  key: string,
  mode: FieldMode,
): Record<string, unknown> {
  const modes = {
    ...((parameters[MODES_KEY] as Record<string, string> | undefined) ?? {}),
  };
  modes[key] = mode;
  return { ...parameters, [MODES_KEY]: modes };
}
