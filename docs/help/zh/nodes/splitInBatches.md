# Split In Batches 节点

## 用途

将上游 Items **按固定大小切分为多路输出分支**（legacy 分批流式处理）。与 [Loop](/help/nodes/loop) 不同：无 loop/done 双出口、无引擎内联迭代；每批对应一个 **output 分支**，需自行用 Merge 或后续节点处理。该节点属 **Plus** 轨，须启用 `registerPlusExecutors`；未注册时抛 **E2003**。

## 端口与连接

| 方向 | ID | 说明 |
|------|-----|------|
| 输入 | main | 待分批 Items |
| 输出 | 动态多分支 | 第 i 路为第 i 批 Items；空输入时为单路空分支 |

```
set → splitInBatches →（各批）→ httpRequest → merge …
```

编辑器默认显示单 main 出口；执行时引擎按批数展开多路 `outputItems`。

## 参数

| 参数 | 说明 |
|------|------|
| **批次大小**（`batchSize`） | 每批 Item 数，默认 `1`；≤0 或非有限数运行时钳制为 `1` |

例：5 条 Item、`batchSize=2` → 3 个输出分支（2+2+1）。

## 常见错误

| 错误码 / 现象 | 说明 |
|---------------|------|
| **E2003** | Plus 轨未启用，registry 无 `splitInBatches` |
| 批数过多 | 上游 Items 极大时分支数 = ceil(n/batchSize)，注意下游 Merge 配置 |
| 与 Loop 混淆 | 需 done 汇总与循环体迭代时请用 Loop |

## 示例

### 示例 A

`batchSize=10`：1000 条 webhook 事件分 100 批，每批接 HTTP 批量上报 API。

### 示例 B

`batchSize=1`（默认）：与 legacy n8n 行为一致，每 Item 独立分支，便于逐条 Code 处理后再 Merge append。

### 示例 C

空输入：返回 `[[]]` 单路空分支，节点 success，下游可安全跳过。

## 与 Loop 的区别

| | Split In Batches | Loop |
|---|------------------|------|
| 语义 | 静态切批、多路输出 | 循环体迭代 + done 汇总 |
| 出口 | 多分支（按批数） | loop + done |
| 汇总 | 需自行 Merge | done 自动合并 |

新工作流建议使用 **Loop** 表达重复子流程。
