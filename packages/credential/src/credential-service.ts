import './apply-auth.js';
import { AwfError } from '@rxwf/shared';
import {
  decryptCredentialPayload,
  encryptCredentialPayload,
  type parseCredentialKey,
} from './crypto.js';
import { getCredentialType, validateCredentialData } from './types/registry.js';

export interface CredentialSummary {
  id: string;
  name: string;
  type: string;
}

export interface CredentialStoreRow {
  id: string;
  name: string;
  type: string;
  dataEncrypted: string;
}

export interface CredentialServiceDeps {
  encryptionKey: ReturnType<typeof parseCredentialKey>;
  insert(row: CredentialStoreRow): Promise<void>;
  list(): Promise<CredentialSummary[]>;
  findById(id: string): Promise<CredentialStoreRow | null>;
  deleteById(id: string): Promise<boolean>;
}

export function createCredentialService(deps: CredentialServiceDeps) {
  return {
    async create(input: {
      name: string;
      type: string;
      data: Record<string, unknown>;
    }): Promise<CredentialSummary> {
      validateCredentialData(input.type, input.data);
      const id = crypto.randomUUID();
      const dataEncrypted = encryptCredentialPayload(
        JSON.stringify(input.data),
        deps.encryptionKey,
      );
      await deps.insert({
        id,
        name: input.name,
        type: input.type,
        dataEncrypted,
      });
      return { id, name: input.name, type: input.type };
    },

    async list(): Promise<CredentialSummary[]> {
      return deps.list();
    },

    async resolveSecret(id: string): Promise<Record<string, unknown>> {
      const row = await deps.findById(id);
      if (!row) {
        throw new AwfError('E1001', `Credential not found: ${id}`);
      }
      const plain = decryptCredentialPayload(row.dataEncrypted, deps.encryptionKey);
      return JSON.parse(plain) as Record<string, unknown>;
    },

    async resolveForAuth(
      id: string,
    ): Promise<{ type: string; data: Record<string, unknown> }> {
      const row = await deps.findById(id);
      if (!row) {
        throw new AwfError('E1001', `Credential not found: ${id}`);
      }
      const plain = decryptCredentialPayload(row.dataEncrypted, deps.encryptionKey);
      const data = JSON.parse(plain) as Record<string, unknown>;
      return { type: row.type, data };
    },

    async test(id: string): Promise<{ ok: boolean; message?: string }> {
      const row = await deps.findById(id);
      if (!row) {
        throw new AwfError('E1001', `Credential not found: ${id}`);
      }
      const plain = decryptCredentialPayload(row.dataEncrypted, deps.encryptionKey);
      const data = JSON.parse(plain) as Record<string, unknown>;
      try {
        validateCredentialData(row.type, data);
      } catch (err) {
        if (err instanceof AwfError) {
          return { ok: false, message: err.message };
        }
        throw err;
      }
      const def = getCredentialType(row.type);
      if (def?.testConnection) {
        return def.testConnection(data);
      }
      return { ok: true };
    },

    async remove(id: string): Promise<void> {
      const deleted = await deps.deleteById(id);
      if (!deleted) {
        throw new AwfError('E1001', `Credential not found: ${id}`);
      }
    },
  };
}
