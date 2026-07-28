# Human Approval 节点

## 用途

暂停工作流执行，等待 **人工审批**（通过 / 驳回 / 可选补充输入）后继续。Human Approval 为 **逻辑** 节点，执行器返回 `waiting` 状态并在 `metadata.hitl` 中携带提示与摘要，供编辑器 HITL 面板与 API 恢复接口使用。适合发布审批、敏感操作确认、人工抽检等场景。

## 端口与连接

| 方向 | ID | 说明 |
|------|-----|------|
| 输入 | main | 待审批的 Items |
| 输出 | main | 审批通过后原样传递（或带补充数据）；驳回由引擎按策略处理 |

```
set → humanApproval → httpRequest / executeWorkflow …
```

执行到该节点时工作流进入 **waiting**；用户在执行详情中 **批准** 或 **驳回** 后，引擎调用 `resumeHitlExecution` 继续下游。

## 参数

| 参数 | 说明 |
|------|------|
| **审批提示**（`prompt`） | 展示给审批人的文案，支持 `{{ }}` 模板 |
| **摘要字段**（`summaryField`） | 可选表达式，默认序列化全部输入 JSON |
| **允许驳回**（`allowReject`） | `'true'` / `'false'`，默认允许 |
| **允许补充输入**（`allowSupplement`） | 审批时可附加 JSON，默认 `'false'` |
| **超时 (ms)**（`timeoutMs`） | `0` 表示无超时 |
| **超时策略**（`timeoutAction`） | `reject` 或 `approve` |

`prompt` 与 `summaryField` 按首条 Item 上下文求值。布尔 select 在运行时会解析字符串 `'true'/'false'`。

## 常见错误

| 错误码 / 现象 | 说明 |
|---------------|------|
| **E2003** | Plus/Lite registry 未注册该类型（不应出现在 lite 轨） |
| 长期 **waiting** | 未在 UI/API 完成审批；检查 `timeoutMs` 与通知 |
| 驳回后下游未执行 | 引擎按驳回策略终止或走错误分支，属预期行为 |
| 摘要为空 | `summaryField` 留空且输入 Items 为空 |

## 示例

### 示例 A

部署前确认：`prompt` 为 `请确认是否部署 {{ $json.version }}`，`allowReject=true`，通过后继续 HTTP 发布。

### 示例 B

大额转账：`summaryField` 设为 `{{ $json.amount }}`，`timeoutMs=3600000`、`timeoutAction=reject`，一小时未审批自动驳回。

### 示例 C

允许补充：`allowSupplement=true`，审批人可附加 `{ "comment": "..." }` 合并进下游 Items，供审计日志节点记录。
