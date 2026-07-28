# Node Audit: manualTrigger (AUDIT-N-manualTrigger)

> M-3 per-type review. Merged into `docs/test/node-audit-matrix.md` by T-080.

## Summary

| dimension | result | notes |
| --- | --- | --- |
| node_type | manualTrigger | trigger / lite |
| panel | ok | Generic `JsonParamEditor` via `node-param-schemas` `json` field |
| validation | ok | Save-time JSON validation via `editor-json-params` |
| executor | ok | `manualTriggerExecutor` registered in `register-builtin.ts` |
| error_codes | E1002 | Invalid `json` parameter at editor save or runtime |
| status | ok | lite track E2E green |
| e2e_spec | nodes/manualTrigger.spec.ts | E2E-N-manualTrigger |

## Evidence

- Unit: `packages/node-runner/src/executors/triggers/manual.test.ts` (registry E2003, output items, E1002)
- E2E: panel JSON field + debug-node emits configured items
