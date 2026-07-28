# Runner Agent 快速上手

> 将工作流节点派发到 **已注册的远程 Runner**（Linux / Windows / macOS）。架构见 [adr-node-runner.md](./adr-node-runner.md) §6、[spec.md](./spec.md) FR-23；REST 契约见 [openapi.yaml](./openapi.yaml) `Runners` 标签。  
> 扩展开发见 [runner-sdk.md](./runner-sdk.md)。

---

## 前置条件

| 项 | 说明 |
|----|------|
| 控制面 | API 已启动（本地 `pnpm dev` 或 Docker `deploy/compose.lite.yaml`） |
| Node.js | ≥ 20（源码运行 Agent 时） |
| 权限 | **Admin** 可创建 Runner 预注册 Token |
| 网络 | Agent 仅需 **HTTPS/WSS 出站** 访问控制面 |

内置 Agent 包：`packages/runner-agent`，CLI 名 **`rxwf-runner`**。

---

## 1. 启动控制面

```bash
pnpm install
pnpm dev
```

确认 API 就绪：

```bash
curl -sf http://localhost:8787/api/ready
```

生产环境请使用 [`deploy/compose.lite.yaml`](../deploy/compose.lite.yaml) 或 Standard 编排，并将下文 `SERVER_URL` 换成实际地址。

---

## 2. 创建预注册 Token（Admin）

使用 Admin API Key（`x-api-key`）或已登录会话 Cookie：

```bash
export SERVER_URL=http://localhost:8787
export RXWF_API_KEY=<your-admin-api-key>

curl -sf -X POST "$SERVER_URL/api/runners/registration-tokens" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $RXWF_API_KEY" \
  -d '{"labels":["ci"],"expiresInHours":24}'
```

响应示例：

```json
{
  "registrationToken": "rt_…",
  "expiresAt": "2026-05-31T12:00:00.000Z"
}
```

保存 `registrationToken`（**一次性**，仅用于下一步注册）。

---

## 3. 准备 Agent 配置

复制示例并按环境修改：

```bash
mkdir -p ./runner-config
cp packages/runner-agent/rxwf-runner.json.example ./runner-config/rxwf-runner.json
```

编辑 `./runner-config/rxwf-runner.json`（至少修改 `serverUrl`、`name`、`credentialFile`）：

```json
{
  "serverUrl": "http://localhost:8787",
  "credentialFile": "./runner-config/credential.json",
  "name": "dev-linux-01",
  "maxConcurrent": 4,
  "labels": ["ci"],
  "logLevel": "info"
}
```

---

## 4. 注册 Runner

**源码 / 本地 monorepo**（先构建 Agent）：

```bash
pnpm --filter @rxwf/runner-agent build

node packages/runner-agent/dist/cli/main.js register \
  --config ./runner-config/rxwf-runner.json \
  --token "<registrationToken>"
```

或使用 bin 别名：

```bash
pnpm exec rxwf-runner register \
  --config ./runner-config/rxwf-runner.json \
  --token "<registrationToken>"
```

成功后会：

1. 写入 `./runner-config/credential.json`（含 `runnerId` + `runnerCredential`，**仅注册响应返回一次**）
2. 回写 `rxwf-runner.json` 中的 `runnerId`

验证能力集（内置 `code`、`shell`）：

```bash
pnpm exec rxwf-runner info --config ./runner-config/rxwf-runner.json
```

---

## 5. 启动 Agent

```bash
pnpm exec rxwf-runner start --config ./runner-config/rxwf-runner.json
```

Agent 会：

- 读取凭证并连接 `wss://<host>/api/runners/{runnerId}/stream`
- 每 30s 发送 `presence`（心跳）
- 拉取并执行 `job.assign` 任务

确认在线：

```bash
curl -sf "$SERVER_URL/api/runners" -H "x-api-key: $RXWF_API_KEY" | jq .
```

列表中对应 Runner 的 `status` 应为 `online`，`capabilities` 含 `code` 与 `shell`。

---

## 6. 工作流：Code + executeCommand

将工作流 **固定（pinned）** 到刚注册的 `runnerId`，并设置 `fallback: fail`（生产推荐）。

`runnerId` 来自 `rxwf-runner info` 或 `credential.json`：

```json
{
  "schemaVersion": 1,
  "name": "Runner smoke",
  "active": true,
  "settings": {
    "runnerPolicy": {
      "mode": "pinned",
      "runnerId": "<runnerId-from-register>",
      "fallback": "fail"
    }
  },
  "nodes": [
    {
      "id": "t1",
      "type": "manualTrigger",
      "name": "Start",
      "position": { "x": 0, "y": 0 },
      "parameters": {}
    },
    {
      "id": "code-1",
      "type": "code",
      "name": "Code",
      "position": { "x": 100, "y": 0 },
      "parameters": {
        "jsCode": "return [{ json: { fromCode: true } }];"
      }
    },
    {
      "id": "cmd-1",
      "type": "executeCommand",
      "name": "Run",
      "position": { "x": 200, "y": 0 },
      "parameters": { "command": "echo ok" }
    }
  ],
  "connections": [
    { "from": "t1", "to": "code-1" },
    { "from": "code-1", "to": "cmd-1" }
  ]
}
```

在 Web 编辑器保存并 **手动执行**，或用 API：

```bash
# 创建工作流后替换 WORKFLOW_ID
curl -sf -X POST "$SERVER_URL/api/workflows/<WORKFLOW_ID>/executions" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $RXWF_API_KEY" \
  -d '{"mode":"manual"}'
```

执行成功后，`node_runs` 中 `code-1` 与 `cmd-1` 的 `runner_id` 应等于 Agent 的 `runnerId`（而非 Embedded Runner）。

---

## 7. Docker 运行 Agent

在 monorepo 根目录构建镜像：

```bash
docker build -f packages/runner-agent/Dockerfile -t rxwf-runner:local .
```

挂载配置目录（须含已注册后的 `rxwf-runner.json` 与 `credential.json`）：

```bash
docker run --rm -it \
  -v "$(pwd)/runner-config:/config:ro" \
  rxwf-runner:local
```

默认命令：`node dist/cli/main.js start --config /config/rxwf-runner.json`。

**首次注册**仍在容器外或一次性容器内完成（注册需 `--token`，且会写 credential 文件）：

```bash
pnpm exec rxwf-runner register \
  --config ./runner-config/rxwf-runner.json \
  --token "<registrationToken>"

docker run --rm -it \
  -v "$(pwd)/runner-config:/config:ro" \
  rxwf-runner:local
```

---

## CLI 速查

| 命令 | 作用 |
|------|------|
| `rxwf-runner register --config <path> --token <token>` | 用预注册 Token 换取长期凭证 |
| `rxwf-runner start --config <path>` | 连接控制面并执行任务 |
| `rxwf-runner info --config <path>` | 输出 `runnerId`、能力集 JSON |
| `rxwf-runner validate-extensions --config <path>` | 校验 `extensions` 清单 |

---

## 常见问题

| 现象 | 处理 |
|------|------|
| 注册 401 | Token 过期或已使用；Admin 重新 `POST /runners/registration-tokens` |
| Agent 连不上 WSS | 检查 `serverUrl`、反向代理是否支持 WebSocket |
| 节点 E2010 | 无在线 Runner 或 `runnerPolicy` 不匹配；确认 `pinned.runnerId` 与 Agent 一致 |
| executeCommand 失败 | 命令须在 Runner 白名单内；Windows Agent 使用 `cmd.exe` shell |
| CrewAI 远程 Sidecar | Agent 配置 `crewaiSidecarUrl`（如 `http://127.0.0.1:8071`）并注册 `crewai` 能力；控制面 `publicUrl` 须从 Sidecar 主机可达（Tool/Credential 桥） |

---

## 8. CrewAI 远程 Sidecar（Runner v1.1）

在 GPU/内网机器上运行 `crewai-runner`，由 `rxwf-runner` 向控制面宣告 Sidecar 地址：

1. 目标机启动 Sidecar：`uvicorn crewai_runner.main:app --host 0.0.0.0 --port 8071`
2. `rxwf-runner.json` 增加：

```json
{
  "crewaiSidecarUrl": "http://127.0.0.1:8071"
}
```

3. 重新 `register`（或已注册 Agent 重启 `start`）— 注册时自动加入 `crewai` capability
4. Agent 在线后，控制面可在**未设置** `CREWAI_RUNNER_URL` 时使用远程 Sidecar 执行 `executionBackend: crewai`

**注意**：Sidecar 回调 Tool/Credential 桥时使用工作流编译时的 `toolBridgeBaseUrl`（通常为 API `publicUrl`），须确保 Sidecar 所在网络能访问该地址。

---

## 相关文档

- [runner-sdk.md](./runner-sdk.md) — 第三方 Executor 扩展
- [adr-node-runner.md](./adr-node-runner.md) — 调度策略与数据模型
- [code-node-guide.md](./code-node-guide.md) — Code 节点沙箱说明
