import type { CredentialTypeDefinition } from '../field-schema.js';

export const httpHeaderAuthCredentialType: CredentialTypeDefinition = {
  id: 'httpHeaderAuth',
  displayName: 'Custom Header',
  fields: [
    { key: 'name', label: 'Header Name', type: 'text', required: true },
    { key: 'value', label: 'Header Value', type: 'secret', required: true },
  ],
  applyAuth(data) {
    // Legacy: { header: "Bearer xxx" } → Authorization
    if (data.header !== undefined && data.name === undefined) {
      return { Authorization: String(data.header) };
    }
    return { [String(data.name)]: String(data.value) };
  },
};
