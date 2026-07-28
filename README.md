# RX-Workflow（RXWF）

面向研发与运维团队的 **AI-Native 工作流平台**：可视化 DAG 编排（对标 n8n 核心路径），叠加 Agent / Chat / RAG、双向 MCP，以及 Cursor 等 AI IDE 内闭环调试与运行。

## 特性概览

- **工作流编排**：Items 数据流、`{{ }}` 表达式、凭证、Webhook / 定时触发、Code 沙箱
- **AI 能力**：模型目录（含 Ollama）、AI Agent / Crew、知识库 RAG、内置 Chat Bot
- **MCP 双向**：作为 Client 调用外部工具；内置 MCP Server 供 IDE 反控本系统
- **跨平台 Runner**：Embedded 与远程 Agent（Windows / Linux / macOS）执行代码与命令类节点
- **多档位部署**：Lite（SQLite 单进程）/ Standard（PostgreSQL + Redis）等，见 [docs/adr-deployment.md](docs/adr-deployment.md)

## 环境要求

- Node.js `>= 20`
- [pnpm](https://pnpm.io/) `9.x`（仓库已声明 `packageManager`）
- Docker（可选，用于 Compose 部署或 Standard 依赖）

## 快速开始（本地开发）

```bash
pnpm install
pnpm dev
```

- API 默认：`http://localhost:8787`
- Web 开发服：Vite（通常 `http://localhost:5173`，以终端输出为准）

常用命令：

| 命令 | 说明 |
|------|------|
| `pnpm build` | Turbo 构建 |
| `pnpm test` | Turbo 测试 |
| `pnpm reset:data` | 清理本地数据并释放开发端口 |
| `pnpm rxwf start --with-web` | CLI 启动（可配合 `--lite` / `--standard`） |

更多 CLI 参数见 [docs/deployment-cli-cheatsheet.md](docs/deployment-cli-cheatsheet.md)。

## Docker 部署

**Lite**（单容器，SQLite）：

```bash
docker compose -f deploy/compose.lite.yaml up -d --build
curl -sf http://localhost:8787/api/ready
```

**Standard**（Postgres + Redis + API）：

```bash
docker compose -f deploy/compose.standard.yaml up -d --build
curl -sf http://localhost:8787/api/ready
```

详情：[deploy/README.md](deploy/README.md)。远程 Runner：[docs/runner-agent-quickstart.md](docs/runner-agent-quickstart.md)。

## 仓库结构

```
apps/
  api/          # Fastify HTTP API、执行与 MCP
  web/          # React 控制台
packages/       # 工作流、表达式、执行引擎、节点、Provider、Runner 等
deploy/         # Compose 与部署说明
docs/           # 规格、ADR、帮助与指南
examples/       # 示例（含 Skill 等）
```

## 文档

| 文档 | 说明 |
|------|------|
| [docs/README.md](docs/README.md) | 文档索引 |
| [docs/spec.md](docs/spec.md) | 产品规格 |
| [docs/expression-guide.md](docs/expression-guide.md) | 表达式与 `$env` / `$vars` |
| [docs/code-node-guide.md](docs/code-node-guide.md) | Code 节点 |
| [docs/help/zh/index.md](docs/help/zh/index.md) | 应用内帮助文稿 |

平台环境变量（`RXWF_*`）在「设置 → 平台环境」配置；工作流通过 `$env.RXWF_*` 引用（按类型注入）。自定义键请使用「变量」页（`$vars`）。

## 许可证

[MIT](./LICENSE) © 2026 rxware-group
