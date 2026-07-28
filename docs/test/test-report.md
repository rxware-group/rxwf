# 全局测试报告

> **testing 阶段全局汇总**（M-1～M-6 milestone 测试报告索引）。各 milestone 细节见 `docs/test/milestones/M-*-report.md`。
>
> **更新时间**: 2026-06-21T13:30:00.000Z  
> **当前分支**: `milestone/m-6-help`  
> **activeMilestoneId**: M-6

## Milestone 测试结论汇总

| Milestone | 名称 | 报告 | 结论 | 人工验收 |
|-----------|------|------|------|----------|
| M-1 | 文档索引与 v2.0 差距审计 | [M-1-report.md](milestones/M-1-report.md) | passed | accepted |
| M-2 | schemaVersion:1 兼容 | [M-2-report.md](milestones/M-2-report.md) | passed | accepted |
| M-3 | 节点审计矩阵 | [M-3-report.md](milestones/M-3-report.md) | passed | accepted |
| M-4 | Group Chat MVP | [M-4-report.md](milestones/M-4-report.md) | passed | accepted |
| M-5 | Binary 全链路 | [M-5-report.md](milestones/M-5-report.md) | passed | accepted |
| M-6 | 帮助全覆盖与最终回归 | [M-6-report.md](milestones/M-6-report.md) | **passed** | **accepted** |

## M-6 最终回归摘要（T-168）

| 类别 | 结果 |
|------|------|
| 帮助文档 validate | 45/45 |
| help 单元测试 | 11/11 |
| E2E matrix `--require-full` | 65 rows OK |
| spec-gap `--require-closed` | OK |
| INDEX lint | 395 docs OK |
| E2E lite 全量（57 spec） | **247/248** pass + 1 skip |
| E2E standard/plus | blocked（Docker daemon） |

## 全局阻塞项

1. **M-6 人工验收**：12 条用例已通过（`验收 M-6` @ 2026-06-18）。
2. **Standard/Plus compose E2E**：AC-064 需 CI/本地 Docker 复跑（M-4/M-5/M-6 一致记录）。
3. **External/infrastructure flaky**：httpbin 503、lite postgres @any、ragRetrieve KB skip — 已分类为非代码回归。

## 结论

`passed`（milestone scope）

M-1～M-5 均已 accepted；M-6 自动化测试证据满足 testing 阶段要求。**M-6 已于 2026-06-18 人工验收放行。** 全局放行仍依赖 `gates.finalAcceptance` 及 CI 双轨 E2E 证据补齐（AC-064）。
