# Web Search 工具卫星

## 用途

**toolWebSearch** 将 **联网搜索** 注册为 Agent Tool。LLM 传入 `query`（或 `q`）及可选 `maxResults`，运行时经 `@rxwf/web-search` 或 Agent Runner 的 `web_search` capability 出站查询。须先在 **设置 → Web Search** 配置 Provider（Tavily / Brave / Bing / custom）与凭证。

Skill Run 场景下，Skill 包须声明 **`network`** 权限，否则 **E1072**。

## 端口与连接

```
toolWebSearch ──ai_tool──→ aiAgent 或 skillRun
```

Fixed-capability 卫星：**Tool 描述** 由内置 i18n 自动生成（面板只读）。

## 参数

| 参数 | 说明 |
|------|------|
| **继承配置**（`inheritConfig`） | 默认 `true`：使用系统 Web Search 设置 |
| **凭证模式**（`credentialMode`） | `platform`：平台解密后经 Runner relay；`runner-local`：Runner 本地凭证 |
| **Provider / 凭证** | `inheritConfig=false` 时节点级覆盖 |

### LLM 调用参数

| 参数 | 说明 |
|------|------|
| `query` / `q` | 搜索关键词 |
| `maxResults` | 可选结果条数上限 |

**Embedded** 使用 API `@rxwf/web-search`；**Agent Runner** 经 `resolveWebSearchProviderConfig` relay API Key（`platform` 模式密钥不进作业载荷）。单次执行有查询次数上限（**E1073**）。

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E2003** | 对 toolWebSearch 直接 debug-node |
| **E1071** | Provider 未配置或 query 为空 |
| **E1072** | Skill Run 的 Skill 无 network 权限 |
| **E1073** | 单次执行 Web Search 调用次数超限 |
| **E1074** | Provider 请求失败或超时 |

## 示例

### 示例 A

1. **设置 → Web Search** 配置 Tavily 等 Provider 与 API Key
2. 添加 `toolWebSearch`，**继承配置** 保持开启
3. **ai_tool** 连到 `aiAgent` + Chat Model
4. Prompt：「搜索今日 React 19 发布要点并总结」

### 示例 B

- **继承配置** = `false`
- 选择 **Provider** 与 **凭证**
- **凭证模式** 按部署选 `platform` 或 `runner-local`

### 示例 C

1. Skill 的 `SKILL.md` frontmatter 含 `network` 权限
2. `skillRun` 显式接 `toolWebSearch`（M-2 须显式接线，非内置）
3. 与 `toolRead` 组合：先搜索再读本地缓存文件

## 参见

- [AI Agent 节点](/help/nodes/aiAgent)
- [Skill Run 节点](/help/nodes/skillRun)
- [Read 工具卫星](/help/nodes/toolRead)
