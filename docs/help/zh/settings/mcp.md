# MCP 服务器

在 **设置 → MCP**（`/settings/mcp`）中配置 **Model Context Protocol** 外部工具服务器，供 [MCP Client 节点](/help/nodes/mcpClient) 与 Agent Tool 调用。

## 添加服务器

填写名称并选择 **传输方式**：

| 传输 | 说明 |
|------|------|
| **npx / stdio** | 本地子进程，填写 command 与 args |
| **HTTP** | 远程 HTTP MCP 端点 URL |
| **Docker** | 容器化 MCP，配置镜像、命令、卷、环境变量与网络 |

保存后可在列表中 **测试连接**，确认 connected / failed 状态。

## Docker 配置

- **dockerCommand** / **dockerImage** / **dockerArgs**
- **dockerVolumes**：每行 `host:container`
- **dockerEnv**：每行 `KEY=value`
- **dockerNetwork**：可选网络名

## 与工作流

- 工作流中添加 **MCP Client** 或 **Tool (MCP)** 节点，选择此处配置的服务器名。
- 与 [MCP Token](/help/settings/mcp-tokens) 不同：本页为**出站**连接外部 MCP；Token 页为**入站**暴露本平台 MCP API。

## 故障排查

- stdio：确认 command 在 Runner 机器 PATH 中可用。
- HTTP：检查 URL、TLS 与防火墙。
- Docker：确认 Runner 主机已安装 Docker 且有权拉取镜像。

## 相关帮助

- [MCP Client 节点](/help/nodes/mcpClient)
- [Tool (MCP) 节点](/help/nodes/toolMcp)
