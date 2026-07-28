---
humanGate: approved
selectedOption: OPT-01
b6ImplementationGate: cleared
confirmedAt: 2026-06-21
confirmedBy: user
trace: AC-046
task: T-103
milestone: M-5
specRefs:
  - docs/architecture/architecture.md §9 Binary
  - docs/architecture/binary-options.md
  - docs/architecture/binary-risks.md
  - docs/architecture/binary-current-state.md
  - docs/superpowers/specs/2026-06-03-workflow-binary-support-design.md
---

# M-5 Binary 人工方案确认记录（B-6）

> **任务**：T-103 · **验收**：AC-046 · **门禁**：`humanGate: approved` · `b6ImplementationGate: cleared` · 解锁 `gates.m5-binary-plan`。

## 1. 确认摘要

用户于 **2026-06-21** 书面确认 M-5 Binary 实施方案，清除 B-6 人工方案确认门禁。确认依据：

| 输入 | 文档 |
|------|------|
| B-5 方案选项 | `docs/architecture/binary-options.md` |
| B-4 差距/风险与确认项模板 | `docs/architecture/binary-risks.md` §6 |
| B-1 现状快照 | `docs/architecture/binary-current-state.md` |
| 审查流程 | `docs/architecture/architecture.md` §9 |

**确认方式**：用户书面回复选定 **OPT-01**（按 draft spec 全量 P1～P4）及 CONF-01～06 默认取值。

## 2. 选定方案

| 项 | 决选 |
|----|------|
| **方案 ID** | **OPT-01** — 按 draft spec 全量 P1～P4 |
| **Phase 范围** | P1（类型+blob+HTTP 响应→binary+透传+调试 UI）→ P2（HTTP `$binary` 上传；Webhook multipart）→ P3（Set/Code 产出 binary）→ P4（Merge combine 策略；ReadWriteFile readBinary） |
| **ADR/FR-16** | 无需修订（与 ADR-005 Accepted 及 draft spec 256 KiB / 32 MiB 一致） |

## 3. 确认项决选

> 与 `binary-risks.md` §6、`architecture.md` §9.3 对齐。

| ID | 确认项 | 决选值 |
|----|--------|--------|
| CONF-01 | 选定方案 ID | **OPT-01**（按 draft spec 全量 P1～P4） |
| CONF-02 | inline 阈值 | **256 KiB**（draft spec 默认） |
| CONF-03 | 单 Item 32 MiB 上限 | **保留 32 MiB 硬上限** |
| CONF-04 | Merge combine binary 策略 | **combineByKey 保留首个非空**；**combineAll 须保留 upstream binary**（P4） |
| CONF-05 | Webhook multipart 键名 | **按 draft spec**（form field 名→binary key；multipart 见 spec） |
| CONF-06 | HTTP `responseBinaryMode` 默认 | **`off`**（draft spec 默认） |

## 4. 门禁结论

| 门禁 | 状态 | 说明 |
|------|------|------|
| `gates.m5-binary-plan` | **cleared** | 本文件为 B-6 书面记录 |
| `m5BinaryPlanGate`（binary-current-state.md） | **cleared** | T-103 同步 |
| `b6ImplementationGate`（risks / n8n-review） | **cleared** | T-103 同步 |
| `humanGate`（binary-options.md） | **approved** | `selectedOption: OPT-01` |
| M-5 实现（T-104+） | **解锁** | `assertM5BinaryImplementationAllowed()` 不再 throw |

**后续**：T-104+ 按 OPT-01 P1～P4 TDD 实施；对已落地项（binary-current-state §3.2）标 verify-only，仅补 gap（GAP-01 Merge combineAll 等）。

---

**维护**：若用户撤回或变更决选，须新 B-6 记录并重置各 frontmatter 门禁；变更后重跑 `node docs/test/milestones/M-5-binary-plan-confirmation.test.mjs`。
