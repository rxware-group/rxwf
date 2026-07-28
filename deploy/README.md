# 部署说明

Compose 文件：

| 文件 | 用途 |
|------|------|
| [compose.lite.yaml](./compose.lite.yaml) | Lite 单容器（SQLite + 内置队列） |
| [compose.standard.yaml](./compose.standard.yaml) | Standard（Postgres + Redis + API） |

## Lite

```bash
docker compose -f deploy/compose.lite.yaml up -d --build
curl -sf http://localhost:8787/api/ready
```

## Standard

```bash
docker compose -f deploy/compose.standard.yaml up -d --build
curl -sf http://localhost:8787/api/ready
```

## Runner v1.1（远程 Agent）

启用 `rxwf-runner` 远程执行时请注意：

1. **API 单实例**：Lite 与 Standard 均须 **`replicas: 1`**（单 API 进程）。v1.1 使用进程内 `InMemoryRunnerGateway` 维护 WebSocket 连接与任务派发；多副本会导致 Agent 连到错误实例、任务丢失。多副本 + Redis 路由列入 v1.2。
2. **出站网络**：Agent 仅需 HTTPS/WSS 访问 API 的 `serverUrl`（与浏览器同源或配置的 `publicUrl`）。
3. **注册流程**：Admin 在「设置 → Runners」或 MCP `runner_create_registration_token` 创建 Token → 目标机器执行 `rxwf-runner register` → `rxwf-runner start`。详见 [runner-agent-quickstart.md](../docs/runner-agent-quickstart.md)。
4. **远程白名单**：仅 `code`、`executeCommand` 可走 Agent；其余节点在策略指向 Agent 时静默回退 Embedded。
5. **CrewAI Sidecar（可选）**：Agent 配置 `crewaiSidecarUrl` 后通过 WS `presence` 上报；控制面在无 `CREWAI_RUNNER_URL` 时可解析远程 Sidecar。

变更摘要：[changelog/runner-v1.1.md](../docs/changelog/runner-v1.1.md)  
设计：[runner-v1.1-websocket-design.md](../docs/superpowers/specs/2026-05-29-runner-v1.1-websocket-design.md)

### Kubernetes / 编排示例

```yaml
# 启用远程 Runner 时 — 勿 scale API > 1
spec:
  replicas: 1
```

Standard compose 已默认单 `api` 服务；若改用 Swarm/K8s，请显式限制 API Deployment 副本数。
