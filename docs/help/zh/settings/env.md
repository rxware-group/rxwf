# 环境变量

在 **设置 → 环境变量**（`/settings/env`）中维护 **RXWF_\*** 白名单参数。这些值保存在平台数据库中，供 API 运行时与表达式中的 `$env` 读取。

点击设置窗口标题栏 **帮助** 按钮（? 图标）可打开本页说明。

## 与「变量」页的区别

| | [变量](/help/settings/variables)（`$vars`） | 本页（`$env`） |
|--|---------------------------------------------|----------------|
| 键名 | 用户自定义 | 固定 **RXWF_\*** 白名单（15 项） |
| 增删 | 可添加、删除 | **不可**新增或删除行 |
| 测试 / 生产 | 可分环境维护不同值 | **无**；全平台单套运行时值 |
| 典型用途 | 业务配置、Feature Flag、API 前缀 | 公网 URL、SMTP、品牌、LangSmith、沙箱超时等 |
| 权限 | 登录用户可编辑（按部署策略） | **仅 Admin** 可修改；其他用户只读 |

进程级配置（如 `RXWF_HTTP_PORT`、`RXWF_DATA_DIR`）由部署环境 / `.env` 提供，**不会**出现在本页。

用户自定义键请使用 [变量](/help/settings/variables)；结构化密钥请使用 [凭证](/help/settings/credentials)。

## 编辑方式

1. 以 **Admin** 身份打开 **设置 → 环境变量**。
2. 表格列出全部白名单键：**键**（含中文说明 Tooltip）、**值**、**说明**。
3. 修改某一行的 **值** 后，光标离开输入框（失焦）即 **自动保存** 该行。
4. 点击 **刷新** 可重新从服务器加载列表。

**敏感项**（SMTP 密码、Webhook Secret、LangSmith API Key）在列表中显示为 `***`；若不修改，请保持输入框为空（占位 `***`），保存时保留原值。若要更换，输入新值后失焦保存。

## 白名单参数一览

### 站点与品牌

| 键 | 说明 |
|----|------|
| `RXWF_PUBLIC_URL` | 对外访问基础 URL（密码重置链接、外链等） |
| `RXWF_BRAND_NAME` | 界面显示的产品名称 |
| `RXWF_BRAND_LOGO_URL` | 品牌 Logo 图片地址（可选） |

### 邮件 (SMTP)

| 键 | 说明 |
|----|------|
| `RXWF_SMTP_HOST` | 发信服务器；留空则禁用邮件相关能力 |
| `RXWF_SMTP_PORT` | 端口（如 `587`） |
| `RXWF_SMTP_SECURE` | 是否 TLS：`true` / `false` |
| `RXWF_SMTP_USER` | SMTP 用户名（可选） |
| `RXWF_SMTP_PASSWORD` | SMTP 密码（敏感） |
| `RXWF_SMTP_FROM` | 发件人地址 |

配置完整 SMTP 且设置 `RXWF_PUBLIC_URL` 后，[系统](/help/settings/system) 页可 **发送测试邮件** 并启用密码重置等能力。

### 集成与可观测性

| 键 | 说明 |
|----|------|
| `RXWF_WEBHOOK_SECRET` | 内部 HMAC 签名备用密钥（如 Crew 工具桥接）；**不是** [Webhook 触发节点](/help/nodes/webhookTrigger) 节点参数里的 `hmacSecret` |
| `RXWF_LANGCHAIN_TRACING_V2` | 是否启用 LangSmith：`true` / `false` |
| `RXWF_LANGCHAIN_API_KEY` | LangSmith API Key（敏感） |
| `RXWF_LANGCHAIN_PROJECT` | LangSmith 项目名 |

### 运行时

| 键 | 说明 |
|----|------|
| `RXWF_WORKSPACE_ROOT` | RxWF 工作区根目录（文件类 Tool 等）；留空使用默认数据目录 |
| `RXWF_SANDBOX_CODE_TIMEOUT_MS` | Code 节点沙箱超时（毫秒）；`-1` 表示不限制 |

## 在表达式中使用

`$env` 仅暴露上述 **RXWF_\*** 键，值均为 **字符串**：

```javascript
{{ $env.RXWF_PUBLIC_URL }}
{{ $env["RXWF_SMTP_HOST"] }}
{{ $env.RXWF_LANGCHAIN_TRACING_V2 === 'true' }}
{{ Number($env.RXWF_SANDBOX_CODE_TIMEOUT_MS ?? '-1') }}
```

Code 节点、HTTP 节点与 INPUT 面板的环境上下文同样遵循此白名单。详见 [表达式](/help/expressions)。

## 不在本页的配置

以下仍在专用设置页维护，**不会**合并进环境变量表：

| 主题 | 页面 |
|------|------|
| 工作流自定义键值 | [变量](/help/settings/variables) |
| 知识库 Embedding / RAG 默认模型 | [知识库](/help/settings/knowledge) |
| Web 搜索 Provider | 设置中的 Web 搜索页 |
| LLM Provider 与模型注册 | [模型目录](/help/settings/models) |

## 权限

导航中 **环境变量** 对 Admin 可见并可编辑；非 Admin 用户无法从侧栏进入该页（若直接访问 URL，仅可只读查看，无法保存）。

## 相关页面

- [系统](/help/settings/system) — 运行时摘要、SMTP 测试邮件
- [Setup](/help/settings/setup) — 初始化检查（含 Public URL 等项）
- [变量](/help/settings/variables) — `$vars` 自定义全局变量
