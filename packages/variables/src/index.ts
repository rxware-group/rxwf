export type {
  VarEnvironment,
  VariablesRepositoryPort,
  VarScope,
  VarUpsertInput,
  VarRecord,
  GlobalVarSyncInput,
  GlobalVarItem,
} from './types.js';
export { recordsToMap, resolveVarLayers } from './resolve.js';
export { groupGlobalVarRecords, globalVarSyncToUpserts } from './global-vars.js';
export { loadResolvedVars, normalizeStoredEnvironment } from './load-resolved.js';
