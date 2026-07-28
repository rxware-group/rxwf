import { AwfError } from '@rxwf/shared';
import { getCredentialType } from './types/registry.js';
import { registerGenericCredentialTypes } from './types/register-generic-types.js';

registerGenericCredentialTypes();

export function applyAuth(
  typeId: string,
  data: Record<string, unknown>,
): Record<string, string> {
  const def = getCredentialType(typeId);
  if (!def) {
    throw new AwfError('E1001', `Unknown credential type: ${typeId}`);
  }
  return def.applyAuth(data);
}
