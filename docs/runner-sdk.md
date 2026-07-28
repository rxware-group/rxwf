# Runner SDK — 第三方扩展指南

> 在 **Runner Agent** 上注册额外 `NodeExecutor`、能力标签与生命周期钩子。公开包：`@rxwf/runner-sdk`。  
> Agent 集成见 [runner-agent-quickstart.md](./runner-agent-quickstart.md)；**扩展开发、打包、部署完整流程**见 [runner-extension-packaging-deployment.md](./runner-extension-packaging-deployment.md)；节点插件（控制面）见 [node-plugin-spec.md](./node-plugin-spec.md)。

---

## 1. 概述

| 概念 | 说明 |
|------|------|
| **RunnerExtension** | 扩展入口：manifest + 可选 `register` / `lifecycle` / `middleware` |
| **manifest** | 静态元数据：id、版本、capabilities、nodeTypes、runnerSdk 兼容范围 |
| **ExtensionHost** | Agent 启动时加载 `rxwf-runner.json` 的 `extensions` 并聚合能力 |
| **validateExtensionManifest** | 启动前校验 manifest 与当前 SDK 主版本是否兼容 |

内置 Agent 已注册 **`code`** 与 **`executeCommand`**（`shell` capability）。扩展用于 WMI、自定义 CLI 等 **仅能在 Runner 上执行** 的节点类型。

---

## 2. 包结构

```
my-rxwf-runner-extension/
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts          # export default RunnerExtension
└── dist/
    └── index.js
```

`package.json` 示例：

```json
{
  "name": "@acme/rxwf-wmi-executor",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "peerDependencies": {
    "@rxwf/runner-sdk": "^1.0.0",
    "@rxwf/node-runner": "^1.0.0"
  }
}
```

在 Agent 配置中引用（npm 包名或相对路径）：

```json
{
  "extensions": [
    "@acme/rxwf-wmi-executor",
    "./plugins/custom.js"
  ]
}
```

---

## 3. RunnerExtensionManifest

```typescript
import type { RunnerExtensionManifest } from '@rxwf/runner-sdk';

export const manifest: RunnerExtensionManifest = {
  /** 全局唯一 ID */
  id: '@acme/rxwf-wmi-executor',
  version: '1.0.0',
  /** 合并进 Agent 注册时的 capabilities */
  capabilities: ['wmi'],
  /** 应与本扩展 registerExecutor 的 type 一致 */
  nodeTypes: ['wmi.query'],
  /** 与 @rxwf/runner-sdk 主版本对齐，如 ^1.0.0 */
  runnerSdk: '^1.0.0',
  /** 可选：兼容的控制面版本范围 */
  awfServer: '^1.1.0',
  description: 'Windows WMI query executor',
};
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | ✓ | 如 `@acme/rxwf-wmi-executor` |
| `version` | ✓ | Semver |
| `runnerSdk` | ✓ | 兼容的 runner-sdk 范围（**主版本**须与 Agent 内置 SDK 一致） |
| `capabilities` | — | 注册时上报给控制面，供调度过滤 |
| `nodeTypes` | — | 文档/校验用；须与 `registerExecutor` 的 `type` 一致 |
| `awfServer` | — | 可选控制面版本约束 |
| `description` | — | 人类可读说明 |

---

## 4. RunnerExtension

```typescript
import type { NodeExecutor, NodeRunResult } from '@rxwf/node-runner';
import type { RunnerExtension } from '@rxwf/runner-sdk';

const wmiExecutor: NodeExecutor = {
  type: 'wmi.query',
  async execute(ctx): Promise<NodeRunResult> {
    const query = String(ctx.config.query ?? '');
    if (!query) {
      return {
        status: 'failed',
        errorCode: 'E2002',
        errorMessage: 'query is required',
        outputItems: [[]],
      };
    }
    // …调用 WMI / 本地 API…
    return {
      status: 'success',
      outputItems: [[{ json: { rows: [] } }]],
    };
  },
};

const extension: RunnerExtension = {
  manifest: {
    id: '@acme/rxwf-wmi-executor',
    version: '1.0.0',
    runnerSdk: '^1.0.0',
    capabilities: ['wmi'],
    nodeTypes: ['wmi.query'],
  },
  async register(ctx) {
    ctx.registerExecutor(wmiExecutor);
    ctx.registerCapability('wmi', async () => process.platform === 'win32');
  },
  lifecycle: {
    onAgentStart(ctx) {
      ctx.logger.info('WMI extension started');
    },
    onJobEnd(job, result, ctx) {
      ctx.logger.debug('job finished', { jobId: job.jobId, status: result.status });
    },
  },
};

export default extension;
```

### 4.1 `RunnerExtensionContext`

| 成员 | 说明 |
|------|------|
| `registerExecutor(executor)` | 注册 `NodeExecutor`（与 `node-runner` 相同契约） |
| `registerCapability(name, probe)` | 动态能力；`probe()` 为 false 时调度器不应派发 |
| `config` | 只读 Agent 配置（serverUrl、runnerId、labels 等） |
| `logger` | 结构化日志（debug / info / warn / error） |

### 4.2 可选：`middleware`

在 Executor 外包一层（审计、限流等）：

```typescript
middleware: [
  {
    id: 'audit',
    async execute(ctx, next, meta) {
      const result = await next();
      // …记录 meta.jobId / meta.nodeType…
      return result;
    },
  },
],
```

---

## 5. validateExtensionManifest

Agent 在加载每个扩展时调用（`ExtensionHost` 与 `rxwf-runner validate-extensions` 共用逻辑）：

```typescript
import { validateExtensionManifest } from '@rxwf/runner-sdk';

const RUNNER_SDK_VERSION = '1.0.0'; // Agent 内置版本

const result = validateExtensionManifest(manifest, RUNNER_SDK_VERSION);
if (!result.ok) {
  throw new Error(result.reason);
}
```

返回值：

```typescript
type ValidateExtensionManifestResult =
  | { ok: true }
  | { ok: false; reason: string };
```

常见失败原因：

| reason | 含义 |
|--------|------|
| `manifest.runnerSdk is required` | 未填写 `runnerSdk` |
| `runnerSdk … is incompatible with sdk …` | manifest 与 Agent 内置 SDK **主版本**不一致（如 manifest `^1.0.0` 但 Agent 为 `2.x`） |

单元测试示例见 `packages/runner-sdk/src/validate-manifest.test.ts`。

---

## 6. 本地开发与校验

1. 构建扩展：`pnpm build`
2. 在 `rxwf-runner.json` 的 `extensions` 中加入包名或 `./dist/index.js`
3. 校验 manifest 与模块导出：

```bash
pnpm --filter @rxwf/runner-agent build
pnpm exec rxwf-runner validate-extensions --config ./runner-config/rxwf-runner.json
```

期望输出：

```
OK ./plugins/my-extension.js (@acme/rxwf-wmi-executor@1.0.0)
```

4. 注册 / 启动 Agent（扩展能力会合并进 `POST /runners/register` 的 `capabilities`）：

```bash
pnpm exec rxwf-runner register --config ./runner-config/rxwf-runner.json --token "<token>"
pnpm exec rxwf-runner start --config ./runner-config/rxwf-runner.json
```

---

## 7. 与控制面插件的关系

| 层 | 包 | 运行位置 |
|----|-----|----------|
| 工作流节点定义 + 编辑器 UI | `@rxwf/node-sdk` / 插件 host | 控制面 + Embedded Runner |
| **Runner 扩展** | `@rxwf/runner-sdk` | **仅 Runner Agent 进程** |

工作流插件通过 `NodeDefinition.runnerRequirements` 声明所需 `platforms` / `capabilities`（见 [node-plugin-spec.md](./node-plugin-spec.md) §4.1）。扩展 manifest 的 `capabilities` / `nodeTypes` 须与插件声明一致，否则调度成功但 Agent 返回 **E2016**（节点类型不受支持）。

---

## 8. 安全提示

- 扩展与内置 Executor 相同，运行在 Agent 进程内；避免 `eval` 不可信输入。
- 命令类节点仍受平台 **命令白名单** 约束（见 FR-2、FR-23）。
- 凭证不应写入 manifest；通过节点 `parameters` 或 Agent 本地密钥文件注入。

---

## 相关文档

- [runner-agent-quickstart.md](./runner-agent-quickstart.md)
- [adr-node-runner.md](./adr-node-runner.md) §6.2 — Agent 安全
- [error-codes.md](./error-codes.md) — E2010 / E2016 等
