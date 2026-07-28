import type { CredentialTypeDefinition } from '../field-schema.js';

export const apiKeyCredentialType: CredentialTypeDefinition = {
  id: 'apiKey',
  displayName: 'API Key',
  description: 'API key in a configurable HTTP header',
  fields: [
    { key: 'apiKey', label: 'API Key', type: 'secret', required: true },
    {
      key: 'headerName',
      label: 'Header Name',
      type: 'text',
      defaultValue: 'Authorization',
    },
    { key: 'prefix', label: 'Prefix', type: 'text', defaultValue: 'Bearer' },
  ],
  applyAuth(data) {
    const headerName = String(data.headerName ?? 'Authorization');
    const prefix = String(data.prefix ?? 'Bearer').trim();
    const apiKey = String(data.apiKey ?? '');
    const value = prefix ? `${prefix} ${apiKey}` : apiKey;
    return { [headerName]: value };
  },
};
