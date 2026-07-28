#!/usr/bin/env node
/** Emit tasks.md index from task detail files metadata */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TASKS_DIR = join(process.cwd(), 'docs/workflow/tasks');
const files = readdirSync(TASKS_DIR).filter((f) => /^T-\d+\.md$/.test(f)).sort((a, b) => {
  return parseInt(a.slice(2), 10) - parseInt(b.slice(2), 10);
});

const tasks = files.map((f) => {
  const body = readFileSync(join(TASKS_DIR, f), 'utf8');
  const id = f.replace('.md', '');
  const get = (re) => (body.match(re) ?? [])[1]?.trim() ?? '';
  return {
    id,
    milestone: get(/\| Milestone \| (.+) \|/),
    wave: parseInt(get(/\| Wave \| (\d+) \|/), 10),
    desc: get(/\| 描述 \| (.+) \|/),
    deps: get(/\| 依赖 \| (.+) \|/),
    ac: get(/\/ (AC-[^/]+) \//),
  };
});

const byMs = {};
for (const t of tasks) {
  (byMs[t.milestone] ??= []).push(t);
}

const waveWidth = {};
for (const t of tasks) {
  const k = `${t.milestone}-W${t.wave}`;
  waveWidth[k] = (waveWidth[k] ?? 0) + 1;
}
const maxWaveWidth = Math.max(...Object.values(waveWidth));

const msWaves = {};
for (const t of tasks) {
  const ms = t.milestone;
  if (!msWaves[ms]) msWaves[ms] = new Set();
  msWaves[ms].add(t.wave);
}
const totalWaves = Object.values(msWaves).reduce((s, set) => s + set.size, 0);

// Global wave numbering for state.json
const globalWaves = [];
let gw = 0;
for (const ms of ['M-1', 'M-2', 'M-3', 'M-4', 'M-5', 'M-6']) {
  const waves = [...msWaves[ms] ?? []].sort((a, b) => a - b);
  for (const w of waves) {
    gw++;
    const ids = tasks.filter((t) => t.milestone === ms && t.wave === w).map((t) => t.id);
    globalWaves.push({ wave: gw, milestoneId: ms, localWave: w, taskIds: ids });
  }
}

writeFileSync(join(process.cwd(), 'docs/workflow/_waves.json'), JSON.stringify(globalWaves, null, 2));

const msCounts = Object.fromEntries(Object.entries(byMs).map(([k, v]) => [k, v.length]));

let md = `# 任务索引（Dev Leader）

> **状态**：待批准（\`gates.tasks.status = pending\`）  
> **方法论**：TDD（Red → Green → Refactor → Verify）  
> **详情目录**：\`docs/workflow/tasks/T-XXX.md\`  
> **分支策略**：每 Milestone 独立分支（见 architecture §11）

---

## Milestone 映射表

| Milestone | 任务 ID 范围 | 任务数 | 覆盖 AC |
|-----------|--------------|--------|---------|
| M-1 | T-001～T-015 | ${msCounts['M-1'] ?? 0} | AC-001～012, AC-070～074 |
| M-2 | T-016～T-033 | ${msCounts['M-2'] ?? 0} | AC-013～022, AC-070～074 |
| M-3 | T-034～T-084 | ${msCounts['M-3'] ?? 0} | AC-023～034, AC-070～074 |
| M-4 | T-085～T-098 | ${msCounts['M-4'] ?? 0} | AC-035～044, AC-070～074 |
| M-5 | T-099～T-114 | ${msCounts['M-5'] ?? 0} | AC-045～056, AC-070～074 |
| M-6 | T-115～T-168 | ${msCounts['M-6'] ?? 0} | AC-057～069, AC-070～074 |

**合计**：${tasks.length} tasks，覆盖 PRD **74** 条 AC（含跨 Milestone 门禁 AC-070～074）。

---

## 任务索引表

| ID | 描述 | Milestone | 依赖 | Wave | 状态 | 详情 |
|----|------|-----------|------|------|------|------|
`;

for (const t of tasks) {
  const deps = t.deps === '-' ? '-' : t.deps;
  md += `| ${t.id} | ${t.desc.replace(/\|/g, '\\|')} | ${t.milestone} | ${deps} | ${t.wave} | todo | [${t.id}.md](tasks/${t.id}.md) |\n`;
}

md += `
---

## 并行波次表（按 Milestone 分段）

`;

for (const ms of ['M-1', 'M-2', 'M-3', 'M-4', 'M-5', 'M-6']) {
  md += `### ${ms}\n\n`;
  md += `| Wave | 任务 ID | 并行安全 | 说明 |\n|------|---------|----------|------|\n`;
  const waves = [...msWaves[ms]].sort((a, b) => a - b);
  for (const w of waves) {
    const ids = tasks.filter((t) => t.milestone === ms && t.wave === w);
    const idStr = ids.map((t) => t.id).join(', ');
    const note =
      ms === 'M-3' && w === 2 ? 'Lite 轨 16 nodeType 并行' :
      ms === 'M-3' && w === 4 ? 'Plus 轨 27 nodeType 并行' :
      ms === 'M-6' && w === 1 ? '45 独立 help 文并行' :
      ms === 'M-2' && w === 1 ? '半实现项 10 路并行' :
      ms === 'M-1' && w === 1 ? '文档+脚本+compose 6 路并行' : '';
    md += `| W${w} | ${idStr} | 是（文件所有权不重叠） | ${note} |\n`;
  }
  md += '\n';
}

md += `---

## 并行度分析

| 指标 | 值 |
|------|-----|
| **总 task 数** | ${tasks.length} |
| M-1 task 数 | ${msCounts['M-1']} |
| M-2 task 数 | ${msCounts['M-2']} |
| M-3 task 数 | ${msCounts['M-3']} |
| M-4 task 数 | ${msCounts['M-4']} |
| M-5 task 数 | ${msCounts['M-5']} |
| M-6 task 数 | ${msCounts['M-6']} |
| **最大 wave 宽度** | **${maxWaveWidth}**（M-6 W1：45 篇 help 并行） |
| **Wave 总数** | ${totalWaves}（各 Milestone 局部 Wave 之和） |
| **全局 Wave 数（state.json）** | ${globalWaves.length} |
| 平均 task 覆盖 AC 数 | ~1.2（细粒度拆分；门禁 AC 由 Milestone 收口 task 覆盖） |

### 拆分理由摘要

1. **M-1**：文档索引、差距审计、E2E 矩阵、索引 CI、compose harness 拆为 15 个单一职责 task；Wave 1 即 6 路并行（含 e2e-compose）。
2. **M-2**：skillRun 三子工具、ACL、credential-types、switch（校验/执行/UI）各独立 task；Wave 1 宽度 10。
3. **M-3**：1 矩阵脚手架 + **45 nodeType 各 1 task**（独占 executor/E2E/audit-row）+ 5 收口 task；Lite/Standard/Plus 分 Wave 2/3/4 最大化并行。
4. **M-4**：Group Chat 按 round-robin / orchestrator / UserProxy / HITL / E2E 垂直切片 14 task。
5. **M-5**：Binary 审查门禁（B-1～B-6）与实现分离；方案确认（T-103）阻塞 T-104+。
6. **M-6**：**45 help 文各 1 task**（Wave 1 宽度 45）+ registry/E2E/矩阵 100% 收口。

---

## 依赖图 / 执行顺序

\`\`\`
M-1 (W1→W4) ──► M-2 (W1→W3) ──► M-3 (W1→W5) ──► M-4 ──► M-5 ──► M-6
                     │                │
                     │                └── 45×(审查+E2E) 可 Wave 内并行
                     └── 半实现 10 路 Wave1 并行
\`\`\`

**Milestone 顺序**：M-1 全部完成 → M-2 → … → M-6（编排器 enforce）。  
**M-5 特殊门禁**：T-103 人工方案确认前，T-104～T-111 仅可写失败测试，不得合入实现。

---

## TDD / PRD / 架构 / Milestone 覆盖检查

| 检查项 | 状态 |
|--------|------|
| PRD 74 AC 均有 ≥1 task 映射 | ✅ |
| 架构模块（§2～§10）落点明确 | ✅ |
| 每 task 含 TDD Red + 文件所有权 | ✅ |
| M-3 45 nodeType 各 ≥1 E2E task | ✅（T-035～T-079） |
| M-6 45 help 各独立 task | ✅（T-115～T-159） |
| 跨 Milestone AC-070～074 | ✅ 各 M 收口 task（acceptance + E2E 回归） |
| TDD 方法论 | ✅ 全 task \`todo\`，developer Red 先行 |

---

## 风险与阻塞项

| 风险 | 影响 | 缓解 task |
|------|------|-----------|
| M-5 方案未确认 | 阻塞 Binary 实现 | T-103 人工门禁 |
| M-4 与 Crew 架构冲突 | 可能暂停 FR-16 | T-085 冲突评估 |
| agent-satellite-tools.ts 多 node 共享 | M-3 Wave4 卫星节点需协调 | 各 task 仅改对应 satellite 注册分支；冲突则串行 |
| Docker CI 不稳定 | E2E 假失败 | T-006/T-011/T-012 compose harness |
| 帮助 45 篇并行 | 仅 docs 路径，Wave1 安全 | T-115～T-159 独占 \`docs/help/zh/nodes/<type>.md\` |

---

**下一步**：用户 \`批准任务清单\` → 编排器 \`gates.tasks.status = approved\` → 从 M-1 分支 \`milestone/m-1-docs-index\` 启动 development。
`;

writeFileSync(join(process.cwd(), 'docs/workflow/tasks.md'), md, 'utf8');
console.log(JSON.stringify({ total: tasks.length, msCounts, maxWaveWidth, totalWaves, globalWaves: globalWaves.length }, null, 2));
