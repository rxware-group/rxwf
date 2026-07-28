import type { EnvVarRecord, GlobalEnvSyncInput, GlobalEnvVarItem } from './types.js';

export function groupGlobalEnvRecords(records: EnvVarRecord[]): GlobalEnvVarItem[] {
  const byKey = new Map<string, GlobalEnvVarItem>();

  for (const row of records) {
    if (row.scope !== 'global') continue;
    let item = byKey.get(row.key);
    if (!item) {
      item = {
        key: row.key,
        sensitive: row.sensitive,
        value: row.sensitive ? '***' : row.value,
        testEnabled: false,
        prodEnabled: false,
      };
      byKey.set(row.key, item);
    }
    if (row.sensitive) item.sensitive = true;
    if (row.environment === 'test') {
      item.testEnabled = true;
      item.testId = row.id;
      if (!row.sensitive) item.value = row.value;
    } else if (row.environment === 'prod') {
      item.prodEnabled = true;
      item.prodId = row.id;
      if (!row.sensitive && !item.testEnabled) item.value = row.value;
    }
  }

  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function globalEnvSyncToUpserts(input: GlobalEnvSyncInput): Array<{
  environment: 'test' | 'prod';
  key: string;
  value: string;
  sensitive: boolean;
}> {
  const out: Array<{
    environment: 'test' | 'prod';
    key: string;
    value: string;
    sensitive: boolean;
  }> = [];
  const sensitive = input.sensitive ?? false;
  if (input.testEnabled) {
    out.push({
      environment: 'test',
      key: input.key,
      value: input.value,
      sensitive,
    });
  }
  if (input.prodEnabled) {
    out.push({
      environment: 'prod',
      key: input.key,
      value: input.value,
      sensitive,
    });
  }
  return out;
}
