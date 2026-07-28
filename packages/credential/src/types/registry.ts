import { AwfError } from '@rxwf/shared';
import type {
  CredentialTypeDefinition,
  CredentialTypeSummary,
} from './field-schema.js';

const types = new Map<string, CredentialTypeDefinition>();

export function registerCredentialType(def: CredentialTypeDefinition): void {
  types.set(def.id, def);
}

export function getCredentialType(id: string): CredentialTypeDefinition | undefined {
  return types.get(id);
}

export function listCredentialTypes(): CredentialTypeDefinition[] {
  return [...types.values()];
}

export function listCredentialTypeSummaries(): CredentialTypeSummary[] {
  return listCredentialTypes().map(({ id, displayName, description, fields }) => ({
    id,
    displayName,
    description,
    fields,
  }));
}

export function validateCredentialData(
  typeId: string,
  data: Record<string, unknown>,
): void {
  const def = types.get(typeId);
  if (!def) {
    throw new AwfError('E1001', `Unknown credential type: ${typeId}`);
  }
  for (const field of def.fields) {
    if (!field.required) continue;
    const value = data[field.key];
    if (value === undefined || value === null || String(value).trim() === '') {
      throw new AwfError('E1001', `Missing required field: ${field.key}`);
    }
  }
}

/** 仅测试用 */
export function clearCredentialTypesForTest(): void {
  types.clear();
}
