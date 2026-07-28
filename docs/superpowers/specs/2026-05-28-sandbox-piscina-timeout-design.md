# 沙箱 Piscina 直切与 Code 超时配置 — 设计规格

| 字段 | 内容 |
|------|------|
| **状态** | **Implemented** — 实施计划 [2026-05-28-sandbox-piscina-timeout.md](../plans/2026-05-28-sandbox-piscina-timeout.md) |
| **日期** | 2026-05-28 |
| **策略** | **方案 A**：无 legacy 直切 Piscina + 显式超时字段与统一解析器 |
| **关联** | `packages/sandbox`、`packages/node-runner`、`apps/web` 环境变量页、`docs/queue-concurrency-optimization-summary.md` |

---

## 1. 背景与目标

### 1.1 现状

| 项 | 现状 |
|----|------|
| 沙箱执行 | `packages/sandbox/src/run-in-sandbox.ts` 自研 `WorkerPool`（`worker_threads` 复用） |
| 依赖 | `@rxwf/sandbox` 未引入 `piscina` |
| Code 节点超时 | `code.ts` 调用 `runInSandbox` **未传** `timeoutMs` → 默认不超时 |
| 环境变量 | 「设置 → 环境变量」为全局 `env_vars`（`/settings/env`），无 `SANDBOX_CODE_TIMEOUT_MS` 默认项 |
| 部署阶段 | 尚未上线，无生产 legacy 回退需求 |

### 1.2 目标

1. **无 legacy 直切 Piscina**：删除自研 `WorkerPool`，`runInSandbox` 底层改为 Piscina 线程池。
2. **Code 超时可配置**：通过全局环境变量 + Code 节点参数控制，默认 `-1`（不超时）。
3. **优先级明确**：`节点 timeoutMs` > `环境变量 SANDBOX_CODE_TIMEOUT_MS` > 内置兜底 `-1`。
4. **行为兼容**：未改配置的旧工作流仍为不超时；超时错误码保持 `E2002`。

### 1.3 非目标（本阶段）

- 运行时 `legacy | piscina` 双引擎开关与灰度切换
- 超时支持 `{{ }}` 表达式动态计算
- Python 沙箱（若存在）一并改造（仅 JS Code 节点链路）
- Wait 节点挂起/恢复（见 `New Text Document.txt` 第 5 节，另立规格）

---

## 2. 已确认产品决策

| 决策点 | 选择 |
|--------|------|
| 沙箱引擎 | **直切 Piscina**，不保留 legacy 实现 |
| 超时默认值 | **`-1` = 不超时**（环境变量与 Code 节点默认一致） |
| 生效优先级 | **节点 > 环境变量 > `-1`** |
| 配置入口 | **设置 → 环境变量**（全局 `env_vars`）+ Code 节点参数 `timeoutMs` |
| 非法配置 | **不阻断执行**，解析失败回退下一层 |
| 超时错误 | 保持 **`AwfError('E2002', 'Sandbox execution timed out')`** |

---

## 3. 沙箱层：Piscina 直切设计

### 3.1 架构

```
Code Executor
  └─ resolveCodeSandboxTimeoutMs(node, env) → number
  └─ runInSandbox({ code, inputItems, env, vars, nodes, timeoutMs })
        └─ Piscina pool (singleton)
              └─ sandbox-worker.js (export default handler)
```

### 3.2 Piscina 池配置

| 参数 | 环境变量（建议） | 默认值 | 说明 |
|------|------------------|--------|------|
| `minThreads` | `RXWF_SANDBOX_POOL_MIN_THREADS` | `1` | 最小常驻线程 |
| `maxThreads` | `RXWF_SANDBOX_POOL_MAX_THREADS` | `max(2, cpuCount - 1)` | 最大线程 |
| `idleTimeout` | `RXWF_SANDBOX_POOL_IDLE_TIMEOUT_MS` | `30000` | 空闲线程回收 |
| `maxQueue` | `RXWF_SANDBOX_POOL_QUEUE_LIMIT` | `0`（不限制） | 可选背压；`0` 表示 Piscina 默认 |

配置读取放在 `packages/sandbox` 或 API `config.ts` 透传；开发阶段可在 sandbox 包内读 `process.env`。

### 3.3 Worker 脚本

- 文件：`packages/sandbox/src/sandbox-worker.ts`
- 改造为 Piscina 要求的 **默认导出函数**：`(payload) => { ok, json, logs } | { ok: false, message }`
- 移除 `workerData` one-off 分支（无 legacy 后仅保留池模式）
- 构建产物仍为 `dist/sandbox-worker.js`，`Piscina` 的 `filename` 指向该文件

### 3.4 `runInSandbox` 行为契约（保持不变）

| `timeoutMs` | 行为 |
|-------------|------|
| 省略、`-1`、`<=0` | 不启用超时（Piscina `run` 不传 `signal`/timeout，或传极大值由实现决定，语义为无限等待） |
| `>0` | 超时后 reject，映射为 `AwfError('E2002', 'Sandbox execution timed out')` |
| 脚本异常 | `AwfError('E2002', message)` |

**计时范围**：从 `runInSandbox` 调用开始到 worker 返回（含 Piscina 队列等待 + 执行），与当前自研池「wall-clock」语义一致。

### 3.5 依赖

- `packages/sandbox/package.json` 增加 `piscina` 依赖
- 删除 `run-in-sandbox.ts` 内 `WorkerPool` 类（约 150 行自研逻辑）

---

## 4. 超时配置模型（方案 A）

### 4.1 环境变量键（全局 env_vars）

| 键 | 默认值 | 作用域 | 说明 |
|----|--------|--------|------|
| `SANDBOX_CODE_TIMEOUT_MS` | `-1` | `scope=global`，test + prod 均启用 | Code 沙箱默认超时（毫秒） |

- 用户在 **设置 → 环境变量** 编辑该键。
- 执行时通过既有 `loadResolvedEnv` / `ctx.env` 注入，**不**新增 `system_settings` 专用键（与现有 env 体系一致）。

### 4.2 系统初始化默认创建

在 API 启动或首次初始化时 **幂等** 确保存在该全局环境变量：

- 若 `env_vars` 中不存在 `SANDBOX_CODE_TIMEOUT_MS`（global scope），则插入：
  - `key`: `SANDBOX_CODE_TIMEOUT_MS`
  - `value`: `-1`
  - `testEnabled`: `true`
  - `prodEnabled`: `true`
- 已存在则不覆盖用户修改值。

建议挂载点：`bootstrap` 完成 DB 打开后，或 `registerSetupRoutes` / 专用 `ensureDefaultGlobalEnv()`。

### 4.3 Code 节点参数

| 字段 | 类型 | 默认值 | UI |
|------|------|--------|-----|
| `timeoutMs` | number | `-1` | 数字输入；文案：`超时(毫秒)，-1 表示不超时` |

- 修改 `apps/web/src/features/editor/node-param-schemas.ts` 的 `code` 数组，在 `jsCode` 后增加 `timeoutMs`。
- 旧工作流无该字段 → 解析时视为未设置 → 走环境变量 → `-1`。

### 4.4 解析函数 `resolveCodeSandboxTimeoutMs`

位置建议：`packages/node-runner/src/executors/resolve-code-sandbox-timeout.ts`（或 `code.ts` 内私有函数）。

```text
输入: nodeConfig.timeoutMs?, env['SANDBOX_CODE_TIMEOUT_MS']?
输出: number（-1 或正整数毫秒）

1. raw = nodeConfig.timeoutMs
   若可解析为有限数字 → 使用该值
2. 否则 raw = env['SANDBOX_CODE_TIMEOUT_MS']
   若可解析为有限数字 → 使用该值
3. 否则 raw = -1
4. 若 raw <= 0 → 返回 -1
5. 否则返回 Math.floor(raw)
```

`code.ts` 调用：

```typescript
const timeoutMs = resolveCodeSandboxTimeoutMs(ctx.config, ctx.env);
await deps.runInSandbox({ ..., timeoutMs });
```

---

## 5. 数据流

```text
[设置页 env_vars] SANDBOX_CODE_TIMEOUT_MS=-1
        ↓ loadResolvedEnv(execution)
[Code 节点 parameters.timeoutMs]（可选，默认 -1）
        ↓ resolveCodeSandboxTimeoutMs
[runInSandbox(timeoutMs)]
        ↓ Piscina pool.run(payload, { timeout? })
[sandbox-worker] 执行用户 jsCode → { json, logs }
```

---

## 6. 错误处理

| 场景 | 行为 |
|------|------|
| 节点/环境变量非数字 | 视为未设置，回退下一层 |
| 超时 | `E2002` + `Sandbox execution timed out` |
| 用户脚本 throw | `E2002` + 错误 message |
| Piscina/worker 崩溃 | `E2002` 或包装为现有 sandbox 失败语义 |

配置错误 **不** 抛 4xx/阻断工作流保存。

---

## 7. 测试方案

### 7.1 `resolveCodeSandboxTimeoutMs` 单元测试

| 节点 | 环境变量 | 期望 |
|------|----------|------|
| `5000` | `2000` | `5000` |
| `-1` | `2000` | `-1` |
| 未设 | `2000` | `2000` |
| 未设 | `-1` | `-1` |
| 未设 | 非法 | `-1` |
| `0` | 任意 | `-1` |

### 7.2 `runInSandbox` / Piscina

- 正常返回 `json` + `logs`（保留现有用例）
- `timeoutMs=5000` 且死循环 → `E2002` 超时
- `timeoutMs=-1` 或不传 → 短任务成功
- 并发多任务：无串扰、顺序无关

### 7.3 集成

- 修改全局 env 后新执行生效
- 旧工作流（无 `timeoutMs` 字段）行为不变

### 7.4 前端（可选）

- Code 节点 schema 含 `timeoutMs`，默认 `-1`

---

## 8. 验收标准（DoD）

- [ ] `piscina` 已接入，`WorkerPool` 已移除
- [ ] `runInSandbox` 对外接口与错误语义不变
- [ ] 初始化幂等创建 `SANDBOX_CODE_TIMEOUT_MS=-1`
- [ ] 设置页可编辑该环境变量
- [ ] Code 节点可配置 `timeoutMs`，默认 `-1`
- [ ] 优先级与归一化符合第 4.4 节
- [ ] 上述测试通过
- [ ] `docs/README.md` 或优化总结文档补充相关环境变量说明

---

## 9. 改造文件清单

| 区域 | 文件 |
|------|------|
| 沙箱 | `packages/sandbox/package.json`、`run-in-sandbox.ts`、`sandbox-worker.ts`、`run-in-sandbox.test.ts` |
| 执行器 | `packages/node-runner/src/executors/code.ts`、新增 `resolve-code-sandbox-timeout.ts` + test |
| 初始化 | `apps/api/src/bootstrap.ts` 或 env 仓储层 `ensureDefaultGlobalEnv` |
| 前端 | `apps/web/src/features/editor/node-param-schemas.ts`、i18n（如需） |
| 文档 | `docs/README.md`、`docs/queue-concurrency-optimization-summary.md`（可选） |

---

## 10. 风险与缓解

| 风险 | 缓解 |
|------|------|
| Piscina 与 ESM/worker 路径问题 | 使用 `fileURLToPath` + 构建后 `dist/sandbox-worker.js`；CI 跑 sandbox 测试 |
| 无超时导致线程占满 | 文档说明生产建议设正数超时；保留 env 全局默认可改 |
| 环境变量与节点混淆 | UI 文案区分「全局默认」vs「本节点覆盖」 |

---

## 11. 后续（不在本规格）

- 将 Piscina 池参数接入 `apps/api/src/config.ts` 与部署文档
- 沙箱批次指标（与 `RXWF_JOB_PROCESSOR_METRICS` 类似）

