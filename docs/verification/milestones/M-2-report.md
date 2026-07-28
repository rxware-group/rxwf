# Milestone M-2 — 验证报告

> 本 milestone 一致性核对。全局报告见 `docs/verification/verification-report.md`。

## Milestone

- **ID**: M-2
- **名称**: v2.0 半实现项补齐
- **分支**: `milestone/m-2-semi-impl`
- **覆盖 AC**: AC-013～AC-022（功能交付）；AC-070～AC-074（门禁，见「待人工验收项」）
- **关联任务**: T-016～T-033（18/18 `done`）
- **测试报告**: `docs/test/milestones/M-2-report.md`（结论 `passed`）
- **人工验收清单**: `docs/test/milestones/M-2-acceptance.md`

---

## 验收标准核对（AC-013～AC-022）

| AC-ID | 描述摘要 | 状态 | 交付物 / 证据 |
|-------|----------|------|---------------|
| AC-013 | skillRun 子能力（write/grep/web_search）达 spec AC | **met** | `packages/skill-runtime` write 5、grep 4、web-search 6 单测；`node-runner` skill-run 9/9；E2E `skill-run-tools.spec.ts` lite 5/5；GAP-007/025 `audit_status=done` |
| AC-014 | 工作流级 ACL Owner/Editor/Viewer 达 spec FR-6 | **met** | `workflow-collaborators` API 4/4 + `workflows-acl` 2/2；`WorkflowCollaboratorsPanel` 2/2；E2E `workflow-acl.spec.ts` 已入库（developer 8/8；tester standard 轨 Docker 阻塞，API 层已覆盖）；GAP-008 `done` |
| AC-015 | credential-types 注册表落地达 spec AC | **met** | `@rxwf/credential` registry 8 + apply-auth 4 + service 5 = 17/17；`credentials` API 8/8；E2E `credential-types.spec.ts` 1/1 lite；GAP-009 `done` |
| AC-016 | switch 动态分支达 spec AC（非 Draft 占位） | **met** | `validate-switch` 3/3；`switch` executor 4/4；`SwitchBranchesPanel` 2/2；E2E `switch-dynamic.spec.ts` 3/3 lite；GAP-010 `done` |
| AC-017 | `spec-gap-audit.md` M-2 归属项均为 done | **met** | GAP-007/008/009/010/025 `audit_status=done`；`validate-spec-gap-audit.mjs --milestone M-2` exit 0 |
| AC-018 | M-2 交付功能 matrix 100% 有 E2E 行且已覆盖 | **met** | E2E-N-skillRun、E2E-N-switch、E2E-P-011、E2E-P-018 均为 `covered` 且 spec 路径存在；`validate-e2e-matrix.mjs` exit 0 |
| AC-019 | `M-2-acceptance.md` 已编写且全通过 | **partial** | 清单已编写（10 条 M2-MAN-001～010，frontmatter 含 AC-013～022）✅；**执行结果栏均未签字**，「全通过」待人工（与 AC-070 联动） |
| AC-020 | 全量 E2E 套件 green（含 M-1 用例） | **partial** | lite 轨 M-2 **10/10** + M-1 基线 **19/19** green ✅；`workflow-acl.spec.ts` @standard 因 Docker 未运行 blocked（非代码失败）；developer 曾跑 standard+plus 8/8 |
| AC-021 | 半实现项修复不破坏 `schemaVersion: 1` 导入 | **met** | `schema-compat` 6/6（4× M-2 v1 fixture + 2 负向导入）；T-031 Task Verify passed |
| AC-022 | 相关帮助/INDEX 已同步 | **met** | T-033：`switch.md`/`skillRun.md` 更新；`INDEX.md` 登记 M-2 条目；`lint-docs-index.test.mjs` 2/2；help-route-baseline E2E green |

**AC-013～022 汇总**：8 met、2 partial（AC-019/020 自动化子集已满足，人工签字与 standard E2E 复跑待验）。

---

## 门禁 AC 核对（AC-070～AC-074）

| AC-ID | 描述摘要 | 状态 | 说明 |
|-------|----------|------|------|
| AC-070 | 人工验收用例清单存在且全部通过 | **pending** | `M-2-acceptance.md` 10 条已编写；均未执行/签字 |
| AC-071 | 放行前用户执行 `验收 M-2` | **pending** | 等待用户门禁指令 |
| AC-072 | 验收后代码与文档合入主分支 | **pending** | 分支 `milestone/m-2-semi-impl` 尚未合 main |
| AC-073 | compose 自动 up/down 无泄漏容器 | **pending** | 本轮 tester 未启动 standard compose；lite 轨无 compose 泄漏风险 |
| AC-074 | 阻塞项经人工确认记入 history，无自行绕过 | **met** | workflow-acl E2E 环境阻塞、plus 轨缺 image、待接线项均已记录于测试报告与本报告；未 silent defer |

---

## TDD + Task 基本验证追溯

| Task | AC | TDD Red→Green | Task 基本验证 | 审查 |
|------|-----|---------------|---------------|------|
| T-016 write provider | AC-013 | ✅ 5/5 | passed | ✅ tester 复跑 skill-runtime 42/42 |
| T-017 grep provider | AC-013 | ✅ 4/4 | passed | ✅ |
| T-018 web-search provider | AC-013 | ✅ 6/6 | passed | ✅ |
| T-019 credential registry | AC-015 | ✅ registry 8 | passed | ✅ credential 17/17 |
| T-020 credentials API | AC-015 | ✅ 8/8 | passed | ✅ |
| T-021 validate-switch | AC-016 | ✅ 3/3 | passed | ✅；⚠️ 待接线见技术债 |
| T-022 switch executor | AC-016 | ✅ 4/4 | passed | ✅ |
| T-023 SwitchBranchesPanel | AC-016 | ✅ 2/2（补测） | passed | ✅ |
| T-024 collaborators API | AC-014 | ✅ 4/4 | passed | ✅；⚠️ bootstrap 待接线 |
| T-025 CollaboratorsPanel | AC-014 | ✅ 2/2（补测） | passed | ✅ |
| T-026 skill-run 集成 | AC-013 | ✅ 15/15 | passed | ✅ skill-run 9/9 |
| T-027 CredentialsPanel UI | AC-015 | ✅ 2/2 | passed | ✅；⚠️ CredentialsPage 待接线 |
| T-028 skill-run-tools E2E | AC-013, AC-018 | ✅ lite 6/6 | passed | ✅ lite 5 用例 green |
| T-029 workflow-acl E2E | AC-014, AC-018 | ✅ dev 8/8 | passed | ⚠️ tester standard 轨未复跑 |
| T-030 credential + switch E2E | AC-015/016/018 | ✅ lite 6/6 | passed | ✅ 4 用例 green |
| T-031 schema-compat | AC-021 | ✅ 6/6 | passed | ✅ |
| T-032 gap audit + matrix | AC-017/018 | ✅ validate OK | passed | ✅ |
| T-033 help/INDEX + acceptance | AC-019/022 | ✅ 内联 AC-022 | passed | ✅ |

**汇总**：18/18 任务 TDD + Task 基本验证证据齐全；T-023/T-025 为既有实现补测，可接受。自动化层 530/530 可执行用例全绿（tester 报告）。

---

## 架构符合性（M-2 范围）

| 架构项 | 要求（§5 M-2） | 符合性 |
|--------|----------------|--------|
| FR-05 半实现补齐 | `skill-runtime`、`identity` ACL、`credential`、`switch` 面板、`node-runner` executors | ✅ 落点与架构表一致 |
| 依赖方向 | `apps/*` → `packages/*`；无反向依赖 | ✅ TDD 测试分布符合 §6.1 分层 |
| TDD 分层 | 单元先于 E2E；Red→Green 证据 | ✅ 各 task 有 Red 记录 |
| schemaVersion:1 | `@rxwf/workflow` 校验层不变（FR-17） | ✅ schema-compat 6/6 |
| E2E 矩阵 | M-2 功能行 100% covered | ✅ 四行均已关联 spec |
| 差距审计 | `spec-gap-audit.md` 与 matrix 互链 | ✅ GAP-007～010/025 done |
| FR-15 文档同步 | 功能变更同阶段更新 help/INDEX | ✅ T-033 |
| 双轨策略 | matrix 标注 track；Plus 节点 E2E 标 plus | ✅ skillRun @plus；ACL @standard；lite @any 已绿 |

**备注**：架构 §5 M-2 所列模块均已交付可测代码路径；已知待接线项不改变模块边界，属集成完善而非架构偏离。

---

## 已知待接线 / 技术债（记录，不阻断）

| 项 | 来源 | 影响 | 处置建议 |
|----|------|------|----------|
| `validateSwitchNodes` 未接入 `validateWorkflowDefinition` | T-021 备注 | 保存时 switch 校验可能未走统一入口；E2E/单测已覆盖分支行为 | M-3 或 hotfix 接线 |
| `workflow-collaborators` bootstrap 未注册 | T-024 备注 | 生产路径走 `workflows.ts` 内联路由；API 测与 E2E spec 已绿 | 编排器授权后续 task 统一注册 |
| `CredentialsPage` 未接入 `CredentialsPanel` | T-027 备注 | 设置页可能仍用旧组件；E2E credential-types 与单测已绿 | 后续 UI 集成 task |
| Plus 轨 compose 缺 api/web image | T-028 / 测试报告 | `@plus` E2E 未在本轮执行；`@any` lite 场景已绿 | M-3/M-4 Plus 验收前补 image |

---

## 缺口清单（非阻断，放行前须知）

| 项 | 说明 | 责任 |
|----|------|------|
| AC-070 | 10 条人工用例 **尚未执行/签字** | 验收人 |
| AC-071 | 用户尚未执行 **`验收 M-2`** | 验收人 |
| AC-020 standard E2E | `workflow-acl.spec.ts` 需 Docker Desktop 启动后复跑 | 验收人 / CI |
| AC-072 | 验收通过后合入 `main` | 验收人 |
| AC-073 | standard compose up/down 无泄漏容器检查 | 人工 M2-MAN-008 |
| Plus 轨 E2E | skill-run-tools @plus 待 compose image 就绪 | M-3/M-4 |
| lint:docs-index 全 repo | exit 1 属 M-6 范围；M-2 变更文件已登记 | M-6 |

---

## recommendedPhase

`none`

（交付物与自动化证据满足 M-2 验证；无架构/任务/开发回退必要项。待接线为集成完善，不否定 AC 核心能力已达标。）

---

## 结论

`passed`

---

**验证时间**: 2026-06-20  
**验证角色**: verifier（milestone scope）  
**下一步**: `milestones[M-2].gate.status` 保持 `pending`；等待用户执行 10 条人工用例 + `验收 M-2`；建议验收前复跑 `RXWF_E2E_TRACK=standard pnpm --filter @rxwf/web test:e2e workflow-acl`。
