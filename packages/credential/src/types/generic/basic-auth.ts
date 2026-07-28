import type { CredentialTypeDefinition } from '../field-schema.js';

export const basicAuthCredentialType: CredentialTypeDefinition = {
  id: 'basicAuth',
  displayName: 'Username / Password',
  fields: [
    { key: 'username', label: 'Username', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'secret', required: true },
  ],
  applyAuth(data) {
    const encoded = Buffer.from(
      `${String(data.username)}:${String(data.password)}`,
    ).toString('base64');
    return { Authorization: `Basic ${encoded}` };
  },
};
