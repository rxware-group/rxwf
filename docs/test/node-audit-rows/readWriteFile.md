# readWriteFile — AUDIT-N-readWriteFile

> M-3 节点审查单行记录（action / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 operation/path/binaryPropertyName/content；`NodeEditorParamsPane` 按 operation 条件显示 content 与 binaryPropertyName |
| validation | ok | 无独立保存期 type 级错误码；运行时空 path、不支持 operation、IO/binary 缺失返回 `failed` + `E2002` |
| executor | ok | `readWriteFileExecutor`（`packages/node-runner/src/executors/read-write-file.ts`）经 `registerPlusExecutors` 注册；`read-write-file.test.ts` 覆盖 read/write/append/binary/表达式 |
| error_codes | E2002,E2003 | 空 path、不支持 operation、文件 IO 失败、binary 缺失 → `E2002`；registry 未注册 → `E2003` |
| e2e_spec | nodes/readWriteFile.spec.ts | `@any` 面板 + debug-node write/read 往返 + 空 path 失败 |
| status | ok | 审查通过；执行器与面板已就绪，补充 registry/audit 单测与 E2E |

## 参数模型

- `operation`：`read` | `readBinary` | `write` | `writeBinary` | `append`（默认 `read`）。
- `path`：文件路径，支持 `{{ }}` 表达式与 per-item `$itemIndex` 嵌入。
- `binaryPropertyName`：读写 binary 时的 `item.binary` 键名（默认 `data`）。
- `content`：Write/Append 文本内容；Write 留空且上游有 binary 时自动写入二进制。

## 执行语义

- Plus 执行器：`registerPlusExecutors` 注册 `type: readWriteFile`；remote runner 经 `register-core` 同步注册。
- `read`：输出 `{ operation, path, content }` 文本。
- `readBinary`：输出 json + `item.binary[propertyName]`。
- `write` / `append`：逐 input item 写入；Write 无显式 content 时优先写上游 binary。
- `writeBinary`：解码 `item.binary` 写入磁盘，保留上游 binary。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E2002 | path 仅空白；不支持 operation；文件不存在/权限失败；binary 属性缺失或未 hydrate |
| E2003 | executor registry 未注册 `readWriteFile` |

## E2E

- Spec：`apps/web/e2e/nodes/readWriteFile.spec.ts`（E2E-N-readWriteFile）
- 轨：plus（`RXWF_E2E_TRACK=plus`）；`@plus @any` 用例在 standard/plus 轨运行（lite 轨跳过）
- 覆盖：面板 operation/path/content/binary 字段；debug-node write→read 往返；空白 path 返回 `E2002`

## 备注

- 需要 runner `file` capability（`node-runner-requirements.ts`）。
- 帮助文档 `docs/help/zh/nodes/readWriteFile.md` 由 M-6 负责。
