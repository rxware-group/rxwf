import { describe, it, expect, beforeEach } from 'vitest';
import { AwfError } from '@rxwf/shared';
import {
  registerCredentialType,
  getCredentialType,
  listCredentialTypes,
  listCredentialTypeSummaries,
  validateCredentialData,
  clearCredentialTypesForTest,
} from './registry.js';
import { apiKeyCredentialType } from './generic/api-key.js';
import { httpHeaderAuthCredentialType } from './generic/http-header-auth.js';
import { basicAuthCredentialType } from './generic/basic-auth.js';
import { oauth2ManualCredentialType } from './generic/oauth2-manual.js';

beforeEach(() => {
  clearCredentialTypesForTest();
});

describe('credential type registry', () => {
  it('registers and lists types', () => {
    registerCredentialType({
      id: 'testType',
      displayName: 'Test',
      fields: [{ key: 'token', label: 'Token', type: 'secret', required: true }],
      applyAuth: (data) => ({ Authorization: String(data.token) }),
    });
    expect(getCredentialType('testType')?.displayName).toBe('Test');
    expect(listCredentialTypes()).toHaveLength(1);
  });

  it('validateCredentialData rejects missing required field', () => {
    registerCredentialType({
      id: 'testType',
      displayName: 'Test',
      fields: [{ key: 'token', label: 'Token', type: 'secret', required: true }],
      applyAuth: () => ({}),
    });
    expect(() => validateCredentialData('testType', {})).toThrow(/token/);
  });

  it('validateCredentialData rejects unknown type', () => {
    expect(() => validateCredentialData('unknown', { x: 1 })).toThrow(/unknown/i);
  });

  it('validateCredentialData rejects oauth2Manual missing accessToken', () => {
    registerCredentialType(oauth2ManualCredentialType);
    expect(() =>
      validateCredentialData('oauth2Manual', { tokenType: 'Bearer' }),
    ).toThrow(AwfError);
    expect(() =>
      validateCredentialData('oauth2Manual', { tokenType: 'Bearer' }),
    ).toThrow(/accessToken/);
  });
});

describe('generic credential type definitions', () => {
  beforeEach(() => {
    registerCredentialType(apiKeyCredentialType);
    registerCredentialType(httpHeaderAuthCredentialType);
    registerCredentialType(basicAuthCredentialType);
    registerCredentialType(oauth2ManualCredentialType);
  });

  it('registers all 4 Phase B generic types', () => {
    expect(listCredentialTypes().map((t) => t.id).sort()).toEqual(
      ['apiKey', 'basicAuth', 'httpHeaderAuth', 'oauth2Manual'].sort(),
    );
  });

  it('listCredentialTypeSummaries omits applyAuth functions', () => {
    const summaries = listCredentialTypeSummaries();
    expect(summaries).toHaveLength(4);
    for (const summary of summaries) {
      expect(summary).not.toHaveProperty('applyAuth');
      expect(summary.displayName).toBeTruthy();
      expect(summary.fields.length).toBeGreaterThan(0);
    }
  });

  it('apiKey schema has required apiKey secret field', () => {
    const def = getCredentialType('apiKey');
    expect(def?.fields.find((f) => f.key === 'apiKey')).toMatchObject({
      type: 'secret',
      required: true,
    });
  });

  it('oauth2Manual applyAuth produces Bearer header', () => {
    const def = getCredentialType('oauth2Manual');
    expect(
      def?.applyAuth({ accessToken: 'tok', tokenType: 'Bearer' }),
    ).toEqual({ Authorization: 'Bearer tok' });
  });
});
