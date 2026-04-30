import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@src/store';
import { useI18n } from '@src/lib/i18n';
import { message } from '@src/ui';
import { binance_token_analysis_streaming, type BinanceTokenScreenItem } from '@src/api/agent_c';
import { syncPoints } from '@src/store/slices/userSlice';
import { store } from '@src/store';
import { ChatMessage } from './ChatMessage';
import { CoinHeader } from './CoinHeader';
import type { MessageChunk } from './Typewriter';

interface BinanceAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: BinanceTokenScreenItem;
  isLogin: boolean;
}

const BinanceAnalysisModal = memo(({ isOpen, onClose, token, isLogin }: BinanceAnalysisModalProps) => {
  const { t } = useI18n();
  const tAny = t as unknown as Record<string, any>;
  const bot = chrome.runtime.getURL('content-ui/agent/banner.png');

  const [layoutBox, setLayoutBox] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const findInShadowDOMs = (): HTMLElement | null => {
      const allElements = document.querySelectorAll('*');
      for (const el of Array.from(allElements)) {
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
      if (!el) {
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

  const [status, setStatus] = useState<'init' | 'loading' | 'generating' | 'end'>('init');
  const [loading, setLoading] = useState(false);
  const [messageChunks, setMessageChunks] = useState<MessageChunk[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamAbortController = useRef<AbortController | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStartedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (streamAbortController.current) {
      streamAbortController.current.abort();
      streamAbortController.current = null;
    }
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    setLoading(false);
    setMessageChunks([]);
    setStatus('init');
    setIsStreaming(false);
  }, []);

  const stopCreation = useCallback(() => {
    if (streamAbortController.current) {
      streamAbortController.current.abort();
      streamAbortController.current = null;
    }
    setStatus('end');
    setLoading(false);
    setIsStreaming(false);
    onClose();
  }, [onClose]);

  const handleClose = useCallback(() => {
    cleanup();
    onClose();
  }, [cleanup, onClose]);

  const startStreaming = useCallback(async () => {
    if (!isLogin) {
      message.warning(tAny?.common?.pleaseLogin ?? 'Please login first');
      onClose();
      return;
    }

    const currentPoints = store.getState().user.points;
    if (currentPoints < 10) {
      message.warning(tAny?.common?.notEnoughPoints ?? 'Points not enough');
      onClose();
      return;
    }

    const fullInput = `${t.agent?.analyze ?? 'Analyze'}\n${JSON.stringify(token)}`;

    setStatus('loading');
    setLoading(true);
    setMessageChunks([]);
    setIsStreaming(true);

    try {
      streamAbortController.current = new AbortController();

      const streamGenerator = binance_token_analysis_streaming(fullInput, undefined, streamAbortController.current);

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
            id: `chunk_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            content: newContent,
            timestamp: Date.now(),
          };

          setMessageChunks(prev => {
            if (prev.length === 0) {
              setStatus('generating');
              if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
              loadingTimeoutRef.current = setTimeout(() => setLoading(false), 500);
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
  }, [isLogin, token, cleanup, tAny, t, onClose]);

  const dispatch = useDispatch<AppDispatch>();
  useEffect(() => {
    if (isOpen) {
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        dispatch(syncPoints()).then(() => {
          setTimeout(() => {
            startStreaming();
          }, 0);
        });
      }
    } else {
      cleanup();
      hasStartedRef.current = false;
    }
  }, [isOpen, startStreaming, cleanup, dispatch]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  if (!isOpen || !layoutBox) {
    return null;
  }

  const headerTitle = (
    <CoinHeader
      symbol={token.tokenSymbol}
      type="SPOT"
      priceLoop={false}
      logo={token.imageUrl || chrome.runtime.getURL('content-ui/coins/bnb.svg')}
      tradingUrl={`https://www.binance.com/zh-CN/alpha/bsc/${token.contractAddress}`}
    />
  );

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

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          <ChatMessage
            status={status}
            stopCreation={stopCreation}
            isStreaming={isStreaming}
            tip={tAny?.agent?.analyzing ?? 'Analyzing...'}
            loading={loading}
            messages={messageChunks}
            initNode={<img src={bot} alt="" className="mx-auto h-20" />}
            className="h-[60vh]"
          />
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, layoutBox);
});

BinanceAnalysisModal.displayName = 'BinanceAnalysisModal';

export default BinanceAnalysisModal;
