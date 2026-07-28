# Release v1.3 — CrewAI Sidecar 集成 (P4-D)

**状态：P4-D1 / D2 / D3 已全部落地**（2026-05-30）。后续增强见下方「已知限制」。

Plus 部署下 Crew 节点可选 **`executionBackend: 'crewai'`**，经 `packages/crewai-runner` Sidecar 执行 sequential / hierarchical 编排；MCP / HTTP / Workflow Tool 经 API 桥回调，无需把凭证明文传入 Python 进程。

## 功能摘要

- **双执行后端**：Crew 节点默认 `native`（零 Sidecar 依赖）；可选 `crewai` 走 Sidecar kickoff
- **`AwfCrewIrV1` + `compileCrewIr()`**：画布 Crew 拓扑编译为 Sidecar 契约 IR
- **`packages/crewai-runner`**：`/health`、`POST /v1/kickoff`；sequential / hierarchical adapter；Ollama + openai-compatible LLM（credential 桥）
- **Tool 桥接**：Sidecar `BridgeTool` → `POST /internal/crew-tool/:bridgeId`（短 TTL token，绑定 executionId）
- **编辑器**：Crew 节点 `executionBackend` 字段；保存时 **E1040**（未配置 Runner）、**E1041**（内置 Tool 白名单）、**W1013**（成员无 Tool 警告）
- **CLI 联署**：`rxwf start --with-crewai`、`rxwf deps up --services crewai`；自动注入 `CREWAI_RUNNER_URL`
- **Compose**：`deploy/docker-compose.crewai.yml`（overlay）、`deploy/docker-compose.plus.yml`（全栈含 Sidecar）
- **可观测性**：crewai 成功时 `node_runs.metadata.agentSteps` / `crewSteps` 写入执行详情

## 验收命令

```bash
pnpm test
pnpm --filter @rxwf/workflow test
pnpm --filter @rxwf/node-runner test
pnpm --filter @rxwf/api test -- p4d
pnpm --filter @rxwf/api exec vitest run src/integration/p4c-crew.integration.test.ts
pnpm --filter @rxwf/web typecheck
pnpm --filter @rxwf/i18n-catalog test
pnpm --filter @rxwf/cli test
```

### 可选本地附加

```bash
# 真实 crewai-runner Sidecar 冒烟（需 Docker + Ollama）
RXWF_TEST_CREWAI=1 pnpm --filter @rxwf/api test -- p4d-crewai-e2e

# Lite 开发栈 + Sidecar 联署后手动跑 sequential crewai 工作流
pnpm rxwf start --lite --with-crewai --with-web
```

## `--with-crewai` 用法

| 场景 | 命令 |
|------|------|
| Lite + 自动 Sidecar | `pnpm rxwf start --lite --with-crewai` |
| Standard + 自动 Sidecar | `pnpm rxwf start --standard --with-crewai` |
| 仅拉起 Sidecar | `pnpm rxwf deps up --services crewai` |
| 外部 Sidecar（跳过 Docker） | `pnpm rxwf start --lite --crewai-url http://127.0.0.1:8071` |
| 全栈生产/演示 | `docker compose -f deploy/docker-compose.plus.yml up -d` |

**启动顺序（`--with-crewai`）**

1. 若已设 `CREWAI_RUNNER_URL` 或 `--crewai-url` → 仅 `/health` 探测；失败 **AWF-START-008**
2. 否则 `docker compose up -d crewai-runner`（merge standard + crewai overlay）→ 等待 healthy
3. 将 `http://127.0.0.1:{RXWF_CREWAI_PORT}` 写入 API 子进程 `CREWAI_RUNNER_URL`

默认 **`rxwf start` 不带 `--with-crewai`**，避免强依赖 Docker 与镜像拉取。

## 环境变量

| 变量 | 对应 CLI | 用途 |
|------|----------|------|
| `CREWAI_RUNNER_URL` | `--crewai-url` | Sidecar 基址；CLI 注入 > 环境变量 |
| `RXWF_CREWAI_PORT` | — | Docker 宿主机绑定，默认 `127.0.0.1:8071:8071` |
| `RXWF_CREWAI_IMAGE` | — | 覆盖 Sidecar 镜像（默认 `ghcr.io/rxwf/crewai-runner:1.3.0`） |

Sidecar 容器内常用：`CREWAI_TELEMETRY=false`、`RXWF_TOOL_BRIDGE_HOST=api`（plus compose）。

## 错误码（i18n）

| 代码 | 说明 |
|------|------|
| E1040 | CrewAI 后端未配置 Runner（校验）；**另见** workflow 重名冲突（同名码，语境不同） |
| E1041 | CrewAI 内置 Tool 不在允许列表 |
| E1042 | Sidecar 未配置 / kickoff 或健康检查失败 |
| E1043 | Sidecar kickoff 超时 |
| E1044 | Sidecar IR 版本不支持 |
| E1045 | Tool 桥 token 无效 / 桥未配置；Credential 桥解析失败；openai-compatible 缺少 API Key |
| E1046 | Consensual process 尚未支持 / 不支持的 process 组合 |
| W1013 | crewai 后端成员无 Tool 且无内置 Tool（警告） |
| W1014 | Flow 模式用于非 sequential Crew（警告） |
| AWF-START-008 | `--with-crewai` 时 Sidecar 容器启动或健康检查失败 |

详见 [error-codes.md](./error-codes.md)、CLI 速查 [deployment-cli-cheatsheet.md](./deployment-cli-cheatsheet.md)。

## 相关文档

- 设计：[2026-05-29-crewai-integration-design.md](./superpowers/specs/2026-05-29-crewai-integration-design.md)
- 实施计划：[2026-05-29-crewai-integration.md](./superpowers/plans/2026-05-29-crewai-integration.md)
- P4-C native Crew：[RELEASE-v1.1-agent.md](./RELEASE-v1.1-agent.md)（Agent / Crew native 路径）

## P4-D2 已交付

- **Memory 桥接**：kickoff 前注入 `member.memory.history`；成功后回写 `agent_session_messages`
- **`crewSupervisor` + crewai**：IR `process: supervisor` → Sidecar `Process.hierarchical` + `manager_agent`
- **SSE 流式**：`POST /v1/kickoff/stream`；有 `onAgentStream` 时增量 `agent_step`
- **Knowledge 预检索**：成员 `knowledgeBaseIds` → `deps.knowledge.queryMany`；默认 `crewaiKnowledgeMode: inject` 注入 `backstory`；`native` 注入 `member.knowledge.chunks` 供 Sidecar `StringKnowledgeSource`
- **成员 `taskDescription` / `expectedOutput`**：编辑器字段 + IR → CrewAI `Task`
- **`enableBuiltinTools`**：Crew 节点 JSON 白名单 → IR `crewai-builtin`；`CREWAI_ALLOWED_BUILTIN_TOOLS` 环境变量校验 **E1041**

## P4-D3 已交付

- **flowGraph IR**：`crewaiFlowMode: flow` 编译线性 start → task* → end 图；Sidecar `flow_runner` 执行
- **Consensual process**：保存校验 **E1046**（Sidecar 尚未支持，待 CrewAI GA）
- **crewEval**：`enableEval: true` 时 Sidecar 返回评测摘要，写入 `metadata.crewEval` 与 output JSON

## P4-D+ 已交付（post-D3 增强）

- **Flow router 条件**：`flowRouter` JSON；Sidecar 条件语法 `contains:` / `equals:` / `json.field:` / `regex:`
- **Knowledge 原生适配器**：`crewaiKnowledgeMode: native` → `StringKnowledgeSource`；默认 `inject` 仍注入 backstory
- **openai-compatible 模型**：Credential 桥 `POST /internal/crew-credential/:ref`；可选 `OPENAI_API_KEY`
- **Runner v1.1 远程 Sidecar**：`rxwf-runner` `crewaiSidecarUrl` + WS `presence`；`createResolvableCrewAiClient` 动态解析

## 已知限制 / 后续

- **Consensual process**：Sidecar 仍报 **E1046**（待 CrewAI GA）
- **Lite 无 Docker**：无法 `--with-crewai` 自动联署；需外部/远程 Sidecar 或改 `native`
- **Tool 桥网络**：远程 Sidecar 须能访问 API `publicUrl`（内网/VPN）
- **多 Sidecar 负载均衡**：当前取首个 healthy URL（v1.2+）
