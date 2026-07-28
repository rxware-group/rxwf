# Node Audit: merge

| 字段 | 值 |
| --- | --- |
| row_id | AUDIT-N-merge |
| node_type | merge |
| category | logic |
| track | lite |
| reviewed | 2026-06-20 (T-042) |

## 面板 (panel)

**结论：ok**

- `NODE_TYPE_META` + `node-param-schemas.ts` 提供 `inputCount`、`mode`（append / combineByKey / combineAll）、`matchField` 字段；E2E 确认编辑器模态中「合并模式」「输入数量」可渲染。
- `node-port-defs.ts` 按 `inputCount`（2–8）动态生成多输入端口。
- `node-params/merge.tsx` 导出 `shouldShowMergeParamField`：`matchField` 仅在 `mode=combineByKey` 时应显示（单元测试覆盖）。**注**：通用 `NodeEditorParamsPane` 尚未接入该 helper，`matchField` 在非 combineByKey 模式下仍可见（UX 轻微冗余，不阻塞 lite 轨）。

## 保存校验 (validation)

**结论：ok**

- `node-params/merge.tsx` 导出 `validateMergeParameters`：combineByKey 缺 `matchField` 或非法 `mode` 返回 `E2002`（单元测试覆盖）。
- 工作流级 `validate.ts` 未含 merge 专用规则（与 loop 拓扑校验不同）；运行时执行器对缺 `matchField` 抛 `AwfError(E2002)`，unsupported mode 返回 `failed` + `E2002`。
- 默认参数 `defaultNodeParameters('merge')` → `{ mode: 'append', inputCount: 2 }` 合法。

## 执行器 (executor)

**结论：ok**

- `packages/node-runner/src/executors/control-flow/merge.ts` 实现 append / combineByKey / combineAll。
- `register-builtin.ts` 注册 `mergeExecutor`；单测 `is registered via registerBuiltinExecutors` 通过。
- 执行引擎与 debug 路径对 merge 使用 `inputBranches`（`execution-engine.ts`、`run-debug-execution.ts`）。

## 错误码 (error_codes)

**结论：E2002**

| 场景 | 码 | 行为 |
| --- | --- | --- |
| combineByKey 缺/空 `matchField` | E2002 | 抛 `AwfError` |
| 不支持的 `mode` | E2002 | `status: failed`, `errorCode: E2002` |

> 与 Loop 保存校验复用同码不同义；以 merge 节点上下文解读。

## E2E (lite)

**结论：covered**

- Spec：`apps/web/e2e/nodes/merge.spec.ts`（E2E-N-merge）
- 覆盖：面板字段可见、append 双分支串联、combineByKey 按键合并

## 汇总

| panel | validation | executor | error_codes | status |
| --- | --- | --- | --- | --- |
| ok | ok | ok | E2002 | ok |

## 备注

- binary：append 保留各 item binary；combineByKey 取组内首个非空 binary（单测覆盖）。
- 后续可选：将 `shouldShowMergeParamField` / `validateMergeParameters` 接入 `NodeEditorParamsPane` 与 `validate.ts`（非 T-042 所有权范围）。
