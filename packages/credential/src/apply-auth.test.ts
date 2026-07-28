import { describe, it, expect, beforeAll } from 'vitest';
import { applyAuth } from './apply-auth.js';
import { registerGenericCredentialTypes } from './types/register-generic-types.js';

beforeAll(() => {
  registerGenericCredentialTypes();
});

describe('applyAuth', () => {
  it('apiKey with Bearer prefix', () => {
    const headers = applyAuth('apiKey', {
      apiKey: 'sk-test',
      headerName: 'Authorization',
      prefix: 'Bearer',
    });
    expect(headers).toEqual({ Authorization: 'Bearer sk-test' });
  });

  it('basicAuth base64 encodes username:password', () => {
    const headers = applyAuth('basicAuth', { username: 'u', password: 'p' });
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from('u:p').toString('base64')}`,
    );
  });

  it('httpHeaderAuth legacy { header } compat', () => {
    const headers = applyAuth('httpHeaderAuth', { header: 'Bearer legacy' });
    expect(headers.Authorization).toBe('Bearer legacy');
  });

  it('oauth2Manual uses tokenType prefix', () => {
    const headers = applyAuth('oauth2Manual', {
      accessToken: 'tok',
      tokenType: 'Bearer',
    });
    expect(headers.Authorization).toBe('Bearer tok');
  });
});
