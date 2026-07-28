import type { createCredentialService } from '@rxwf/credential';

export function createCredentialResolver(
  service: ReturnType<typeof createCredentialService>,
): (credentialId: string) => Promise<Record<string, string>> {
  return async (credentialId) => {
    const data = await service.resolveSecret(credentialId);
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') out[key] = value;
    }
    const apiKey =
      (typeof data.apiKey === 'string' && data.apiKey) ||
      (typeof data.accessToken === 'string' && data.accessToken) ||
      (typeof data.token === 'string' && data.token) ||
      '';
    if (apiKey) out.apiKey = apiKey;
    return out;
  };
}
