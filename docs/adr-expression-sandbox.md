# ADR-004：表达式与 Code 节点沙箱

| 字段 | 内容 |
|------|------|
| **状态** | 已采纳（Accepted） |
| **日期** | 2026-05-20 |
| **关联 PRD** | [spec.md](./spec.md) FR-2 Code、FR-9、§11.3 |
| **决策者** | 架构 / 安全 |

---

## 1. 背景

- **表达式** `{{ }}` 若按完整 JavaScript 执行，存在原型链与逃逸风险。
- **Code 节点** 需运行用户脚本，必须进程/VM 级隔离。

v1.0 **阻塞项**：未定型前不得上线 Code 节点与表达式求值。

---

## 2. 决策摘要

| 能力 | 选型 | 说明 |
|------|------|------|
| **表达式** | **`isolated-vm` 同进程 JS 沙箱**（A2：`async/await`，无网络） | 宿主用 ivm 编译；**不设**表达式超时；用户代码禁止 `require`/`fetch`/`process` 等 |
| **Code 节点** | **独立子进程**（Piscina）+ worker 内 `new Function` | 禁止 `require` 任意模块；超时与内存硬限制（与表达式分离） |

---

## 3. 表达式允许能力（v2 — JS 沙箱）

详见 [2026-06-03-js-expression-globals-design.md](./superpowers/specs/2026-06-03-js-expression-globals-design.md)。

**可引用（运行时全局）**：

- `$json`、`$binary`、`$input`（`.all()` / `.first()` / `.item` / 下标）
- `$nodes["节点名"].json` / `.binary` / `.items` / `.first()` / `.all()`
- `$env`（按 catalog 类型注入：bool / number / string）、`$vars`（字符串 Map）
- `$execution`（`id`、`mode`、`environment`、`startedAt`）
- `$workflow`（`id`、`name`、`versionId`）
- `$itemIndex`

**允许 JS**：语句块、循环、`async/await`、箭头函数、标准内置（`Math`/`JSON`/`Date`/…）。单行表达式可省略 `return`（[implicit return spec](./superpowers/specs/2026-06-03-expression-implicit-return-design.md)）；多语句须显式 `return`。

**禁止**：

- `import`/`require`、`fetch`、定时器、`process`/`globalThis`
- 用户侧 `eval`/`new Function`
- 表达式 **运行超时**（无 `RXWF_EXPRESSION_TIMEOUT_MS`）；工作流取消可终止 execution

**校验**：保存工作流时静态扫描表达式源码；运行期错误映射 `E1002`。

---

## 4. Code 节点沙箱（v1.0）

| 项 | 限制 |
|----|------|
| 运行时 | Node.js LTS（与平台一致） |
| 隔离 | 子进程；`isolated-vm` 优先，备选 Worker + 静态扫描 |
| 超时 | 默认 60s（工作流可覆盖，上限 300s） |
| 内存 | 默认 256MB，上限 512MB |
| 网络 | **默认禁止**；节点显式开启且需 Admin 策略时放行（v1.1） |
| 文件系统 | **禁止** |
| 模块 | 仅允许内置：`items` 辅助方法文档列出 |
| 并发 | 全局沙箱池 ≤ 5（Lite 默认） |

**Items API**：`$input.all()`、`$input.first()`、`return items[]`（与 spec FR-9 一致）。

---

## 5. 校验时机

| 时机 | 动作 |
|------|------|
| 保存工作流 | 静态扫描所有表达式字段 → `workflow_validate` |
| 执行前 | Code 节点再次校验脚本长度（≤ 256KB） |
| 运行期 | 超时 kill 子进程树 |

---

## 6. 未采纳方案

| 方案 | 原因 |
|------|------|
| vm2 | 已停止维护，安全风险 |
| 主进程 `eval` | 不可接受 |
| WebContainer | v1.0 过重 |

---

## 7. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-20 | 初稿 |
| v2.0 | 2026-06-03 | 表达式改为 isolated-vm JS 沙箱；详见 globals design spec |
