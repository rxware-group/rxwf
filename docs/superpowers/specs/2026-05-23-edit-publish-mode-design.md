# 工作流编辑/发布模式设计

| 字段 | 内容 |
|------|------|
| **状态** | 已实施 |
| **日期** | 2026-05-23 |

## 摘要

实现 n8n 式 **编辑模式 / 生产模式**：草稿与已发布版本分离；Test/Prod Webhook 独立 URL；保存需指定 semver；发布可选择历史版本；取消发布仅停新触发；支持从失败执行导入 Pin 数据调试。

## 状态模型

- `draft` / `published` 取代 `active`
- `workflows.published_version_id` 指向已发布 `workflow_versions` 行
- `workflow_versions.semver_label` + `change_note`

## API

- `PUT /api/workflows/:id` — 保存（semver + changeNote）
- `POST /api/workflows/:id/publish` — `{ version? }`
- `POST /api/workflows/:id/unpublish`
- `POST /webhook-test/:workflowId/:path` — 测试（草稿）
- `POST /webhook/:workflowId/:path` — 生产（已发布版）
- `GET /api/executions/:id/debug-pin-data` — 历史执行 → Pin

## 执行数据

- `node_runs.output_data` 持久化节点输出
- 导入规则：失败节点之前所有成功节点 → `pinData`
