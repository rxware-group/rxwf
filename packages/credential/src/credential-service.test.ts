import { beforeAll, describe, it, expect } from 'vitest';
import { AwfError } from '@rxwf/shared';
import { createCredentialService } from './credential-service.js';
import { encryptCredentialPayload, parseCredentialKey } from './crypto.js';
import { registerGenericCredentialTypes } from './types/register-generic-types.js';

const testKey = parseCredentialKey(
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
);

function createInMemoryService() {
  const store: {
    rows: {
      id: string;
      name: string;
      type: string;
      dataEncrypted: string;
    }[];
  } = { rows: [] };

  const service = createCredentialService({
    encryptionKey: testKey,
    insert: async (row) => {
      store.rows.push(row);
    },
    list: async () =>
      store.rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
      })),
    findById: async (id) => store.rows.find((r) => r.id === id) ?? null,
    deleteById: async (id) => {
      const before = store.rows.length;
      store.rows = store.rows.filter((r) => r.id !== id);
      return store.rows.length < before;
    },
  });

  return { service, store };
}

describe('createCredentialService', () => {
  beforeAll(() => {
    registerGenericCredentialTypes();
  });

  it('creates and lists credentials without exposing secrets', async () => {
    const { service } = createInMemoryService();

    const created = await service.create({
      name: 'gitlab',
      type: 'apiKey',
      data: { apiKey: 'secret-token' },
    });
    expect(created).toEqual({
      id: created.id,
      name: 'gitlab',
      type: 'apiKey',
    });
    expect(created).not.toHaveProperty('data');

    const list = await service.list();
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty('dataEncrypted');

    const resolved = await service.resolveSecret(created.id);
    expect(resolved).toEqual({ apiKey: 'secret-token' });
  });

  it('create rejects apiKey without apiKey field', async () => {
    const { service } = createInMemoryService();

    await expect(
      service.create({
        name: 'missing-key',
        type: 'apiKey',
        data: { headerName: 'Authorization' },
      }),
    ).rejects.toThrow(AwfError);
  });

  it('resolveForAuth returns type and data', async () => {
    const { service } = createInMemoryService();

    const created = await service.create({
      name: 'auth-cred',
      type: 'apiKey',
      data: { apiKey: 'my-key', headerName: 'X-Api-Key' },
    });

    const resolved = await service.resolveForAuth(created.id);
    expect(resolved).toEqual({
      type: 'apiKey',
      data: { apiKey: 'my-key', headerName: 'X-Api-Key' },
    });
  });

  it('test returns ok for valid credential', async () => {
    const { service } = createInMemoryService();

    const created = await service.create({
      name: 'valid',
      type: 'apiKey',
      data: { apiKey: 'secret' },
    });

    const result = await service.test(created.id);
    expect(result).toEqual({ ok: true });
  });

  it('test returns ok:false when validation fails', async () => {
    const { service, store } = createInMemoryService();

    store.rows.push({
      id: 'invalid',
      name: 'invalid',
      type: 'apiKey',
      dataEncrypted: encryptCredentialPayload('{}', testKey),
    });

    const result = await service.test('invalid');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Missing required field: apiKey/);
  });
});
