import { memo, ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@src/store';
import { useI18n } from '@src/lib/i18n';
import { message } from '@src/ui';
import {
  analyse_coin_c_streaming,
  liquidity_check_dify,
  recommend_coin_c_streaming,
  type StreamingResponse,
} from '@src/api/agent_c';
import { requestTurnstileToken } from '@src/lib/turnstile';
import type { MessageChunk } from './Typewriter';
import { ChatMessage } from './ChatMessage';
import TypewriterNode from './TypewriterNode';
import { getSyncAssets } from '@src/store/slices/assetsSlice';
import { syncPoints } from '@src/store/slices/userSlice';
import { store } from '@src/store';

interface StreamingModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'analyse' | 'recommend' | 'liquidity_check';
  query: string;
  coinSymbol?: string;
  title?: ReactNode; // 新增：自定义标题
}

const StreamingModal = memo(({ isOpen, onClose, type, query, coinSymbol, title }: StreamingModalProps) => {
  const { t } = useI18n();
  const bot = chrome.runtime.getURL('content-ui/agent/banner.png');
  const tAny = t as unknown as Record<string, any>;
  const isLogin = useSelector((state: RootState) => state.user?.isLogin ?? false);

  // 获取 layout-box 元素
  const [layoutBox, setLayoutBox] = useState<HTMLElement | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  // 组件初始化时就查找 layout-box
  useLayoutEffect(() => {
    console.log('[StreamingModal] Component mounted, looking for layout-box...');

    // 尝试在所有 Shadow DOM 中查找 layout-box
    const findInShadowDOMs = (): HTMLElement | null => {
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const shadowRoot = (el as any).shadowRoot;
        if (shadowRoot) {
          const found = shadowRoot.getElementById('layout-box');
          if (found) {
            console.log('[StreamingModal] ✓ Found layout-box in Shadow DOM of:', el);
            return found as HTMLElement;
          }
        }
      }
      return null;
    };

    // 立即尝试查找
    let element = document.getElementById('layout-box');
    if (!element) {
      element = findInShadowDOMs();
    }

    if (element) {
      console.log('[StreamingModal] ✓ Found layout-box on mount:', element);
      setLayoutBox(element);
      return;
    }

    console.log('[StreamingModal] layout-box not found on mount, setting up observer...');

    // 创建 MutationObserver 持续监听（包括 Shadow DOM）
    const observer = new MutationObserver(() => {
      let el = document.getElementById('layout-box');
      if (!el) {
        el = findInShadowDOMs();
      }

      if (el) {
        console.log('[StreamingModal] ✓ Found layout-box via observer:', el);
        setLayoutBox(el);
        observer.disconnect();
        observerRef.current = null;
      }
    });

    observerRef.current = observer;

    // 观察整个 document
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 3秒后如果还没找到，回退到 body
    const timeout = setTimeout(() => {
      let el = document.getElementById('layout-box');
      if (!el) {
        el = findInShadowDOMs();
      }

      if (el) {
        console.log('[StreamingModal] ✓ Found layout-box on timeout:', el);
        setLayoutBox(el);
      } else {
        observer.disconnect();
        observerRef.current = null;
        console.error('[StreamingModal] ✗ layout-box not found after 3s, falling back to body');
        setLayoutBox(document.body);
      }
    }, 3000);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, []); // 只在组件挂载时执行一次

  // 使用传入的 title，如果没有则根据 type 生成默认标题
  const headerTitle =
    title ||
    (type === 'analyse'
      ? (tAny?.agent?.analyzeCoin ?? 'Analyzing Coin')
      : type === 'recommend'
        ? (tAny?.agent?.recommendCoin ?? 'Recommended Coin')
        : (tAny?.alpha?.liquidityCheck ?? 'Liquidity Check'));

  const [status, setStatus] = useState<'init' | 'loading' | 'generating' | 'end'>('init');
  const [loading, setLoading] = useState(false);
  const [messageChunks, setMessageChunks] = useState<MessageChunk[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamAbortController = useRef<AbortController | null>(null);
  const hasStartedRef = useRef(false);

  const labels = useMemo(
    () => ({
      analyzing: tAny?.agent?.analyzing ?? 'Analyzing...',
      pleaseLogin: tAny?.common?.pleaseLogin ?? 'Please login first',
      notEnoughPoints: tAny?.common?.notEnoughPoints ?? 'Points not enough',
      taskRunning: tAny?.common?.taskRunning ?? 'Task is running',
    }),
    [tAny],
  );

  // 清理函数 - 完全清除所有状态和缓存
  const cleanup = useCallback(() => {
    console.log('[StreamingModal] 🧹 Starting cleanup...');

    // 1. 取消所有正在进行的请求
    if (streamAbortController.current) {
      console.log('[StreamingModal] ❌ Aborting stream request');
      streamAbortController.current.abort();
      streamAbortController.current = null;
    }

    // 2. 重置所有 ref
    hasStartedRef.current = false;

    // 3. 重置所有状态
    console.log('[StreamingModal] 🔄 Resetting all states');
    setLoading(false);
    setMessageChunks([]);
    setStatus('init');
    setIsStreaming(false);

    console.log('[StreamingModal] ✅ Cleanup completed');
  }, []);

  // 停止生成 - 用户主动停止
  const stopCreation = useCallback(() => {
    console.log('[StreamingModal] 🛑 User requested to stop creation');

    // 立即取消请求
    if (streamAbortController.current) {
      console.log('[StreamingModal] ❌ Aborting stream request due to user stop');
      streamAbortController.current.abort();
      streamAbortController.current = null;
    }

    // 标记为结束
    setStatus('end');
    setLoading(false);
    setIsStreaming(false);

    // 关闭弹窗
    console.log('[StreamingModal] 🚪 Closing modal after user stop');
    onClose();
  }, [onClose]);

  // 处理弹窗关闭 - 确保先清理再关闭
  const handleClose = useCallback(() => {
    console.log('[StreamingModal] 🔚 Handle close called');
    cleanup(); // 先执行清理
    onClose(); // 再调用外部关闭函数
  }, [cleanup, onClose]);

  // 启动流式请求
  const startStreaming = useCallback(async () => {
    if (!isLogin) {
      message.warning(labels.pleaseLogin);
      onClose();
      return;
    }

    // 🔥 关键修复：从 Redux store 获取最新的积分值，而不是使用闭包中的旧值
    const currentPoints = store.getState().user.points;
    console.log('[StreamingModal] Current points:', currentPoints);

    // 检查积分是否足够
    if (currentPoints < 10) {
      message.warning(labels.notEnoughPoints);
      onClose();
      return;
    }

    if (streamAbortController.current) {
      return;
    }

    cleanup();
    setStatus('loading');
    setLoading(true);
    setMessageChunks([]);
    setIsStreaming(true);

    try {
      // 创建 AbortController
      streamAbortController.current = new AbortController();

      const streamGenerator =
        type === 'analyse'
          ? analyse_coin_c_streaming(query, undefined, undefined, streamAbortController.current)
          : type === 'recommend'
            ? recommend_coin_c_streaming(query, undefined, undefined, streamAbortController.current)
            : liquidity_check_dify(`${t.agent.analyze} ${query}`, undefined, streamAbortController.current);

      // 处理流式数据
      for await (const chunk of streamGenerator) {
        // 检查是否被中止
        if (streamAbortController.current?.signal.aborted) {
          console.log('Stream request aborted');
          break;
        }

        console.log('Received chunk:', chunk);

        let newContent = '';

        // 处理 SSE 事件格式
        if (chunk && typeof chunk === 'object') {
          if ('event' in chunk && chunk.event === 'message' && 'answer' in chunk && chunk.answer !== undefined) {
            newContent = chunk.answer;
          } else if ('event' in chunk && chunk.event === 'workflow_started') {
            console.log('Workflow started');
          } else if ('event' in chunk && chunk.event === 'workflow_finished') {
            console.log('Workflow finished');
            streamAbortController.current = null;
            setIsStreaming(false);
          } else if ('event' in chunk && chunk.event === 'message_end') {
            console.log('Message ended');
            streamAbortController.current = null;
            setIsStreaming(false);
          } else {
            // 处理其他可能的数据格式
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

        // 如果获取到新内容，添加到消息列表
        if (newContent !== undefined && newContent !== null && newContent !== '') {
          const newChunk: MessageChunk = {
            id: `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: newContent,
            timestamp: Date.now(),
          };

          setMessageChunks(prev => {
            if (prev.length === 0) {
              setStatus('generating');
              // 延迟关闭 loading
              setTimeout(() => setLoading(false), 500);
            }
            return [...prev, newChunk];
          });
        }
      }

      // 流式请求完成
      setStatus('end');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('Stream request aborted by user');
        return;
      }

      console.error('Stream request failed:', error);
      message.error(tAny?.common?.requestFailed ?? 'Request failed, please try again');
      cleanup();
    } finally {
      streamAbortController.current = null;
      setLoading(false);
      setIsStreaming(false);
    }
  }, [isLogin, type, query, cleanup, onClose, labels, tAny]);

  // 当弹窗打开时，自动开始流式请�?
  const dispatch = useDispatch<AppDispatch>();
  useEffect(() => {
    if (isOpen) {
      if (!hasStartedRef.current) {
        setStatus('loading');
        setLoading(true);
        hasStartedRef.current = true;
        dispatch(syncPoints()).then(() => {
          // 使用 setTimeout 确保 Redux store 已更新
          setTimeout(() => {
            startStreaming();
          }, 0);
        });
      }
    } else {
      // 弹窗关闭时，执行完整的清理
      console.log('[StreamingModal] 🔚 Modal is closing, executing full cleanup');
      cleanup();
      hasStartedRef.current = false; // 重置启动标志，允许下次重新启动
    }
  }, [isOpen, startStreaming, cleanup, dispatch]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // 监听 textLoaded 事件
  useEffect(() => {
    const handleTextLoaded = () => {
      setStatus('end');
    };

    window.addEventListener('textLoaded', handleTextLoaded);
    return () => {
      window.removeEventListener('textLoaded', handleTextLoaded);
    };
  }, []);

  if (!isOpen) {
    console.log('[StreamingModal] Not rendering: isOpen is false');
    return null;
  }

  if (!layoutBox) {
    console.log('[StreamingModal] Not rendering: layoutBox is null');
    return null;
  }

  console.log('[StreamingModal] Rendering modal with layoutBox:', layoutBox);

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
        <div>{headerTitle}</div>
        {/* Header */}
        {/* <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-bold text-gray-800">
            {headerTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
            aria-label={tAny?.common?.close ?? 'Close'}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div> */}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <ChatMessage
            status={status}
            stopCreation={stopCreation}
            isStreaming={isStreaming}
            tip={labels.analyzing}
            loading={loading}
            messages={messageChunks}
            initNode={<TypewriterNode text={tAny?.agent?.initStr1 ?? 'How can I help you?'} icon={bot} />}
            className="h-[60vh]"
          />
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, layoutBox);
});

StreamingModal.displayName = 'StreamingModal';

export default StreamingModal;
