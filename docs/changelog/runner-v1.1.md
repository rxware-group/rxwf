# Runner v1.1 变更说明

> 设计：[2026-05-29-runner-v1.1-websocket-design.md](../superpowers/specs/2026-05-29-runner-v1.1-websocket-design.md)  
> 实施计划：[2026-05-29-runner-v1.1-websocket.md](../superpowers/plans/2026-05-29-runner-v1.1-websocket.md)

## 概要

- **WebSocket 任务通道**：Agent 经 `GET /api/runners/{id}/stream` 长连接接收 `job.assign`；HTTP heartbeat 已弃用。
- **生产 Agent**：`packages/runner-agent`（`rxwf-runner` CLI）+ `runner-sdk` 扩展体系。
- **三层 Runner 策略**：节点 > 工作流 > 全局 Embedded（`resolveEffectiveRunnerPolicy`）。
- **远程白名单（MVP）**：`code`、`executeCommand`、`httpRequest` 可走 Agent；其余节点静默回退 Embedded。
- **HTTP Credential**：控制面在 dispatch 前解析凭据，将 `Authorization` 等合并进 `headers`，远程 payload 不含 `credentialId`。
- **单实例 API**：`InMemoryRunnerGateway`；启用远程 Runner 时 **API `replicas: 1`**。
- **CrewAI 远程 Sidecar**：`rxwf-runner` 配置 `crewaiSidecarUrl` 后通过 WS `presence` 上报；控制面 `createResolvableCrewAiClient` 在无 `CREWAI_RUNNER_URL` 时使用远程 Sidecar。

## 新增包

| 包 | 说明 |
|----|------|
| `@rxwf/runner-protocol` | WS 信封、`RemoteNodeRunJob`、E2010–E2016 |
| `@rxwf/runner-sdk` | 第三方扩展 manifest 与校验 |
| `@rxwf/runner-agent` | `rxwf-runner` 运行时 |

## API 端点（v1.1）

- `POST /api/runners/registration-tokens` — Admin 创建注册 Token
- `POST /api/runners/register` — Agent 注册
- `GET /api/runners/{id}/stream` — WebSocket
- `DELETE /api/runners/{id}`、`POST .../drain`、`POST .../rotate-credential`
- `POST /api/runners/{id}/heartbeat` — **Deprecated**

## MCP

- `runner_list`
- `runner_create_registration_token`

## 部署注意

1. **API 副本数**：使用远程 Runner 时，Lite / Standard 均须 **单 API 进程**（`replicas: 1`）。多副本路由列入 v1.2。
2. **Agent 出站**：Agent 仅需 HTTPS/WSS 访问 API `serverUrl`。
3. **快速入门**：[runner-agent-quickstart.md](../runner-agent-quickstart.md)

## 验收清单

- [x] `rxwf-runner register` + `start` → `GET /api/runners` 显示 agent `online`
- [x] `code` / `executeCommand` / `httpRequest` 远程执行，`node_runs.runner_id` 为 agent
- [x] 三层策略：节点 > 工作流 > 全局 embedded
- [x] drain / rotate-credential 踢线行为正确
- [x] `pnpm lint:deps` 无 `runner-agent` → `providers` 实现层违规

```bash
pnpm --filter @rxwf/api test -- runner-v1.1-acceptance runner-agent-e2e runner-remote runner-ws runners-registration
pnpm exec depcruise packages/runner-agent packages/runner-sdk packages/runner-protocol --config .dependency-cruiser.cjs
```

**可选 spawn E2E**（spawn 真实 `rxwf-runner` 子进程，CI nightly 或本地）：

```bash
pnpm --filter @rxwf/runner-agent build
RXWF_TEST_RUNNER_AGENT=1 pnpm --filter @rxwf/api test -- runner-agent-e2e
```

GitHub Actions：[`nightly-runner-agent.yml`](../../.github/workflows/nightly-runner-agent.yml)（每日 03:00 UTC + `workflow_dispatch`）。
