# Runners

在 **设置 → Runners**（`/settings/runners`）中查看已注册的执行 Runner，并（Admin）生成 Agent Runner 注册令牌。

## Runner 类型

| 类型 | 说明 |
|------|------|
| **Embedded** | 内嵌于 API 服务进程，开箱即用，适合开发与小规模部署 |
| **Agent** | 独立 `rxwf-runner` 进程，可水平扩展、带标签与能力筛选 |

工作流节点（如 Code、HTTP）在配置了 Runner 标签时会路由到匹配的 Agent Runner。

## 列表字段

- **状态**：online / draining / offline
- **负载**：当前运行任务数 / 最大并发
- **平台**：操作系统与架构
- **标签 / 能力**：调度匹配用
- **最后心跳**：离线 Runner 显示为 —

## 注册 Agent Runner（Admin）

1. 点击 **创建注册令牌**，复制令牌（有时效）。
2. 在 Runner 机器执行：
   ```bash
   rxwf-runner register --config rxwf-runner.json --token <令牌>
   rxwf-runner start --config rxwf-runner.json
   ```
3. 配置文件中 `serverUrl` 应指向平台 [Public URL](/help/settings/system)。

刷新列表确认 Runner 上线且心跳正常。

## 只读说明

非 Admin 用户可查看 Runner 列表，无法创建注册令牌。

## 相关页面

- [Setup](/help/settings/setup) — 检查 embedded runner 是否就绪
- [系统设置](/help/settings/system) — Public URL
