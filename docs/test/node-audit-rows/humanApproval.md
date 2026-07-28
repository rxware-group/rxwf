# humanApproval 节点审查（AUDIT-N-humanApproval）

> M-3 Wave 2 / T-044 | track: lite | category: logic

## 审查结论

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 含 prompt/summaryField/allowReject/allowSupplement/timeoutMs/timeoutAction；通用 `NodeEditorParamsPane` 渲染；E2E 面板字段可见 |
| validation | ok | 无专属拓扑/参数硬校验；`validateWorkflowDefinition` 对 humanApproval 无额外错误；保存可通过 |
| executor | ok | `human-approval.ts` 注册于 `register-builtin.ts`；返回 `waiting` + `metadata.hitl`；select 布尔字符串已解析 |
| error_codes | — | 正常路径不抛节点级 E 码；未注册时 registry 抛 `E2003`；HITL 超时/驳回由执行引擎处理 |
| status | ok | lite 轨 E2E 通过：面板 + debug-node waiting + 执行暂停/审批恢复 |

## 修复项（T-044）

1. **布尔 select 解析**：面板 `allowReject`/`allowSupplement` 为 `'true'/'false'` 字符串，执行器原用 `!== false` / `=== true` 导致误判；改为 `parseRejectFlag` / `parseConfigFlag`。
2. **测试补齐**：executor 注册与布尔解析单测；`apps/web/e2e/nodes/humanApproval.spec.ts` 覆盖面板与 HITL 全链路。

## 追溯

- FR-09 / AC-024, AC-028, AC-030
- 集成参考：`apps/api/src/integration/p4b-hitl.integration.test.ts`
