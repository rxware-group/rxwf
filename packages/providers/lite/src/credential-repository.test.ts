import { describe, it, expect } from 'vitest';
import { createCredentialService, parseCredentialKey } from '@rxwf/credential';
import { createLiteCredentialRepository } from './credential-repository.js';
import { createTestDb } from './test-db.js';

const testKey = parseCredentialKey(
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
);

describe('createLiteCredentialRepository', () => {
  it('persists encrypted credential data', async () => {
    const db = await createTestDb();
    const repo = createLiteCredentialRepository(db);
    const service = createCredentialService({
      encryptionKey: testKey,
      insert: (row) => repo.insert(row),
      list: () => repo.list(),
      findById: (id) => repo.findById(id),
    });

    const created = await service.create({
      name: 'api',
      type: 'httpHeaderAuth',
      data: { name: 'Authorization', value: 'Bearer x' },
    });
    const secret = await service.resolveSecret(created.id);
    expect(secret).toEqual({ name: 'Authorization', value: 'Bearer x' });
  });
});
