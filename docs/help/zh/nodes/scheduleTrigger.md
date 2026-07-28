# Schedule Trigger 节点

## 用途

**Schedule Trigger（定时触发器）** 按 **Cron 表达式** 在后台周期性启动已发布工作流，适合日报同步、巡检、清理任务与定时报表。调度器扫描工作流定义中的 `scheduleTrigger.parameters.cron`，结合工作流 **settings.timezone** 判断到期并入队执行。

编辑器内 **▶ 执行** 或 **debug-node** 不会等待真实时钟，而是立即输出含 `cron` 字段的调试 Items，便于验证表达式与下游逻辑。生产触发由 API 调度进程负责（`list-due-schedules` → job enqueue）。

## 端口与连接

Schedule Trigger 为 **触发器**：**无上游输入**，仅 **main** 出口（ID `0`）。

```
scheduleTrigger ──main(0)──→ set / httpRequest / executeWorkflow …
```

同一工作流不得与 manual / webhook 等主触发器并存；发布前须配置有效 Cron 并设置时区（工作流设置）。

## 参数

| 参数 | 说明 |
|------|------|
| **cron** | 标准 **5 段** Cron 表达式（分 时 日 月 周），默认 `0 * * * *`（每小时整点）。例：`0 10 * * *` 每天 10:00；`*/15 * * * *` 每 15 分钟。 |

### 执行器行为

- **无上游 inputItems**（正常调度 / debug-node）：输出 `[{ json: { cron: "<表达式>" } }]`
- **有 inputItems**：透传输入（用于特殊调试场景）

无效或空白 Cron 在调度扫描时被 **静默跳过**（`isCronDue` 返回 false），不会抛错码，但工作流永远不会被定时触发——发布前请在面板确认表达式。

## 常见错误

| 场景 | 错误码 | 说明与处理 |
|------|--------|------------|
| Cron 为空或语法无效 | — | 调度器跳过，不触发；修正 **cron** 并重新发布 |
| 未发布工作流 | — | 仅已发布版本参与调度；草稿修改不影响生产 Cron |
| 与 manual / webhook 共存 | **E1051** | 保留单一主触发器 |
| 执行器未注册 | **E2003** | 环境异常，检查 `scheduleTriggerExecutor` |

## 示例

### 示例 A

可复制配置（工作日早晨 9 点）：

```json
{
  "cron": "0 9 * * 1-5"
}
```

工作流 **settings.timezone** 设为 `Asia/Shanghai` 时按上海时区 9:00 触发。

### 示例 B

最小工作流 JSON：

```json
{
  "schemaVersion": 1,
  "name": "Daily sync",
  "settings": { "timezone": "Asia/Shanghai" },
  "nodes": [
    {
      "id": "st1",
      "type": "scheduleTrigger",
      "name": "Schedule",
      "position": { "x": 0, "y": 0 },
      "parameters": { "cron": "0 10 * * *" }
    },
    {
      "id": "h1",
      "type": "httpRequest",
      "name": "HTTP",
      "position": { "x": 240, "y": 0 },
      "parameters": { "url": "https://example.com/ping", "method": "GET" }
    }
  ],
  "connections": [{ "from": "st1", "to": "h1" }]
}
```

E2E：`apps/web/e2e/nodes/scheduleTrigger.spec.ts`。

### 示例 C

debug-node 输出验证：对 Schedule 节点执行 debug 后，OUTPUT 含 `{ "cron": "0 10 * * *" }`；下游可用 `{{ $json.cron }}` 写入日志或告警上下文，无需等待真实调度 tick。
