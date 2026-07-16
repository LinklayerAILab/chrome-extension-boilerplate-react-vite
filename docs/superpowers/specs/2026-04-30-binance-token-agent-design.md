# Binance Token Agent 分析功能设计

## 上下文

Token.tsx 中的 TokenCard 组件已有一个 Agent 按钮占位符（无交互），需要为其添加流式分析功能，参考 AlphaCard 组件的 Agent 按钮模式。用户点击按钮后输入自定义分析内容，调用 `binance_token_analysis_streaming` SSE 接口获取分析结果并流式展示。

## 架构

采用方案 C：新建独立 `BinanceAnalysisModal` 组件，不影响现有 `StreamingModal` 及其调用方。

### 组件关系

```
Token.tsx (TokenCard)
  └─ onClick Agent → BinanceAnalysisModal
       ├─ 输入阶段 (TextArea + 提交)
       └─ 流式阶段 (打字机效果展示)
            └─ binance_token_analysis_streaming (agent_c.ts)
```

### 修改文件

| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | `agent_c.ts` | 添加 `binance_token_analysis_streaming` 函数 |
| 新增 | `BinanceAnalysisModal.tsx` | 独立分析弹窗组件 |
| 修改 | `Token.tsx` | TokenCard 添加 Agent 点击逻辑 + 引用 BinanceAnalysisModal |

## API 调用

```
POST /api/v1/binance_token_analysis
{
  "input": "分析\n{JSON.stringify(BinanceTokenScreenItem)}"
}
```

## BinanceAnalysisModal 设计

### Props

- `isOpen: boolean` — 控制显隐
- `onClose: () => void` — 关闭回调
- `token: BinanceTokenScreenItem` — 完整代币数据
- `isLogin: boolean` — 登录状态

### 状态机

`input` → `loading` → `generating` → `end`

- `input`: 显示 TextArea + 提交/取消按钮
- `loading`: 显示 loading spinner（首次请求）
- `generating`: 流式文本 + 停止按钮
- `end`: 完整文本 + 关闭按钮

### 关键逻辑

- 提交时验证登录和积分（≥10 分），参考 StreamingModal 的 checkPoints 逻辑
- 使用 `for await (const chunk of streamGenerator)` 遍历 SSE 事件
- 从 chunk 中提取文本：`answer` / `data.analyse_result.output.output` / `data.text` / `content`
- 使用 AbortController 支持中止
- 渲染通过 Portal 到 `#layout-box`

## 验证

1. 点击 Token 卡片上的 Agent 按钮，应弹出输入框
2. 输入内容并提交，应开始流式分析
3. 点击停止按钮应中断请求
4. 点击关闭按钮应关闭弹窗
