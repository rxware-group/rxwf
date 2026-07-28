import type { CredentialTypeDefinition } from '../field-schema.js';

export const oauth2ManualCredentialType: CredentialTypeDefinition = {
  id: 'oauth2Manual',
  displayName: 'OAuth2 (Manual Token)',
  description: 'Paste access token manually; no OAuth redirect flow',
  fields: [
    { key: 'accessToken', label: 'Access Token', type: 'secret', required: true },
    { key: 'refreshToken', label: 'Refresh Token', type: 'secret' },
    { key: 'tokenType', label: 'Token Type', type: 'text', defaultValue: 'Bearer' },
  ],
  applyAuth(data) {
    const tokenType = String(data.tokenType ?? 'Bearer').trim();
    const accessToken = String(data.accessToken ?? '');
    return { Authorization: `${tokenType} ${accessToken}`.trim() };
  },
};
