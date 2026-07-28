# 升级到 RX-Workflow（自 rx-workflow 重命名）

## Breaking changes

| 旧 | 新 |
|----|-----|
| 环境变量 `RXWF_*` | `RXWF_*` |
| CLI `awf` / `rxwf-runner` | `rxwf` / `rxwf-runner` |
| npm scope `@rxwf/*` | `@rxwf/*` |
| Lite SQLite `data/rxwf.db` | `data/rxwf.db` |
| CLI 状态目录 `.rxwf/` | `.rxwf/` |
| Webhook headers `x-rxwf-*` | `x-rxwf-*` |
| Shell 节点 env `RXWF_JSON` | `RXWF_JSON` |
| Docker 镜像 `ghcr.io/rxwf/*` | `ghcr.io/rxwf/*` |
| Postgres 默认 `awf/awf/awf` | `rxwf/rxwf/rxwf` |

## Lite 本地数据迁移

```bash
# 停止 API 后
mv data/rxwf.db data/rxwf.db
# 若有 CLI secrets
mv .awf .rxwf
```

## 环境变量迁移示例

```bash
# 旧
export RXWF_HTTP_PORT=8787
export RXWF_DATA_DIR=./data

# 新
export RXWF_HTTP_PORT=8787
export RXWF_DATA_DIR=./data
```

## Webhook 集成

更新发送方 HTTP headers：

- `x-rxwf-signature` → `x-rxwf-signature`
- `x-rxwf-timestamp` → `x-rxwf-timestamp`

## Runner

- 配置文件：`rxwf-runner.json` → `rxwf-runner.json`
- 命令：`rxwf-runner register` / `rxwf-runner start`

## 前端

localStorage key 前缀由 `awf.*` 改为 `rxwf.*`；用户语言/布局偏好可能需重新设置。

## 无兼容层

本次为硬切换，系统**不会**读取旧环境变量或旧 CLI 名称。
