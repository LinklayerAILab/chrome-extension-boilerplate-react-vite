# Binance Token Agent 分析功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Token 卡片的 Agent 按钮添加流式分析功能，用户输入自定义内容后调用 SSE 接口获取分析结果并流式展示。

**Architecture:** 新建独立 `BinanceAnalysisModal` 组件，包含输入阶段和流式展示阶段。在 `agent_c.ts` 中添加 `binance_token_analysis_streaming` 函数。修改 `Token.tsx` 的 `TokenCard` 组件绑定点击事件。

**Tech Stack:** React, TypeScript, Redux, SSE (Server-Sent Events), Ant Design (TextArea, Button, message), Portal rendering

---

### Task 1: 添加 binance_token_analysis_streaming API 函数

**Files:**
- Modify: `pages/content-ui/src/api/agent_c.ts` (在 `liquidity_check_dify` 函数之后，约第 891 行后)

- [ ] **Step 1: 在 agent_c.ts 末尾添加 binance_token_analysis_streaming 函数**

在 `liquidity_check_dify` 函数之后（文件末尾附近），添加以下函数：

```typescript
// Binance Token Analysis Streaming API
export const binance_token_analysis_streaming = (
  input: string,
  endFun?: () => void,
  abortController?: AbortController,
) => {
  return streamingRequest<BinanceTokenAnalysisStreamingResponse>(
    `${API_BASE_URL}/v1/binance_token_analysis`,
    {
      method: 'POST',
      cache: 'no-store',
      body: JSON.stringify({ input }),
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
    },
    {
      endFun,
      abortController,
      parseMode: 'sse',
      forceDirect: true,
    },
  );
};
```

同时，在 `StreamingResponse` 类型定义之后（约第 777 行后），添加新的响应类型：

```typescript
export type BinanceTokenAnalysisStreamingResponse =
  | {
      event: 'message' | 'workflow_started' | 'workflow_finished' | 'message_end';
      answer?: string;
      data?: {
        analyse_result?: {
          output?: {
            output: string;
          };
        };
        recommend_result?: {
          output?: {
            output: string;
          };
        };
        text?: string;
        content?: string;
      };
      text?: string;
      content?: string;
    }
  | string;
```

- [ ] **Step 2: 验证类型编译**

Run: `cd pages/content-ui && pnpm type-check`
Expected: No type errors related to new code

- [ ] **Step 3: Commit**

```bash
git add pages/content-ui/src/api/agent_c.ts
git commit -m "feat: add binance_token_analysis_streaming API function"
```

---

### Task 2: 创建 BinanceAnalysisModal 组件

**Files:**
- Create: `pages/content-ui/src/matches/all/components/BinanceAnalysisModal.tsx`

- [ ] **Step 1: 创建 BinanceAnalysisModal 组件文件**

```tsx
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@src/store';
import { useI18n } from '@src/lib/i18n';
import { message, Button, TextArea } from '@src/ui';
import {
  binance_token_analysis_streaming,
  type BinanceTokenAnalysisStreamingResponse,
  type BinanceTokenScreenItem,
} from '@src/api/agent_c';
import { syncPoints } from '@src/store/slices/userSlice';
import { store } from '@src/store';
import { ChatMessage } from './ChatMessage';
import type { MessageChunk } from './Typewriter';

interface BinanceAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: BinanceTokenScreenItem;
  isLogin: boolean;
}

type ModalStatus = 'input' | 'loading' | 'generating' | 'end';

const BinanceAnalysisModal = memo(({ isOpen, onClose, token, isLogin }: BinanceAnalysisModalProps) => {
  const { t } = useI18n();
  const tAny = t as unknown as Record<string, any>;
  const bot = chrome.runtime.getURL('content-ui/agent/banner.png');

  // Layout box portal target
  const [layoutBox, setLayoutBox] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const findInShadowDOMs = (): HTMLElement | null => {
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const shadowRoot = (el as any).shadowRoot;
        if (shadowRoot) {
          const found = shadowRoot.getElementById('layout-box');
          if (found) return found as HTMLElement;
        }
      }
      return null;
    };

    let element = document.getElementById('layout-box');
    if (!element) {
      element = findInShadowDOMs();
    }

    if (element) {
      setLayoutBox(element);
      return;
    }

    const observer = new MutationObserver(() => {
      let el = document.getElementById('layout-box');
      if (!element) {
        el = findInShadowDOMs();
      }
      if (el) {
        setLayoutBox(el);
        observer.disconnect();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const timeout = setTimeout(() => {
      let el = document.getElementById('layout-box');
      if (!el) {
        el = findInShadowDOMs();
      }
      if (el) {
        setLayoutBox(el);
      } else {
        observer.disconnect();
        setLayoutBox(document.body);
      }
    }, 3000);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, []);

  // State
  const [status, setStatus] = useState<ModalStatus>('input');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [messageChunks, setMessageChunks] = useState<MessageChunk[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamAbortController = useRef<AbortController | null>(null);

  // Cleanup
  const cleanup = useCallback(() => {
    if (streamAbortController.current) {
      streamAbortController.current.abort();
      streamAbortController.current = null;
    }
    setLoading(false);
    setMessageChunks([]);
    setStatus('input');
    setIsStreaming(false);
    setInputText('');
  }, []);

  // Close handler
  const handleClose = useCallback(() => {
    cleanup();
    onClose();
  }, [cleanup, onClose]);

  // Stop streaming
  const stopCreation = useCallback(() => {
    if (streamAbortController.current) {
      streamAbortController.current.abort();
      streamAbortController.current = null;
    }
    setStatus('end');
    setLoading(false);
    setIsStreaming(false);
  }, []);

  // Start streaming analysis
  const startAnalysis = useCallback(async () => {
    if (!isLogin) {
      message.warning(tAny?.common?.pleaseLogin ?? 'Please login first');
      return;
    }

    const currentPoints = store.getState().user.points;
    if (currentPoints < 10) {
      message.warning(tAny?.common?.notEnoughPoints ?? 'Points not enough');
      return;
    }

    const query = `${t.agent?.analyze ?? 'Analyze'}\n${JSON.stringify(token)}`;
    const fullInput = inputText.trim() ? `${query}\n${inputText.trim()}` : query;

    setStatus('loading');
    setLoading(true);
    setMessageChunks([]);
    setIsStreaming(true);

    try {
      streamAbortController.current = new AbortController();

      const streamGenerator = binance_token_analysis_streaming(
        fullInput,
        undefined,
        streamAbortController.current,
      );

      for await (const chunk of streamGenerator) {
        if (streamAbortController.current?.signal.aborted) {
          break;
        }

        let newContent = '';

        if (chunk && typeof chunk === 'object') {
          if ('event' in chunk && chunk.event === 'message' && 'answer' in chunk && chunk.answer !== undefined) {
            newContent = chunk.answer;
          } else if ('event' in chunk && chunk.event === 'workflow_started') {
            // eslint-disable-next-line no-console
            console.log('[BinanceAnalysis] Workflow started');
          } else if ('event' in chunk && chunk.event === 'workflow_finished') {
            streamAbortController.current = null;
            setIsStreaming(false);
          } else if ('event' in chunk && chunk.event === 'message_end') {
            streamAbortController.current = null;
            setIsStreaming(false);
          } else {
            if ('data' in chunk) {
              if (chunk.data?.analyse_result?.output?.output) {
                newContent = chunk.data.analyse_result.output.output;
              } else if (chunk.data?.recommend_result?.output?.output) {
                newContent = chunk.data.recommend_result.output.output;
              } else if (chunk.data?.text) {
                newContent = chunk.data.text;
              } else if (chunk.data?.content) {
                newContent = chunk.data.content;
              }
            } else if ('text' in chunk && chunk.text) {
              newContent = chunk.text;
            } else if ('content' in chunk && chunk.content) {
              newContent = chunk.content;
            } else if ('answer' in chunk && chunk.answer) {
              newContent = chunk.answer;
            }
          }
        }

        if (newContent) {
          const newChunk: MessageChunk = {
            id: `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: newContent,
            timestamp: Date.now(),
          };

          setMessageChunks(prev => {
            if (prev.length === 0) {
              setStatus('generating');
              setTimeout(() => setLoading(false), 500);
            }
            return [...prev, newChunk];
          });
        }
      }

      setStatus('end');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error('[BinanceAnalysis] Stream request failed:', error);
      message.error(tAny?.common?.requestFailed ?? 'Request failed, please try again');
      cleanup();
    } finally {
      streamAbortController.current = null;
      setLoading(false);
      setIsStreaming(false);
    }
  }, [isLogin, token, inputText, cleanup, tAny, t]);

  // Auto-start when status changes from 'input' to 'loading'
  const dispatch = useDispatch<AppDispatch>();
  const handleStart = useCallback(() => {
    dispatch(syncPoints()).then(() => {
      setTimeout(() => {
        startAnalysis();
      }, 0);
    });
  }, [dispatch, startAnalysis]);

  useEffect(() => {
    if (!isOpen) {
      cleanup();
    }
  }, [isOpen, cleanup]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  if (!isOpen || !layoutBox) {
    return null;
  }

  const tokenSymbol = token.tokenSymbol || token.tokenName || 'Token';
  const logo = token.imageUrl || chrome.runtime.getURL('content-ui/coins/bnb.svg');

  const modalContent = (
    <div className="pointer-events-auto absolute inset-0 z-[10000] flex items-center justify-center">
      <button
        type="button"
        aria-label={tAny?.common?.closeDialog ?? 'Close dialog'}
        className="absolute inset-0 cursor-pointer bg-black/40"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[10001] flex max-h-[90vh] w-[92vw] max-w-[400px] flex-col rounded-[12px] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
          <img src={logo} alt={tokenSymbol} className="h-7 w-7 rounded-full bg-white" />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-gray-800">{tokenSymbol.toUpperCase()}</span>
            <span className="text-[10px] text-gray-400">{t.agent?.analyze ?? 'Analyze'}</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="ml-auto flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label={tAny?.common?.close ?? 'Close'}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {status === 'input' && (
            <div className="flex flex-col gap-3 p-4">
              <TextArea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={tAny?.agent?.inputPlaceholder ?? 'Enter your analysis request...'}
                autoSize={{ minRows: 3, maxRows: 6 }}
                className="w-full"
              />
              <div className="flex justify-end gap-2">
                <Button size="small" onClick={handleClose}>
                  {tAny?.common?.cancel ?? 'Cancel'}
                </Button>
                <Button size="small" type="primary" onClick={handleStart} disabled={!inputText.trim()}>
                  {tAny?.agent?.startAnalysis ?? 'Start Analysis'}
                </Button>
              </div>
            </div>
          )}

          {(status === 'loading' || status === 'generating' || status === 'end') && (
            <ChatMessage
              status={status === 'end' ? 'end' : status}
              stopCreation={stopCreation}
              isStreaming={isStreaming}
              tip={tAny?.agent?.analyzing ?? 'Analyzing...'}
              loading={loading}
              messages={messageChunks}
              initNode={<img src={bot} alt="" className="mx-auto h-20" />}
              className="h-[60vh]"
            />
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, layoutBox);
});

BinanceAnalysisModal.displayName = 'BinanceAnalysisModal';

export default BinanceAnalysisModal;
```

- [ ] **Step 2: 验证类型编译**

Run: `cd pages/content-ui && pnpm type-check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add pages/content-ui/src/matches/all/components/BinanceAnalysisModal.tsx
git commit -m "feat: add BinanceAnalysisModal component"
```

---

### Task 3: 在 Token.tsx 中绑定 Agent 按钮

**Files:**
- Modify: `pages/content-ui/src/matches/all/components/Token.tsx`

- [ ] **Step 1: 修改 Token.tsx — 添加 BinanceAnalysisModal 引用和状态**

在文件顶部的 import 区域，添加 BinanceAnalysisModal 的 import：

```typescript
// 在现有 import 之后添加
import BinanceAnalysisModal from './BinanceAnalysisModal';
```

- [ ] **Step 2: 修改 TokenCard 组件**

将 `TokenCard` 组件从：

```typescript
const TokenCard = ({ name, contractAddress, price, logo }: TokenCardProps) => {
  const { t } = useI18n();

  const optimal = t.common?.optimal || 'Optimal';
  const lpDepth = t.common?.lpDepth || 'LP Depth';
  const lpStability = t.common?.lpStability || 'LP Stability';
  const trade = t.common?.trade || 'Trade';
  const agent = t.common?.agent || 'Agent';
```

修改为：

```typescript
const TokenCard = ({ name, contractAddress, price, logo }: TokenCardProps) => {
  const { t } = useI18n();
  const isLogin = useSelector((state: RootState) => !!state.user.accessToken);

  const optimal = t.common?.optimal || 'Optimal';
  const lpDepth = t.common?.lpDepth || 'LP Depth';
  const lpStability = t.common?.lpStability || 'LP Stability';
  const trade = t.common?.trade || 'Trade';
  const agent = t.common?.agent || 'Agent';
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);

  const handleAgentClick = () => {
    setIsAnalysisOpen(true);
  };

  const handleAnalysisClose = () => {
    setIsAnalysisOpen(false);
  };
```

- [ ] **Step 3: 修改 Agent 按钮的 onClick 并添加 BinanceAnalysisModal**

将按钮区域从：

```tsx
        <Button size="small" style={{ height: 30 }} type="primary">
          {agent}
        </Button>
```

修改为：

```tsx
        <Button size="small" style={{ height: 30 }} type="primary" onClick={handleAgentClick}>
          {agent}
        </Button>
```

在 `TokenCard` 组件的 `return` 末尾（`</div>` 之前）添加：

```tsx
      {tokenData && isAnalysisOpen && (
        <BinanceAnalysisModal
          isOpen={isAnalysisOpen}
          onClose={handleAnalysisClose}
          token={tokenData}
          isLogin={isLogin}
        />
      )}
```

- [ ] **Step 4: 修改 Token 组件中 TokenCard 的调用，传递完整 token 数据**

首先，需要修改 `TokenCard` 的 props 接口，接收完整的 token 数据：

将 `TokenCardProps` 从：

```typescript
interface TokenCardProps {
  name: string;
  price?: number;
  logo: string;
  contractAddress: string;
}
```

修改为：

```typescript
interface TokenCardProps {
  name: string;
  price?: number;
  logo: string;
  contractAddress: string;
  tokenData?: BinanceTokenScreenItem;
}
```

然后，在 `Token` 组件中渲染 `TokenCard` 时传递 `tokenData`：

将：

```tsx
return <TokenCard key={key} name={name} contractAddress={key} price={token.price} logo={logo} />;
```

修改为：

```tsx
return <TokenCard key={key} name={name} contractAddress={key} price={token.price} logo={logo} tokenData={token} />;
```

- [ ] **Step 5: 在 TokenCard 内部构建 tokenData**

在 `TokenCard` 组件的 return 之前，构建用于 BinanceAnalysisModal 的 token 数据对象。由于 `TokenCard` 目前只接收部分字段，我们需要利用传入的 `tokenData`（完整的 `BinanceTokenScreenItem`）：

在 `TokenCard` 函数体内，`handleAnalysisClose` 之后添加：

```typescript
  const analysisTokenData: BinanceTokenScreenItem | undefined =
    tokenData ??
    (contractAddress
      ? ({
          tokenSymbol: name,
          imageUrl: logo,
          contractAddress,
          price,
        } as Partial<BinanceTokenScreenItem> as BinanceTokenScreenItem)
      : undefined);
```

> 注意：这里使用 `tokenData` 优先，因为它包含完整的 `BinanceTokenScreenItem` 数据。fallback 构造是为了类型安全。

- [ ] **Step 6: 添加缺失的 import**

在文件顶部添加：

```typescript
import type { BinanceTokenScreenItem } from '@src/api/agent_c';
```

确保 `useSelector` 已从 `react-redux` import（已有）。

- [ ] **Step 7: 验证编译**

Run: `cd pages/content-ui && pnpm type-check`
Expected: No type errors

- [ ] **Step 8: 验证 lint**

Run: `pnpm lint`
Expected: No lint errors

- [ ] **Step 9: Commit**

```bash
git add pages/content-ui/src/matches/all/components/Token.tsx
git commit -m "feat: wire Agent button to BinanceAnalysisModal in TokenCard"
```

---

### Task 4: 添加缺失的 i18n 翻译 key

**Files:**
- Modify: `pages/content-ui/src/lib/i18n/locales/en.ts`
- Modify: `pages/content-ui/src/lib/i18n/locales/zh.ts`
- Modify: `pages/content-ui/src/lib/i18n/locales/ja.ts`
- Modify: `pages/content-ui/src/lib/i18n/locales/ko.ts`
- Modify: `pages/content-ui/src/lib/i18n/locales/ru.ts`
- Modify: `pages/content-ui/src/lib/i18n/locales/types.ts`

- [ ] **Step 1: 在 types.ts 中添加新的翻译 key 类型**

在 `agent` 命名空间类型中添加：

```typescript
inputPlaceholder?: string;
startAnalysis?: string;
```

- [ ] **Step 2: 在 en.ts 的 agent 对象中添加**

```typescript
inputPlaceholder: 'Enter your analysis request...',
startAnalysis: 'Start Analysis',
```

- [ ] **Step 3: 在 zh.ts 的 agent 对象中添加**

```typescript
inputPlaceholder: '请输入你的分析请求...',
startAnalysis: '开始分析',
```

- [ ] **Step 4: 在 ja.ts 的 agent 对象中添加**

```typescript
inputPlaceholder: '分析リクエストを入力...',
startAnalysis: '分析を開始',
```

同时修正现有的 `analyze` 值（当前为 `"はい"` 应改为 `"分析する"`）：

```typescript
analyze: '分析する',
```

- [ ] **Step 5: 在 ko.ts 的 agent 对象中添加**

```typescript
inputPlaceholder: '분석 요청을 입력하세요...',
startAnalysis: '분석 시작',
```

- [ ] **Step 6: 在 ru.ts 的 agent 对象中添加**

```typescript
inputPlaceholder: 'Введите запрос анализа...',
startAnalysis: 'Начать анализ',
```

- [ ] **Step 7: 验证类型编译**

Run: `cd pages/content-ui && pnpm type-check`
Expected: No type errors

- [ ] **Step 8: Commit**

```bash
git add pages/content-ui/src/lib/i18n/locales/
git commit -m "feat: add i18n keys for BinanceAnalysisModal"
```

---

### Task 5: 端到端验证

- [ ] **Step 1: 启动开发服务器**

Run: `pnpm dev`
Expected: Dev server starts without errors, HMR connects

- [ ] **Step 2: 在浏览器中测试完整流程**

1. 加载扩展到 Chrome（加载 `dist/` 目录）
2. 打开 X/Twitter 页面，确认扩展侧边栏显示 Token 卡片
3. 点击 Token 卡片上的 Agent 按钮
4. 验证：弹出输入框，显示代币图标和名称
5. 输入分析内容并提交
6. 验证：显示 loading 状态，然后流式返回分析结果
7. 点击停止按钮
8. 验证：请求被中止
9. 点击关闭按钮
10. 验证：弹窗关闭，状态完全清理

- [ ] **Step 3: 运行 lint 和 type-check**

Run: `pnpm lint && pnpm type-check`
Expected: All pass
