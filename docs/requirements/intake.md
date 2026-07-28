# 需求输入（Intake）

> 编排器启动流水线时填写；PM 与 requirements-analyst **必须**阅读本文件。

## 原始目标

根据 **spec 审查**（`docs/superpowers/specs/`、`docs/spec.md`、spec-reviewer 流程）识别并**完善未实现功能**；对**工作流各节点**进行审查，保证节点能正常工作；**编写所有节点帮助文档**并关联跳转，保证每个节点均可从编辑器打开对应帮助；使用 **E2E 测试**验证软件功能正常运行。

## 成功标准

1. 经 spec 对照审查后，P0 范围内未实现/半实现功能已补齐或明确排除并记录
2. 各工作流节点（触发、逻辑、数据、动作、Agent 等）可配置、可执行、错误可诊断
3. `docs/help/zh/nodes/` 覆盖全部可执行节点类型；`help-registry.ts` 映射完整；节点弹窗「帮助」按钮可新 Tab 打开正确文档
4. Playwright E2E **覆盖 v2.0 全部功能**（`e2e-coverage-matrix.md` 100%）；每 Milestone 全量 E2E green；CI 可跑通

## 用户 / 场景

- 研发/运维团队使用 RX-Workflow 编排与调试工作流
- 节点配置时需可查阅上下文帮助
- 发布前需自动化回归保证主链路可用

## In Scope

- 基于现有 `docs/superpowers/specs/*.md` 与代码库差距分析，补齐关键未实现项
- 全节点健康审查（参数面板、校验、执行器、错误处理）
- 帮助中心：补全节点 Markdown、`NODE_HELP_PATH`、导航树
- E2E 测试扩展（`apps/web/e2e/`）
- TDD 开发方法

## Out of Scope

- 全新大功能（无 spec 依据）
- 独立 VitePress/Docusaurus 帮助站
- 英文帮助全文（可预留结构）
- 多区域 HA / 企业 SSO 等 v2 能力

## 约束

- **范围边界**：`docs/spec.md` v2.0 全量功能，分多个大阶段交付
- **验收**：每 Milestone **结束时** `验收 M-x`；Milestone 内 Wave 自动推进，中途不暂停确认
- **E2E**：须覆盖 v2.0 **全部功能**；M-1 建立覆盖矩阵，M-6 达 100%；每 Milestone 全量 E2E green + 人工验收
- **变更门禁**：框架、流程、UX/UI 等大变动须人工确认
- **Git**：代码修改在独立分支；阶段验收后该阶段代码与文档提交并合入主分支
- **文档**：功能变更须同步更新相关文档；项目文档归类并建立索引机制
- **问题处理**：遇阻塞/歧义须人工确认，不得自行忽略或绕过
- 技术栈：现有 monorepo（TypeScript、React、Playwright、packages/execution 等）
- 方法论：TDD（Red → Green → Refactor → Verify）
- 帮助内容单一来源：`docs/help/zh/**`，与 `help-registry.ts` 对齐
- **Docker 验收**：外部依赖节点一律 Docker 真实依赖；CI 与人工验收均 compose 自动启停

## 参考物

- `docs/spec.md`、`docs/spec-review.md`
- `docs/superpowers/specs/`（尤其 `2026-06-05-help-center-design.md`）
- `apps/web/src/features/help/help-registry.ts`
- `apps/web/src/features/editor/node-type-meta.ts`
- `apps/web/e2e/`
- `.cursor/agents/spec-reviewer.md`

## 用户已声明的不确定项

- 「未实现功能」范围是否限于 v1.0 MVP 还是包含 v1.1 spec 中已设计项
- 节点审查深度：仅冒烟还是含集成测试 + 真实 Runner/LLM
- E2E 是否需真实外部依赖（Ollama、Postgres）或全部 mock
