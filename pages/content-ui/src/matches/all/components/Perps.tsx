import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@src/store';
import type { PositionSymbolsResponse, StreamingResponse } from '@src/api/agent_c';
import { position_risk_management_streaming, position_symbols } from '@src/api/agent_c';
import { PlatformList } from './PlatformList';
import { ChatMessage } from './ChatMessage';
import { useI18n } from '@src/lib/i18n';
import { usePageInfoUpdate } from '@src/lib/hooks/usePageInfoUpdate';
import type { MessageChunk } from './Typewriter';
import { message } from '@src/ui';
const right = chrome.runtime.getURL(`content-ui/perps/right.svg`);
const formatDate = (timestamp: number, format = 'YYYY.MM.DD HH:mm:ss') => {
  if (!timestamp) return '--------';
  const ts = timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
  const date = new Date(ts);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

const initData: PositionSymbolsResponse = {
  code: 0,
  msg: '',
  data: {
    symbols: Array.from({ length: 7 }).map(() => ({
      symbol: '',
      position_side: '',
      update_time: 0,
    })),
    total_count: 0,
  },
};

const CoinSlide = (props: {
  data: {
    update_time: number;
    symbol: string;
  };
  onClick?: (data: { update_time: number; symbol: string }) => void;
}) => {
  const right2 = chrome.runtime.getURL('content-ui/platform/right2.svg');
  const date = chrome.runtime.getURL('content-ui/perps/date.svg');

  const handleClick = () => {
    props.onClick?.(props.data);
  };

  return (
    <div className="h-[80px] rounded-[8px] bg-[#ebebeb] lg:h-[10vh]" onClick={handleClick}>
      <div className="border-b-solid flex h-[40px] items-center justify-center border-b-[1px] border-b-[#fff] bg-[#cf0] lg:h-[5vh]">
        <span className="flex w-full items-center justify-between gap-[6px] px-[14px] font-bold italic lg:justify-center">
          <img src={right2} alt="right" className="h-[12px] w-[12px]" />
          {props.data.symbol ? props.data.symbol.split('USDT')[0] : '---'}/USDT
          <img src={right}></img>
        </span>
      </div>
      <div className="flex h-[40px] items-center justify-center lg:h-[4.8vh]">
        <div className="flex h-full w-full items-center justify-start gap-2 px-[14px] text-[12px] lg:justify-center">
          <img src={date} alt="date" className="h-[18px] w-[18px]" />
          <span className="flex-1 text-center lg:flex-none">
            {props.data.update_time ? formatDate(props.data.update_time, 'YYYY.MM.DD HH:mm:ss') : '--------'}
          </span>
        </div>
      </div>
    </div>
  );
};

export const Perps = () => {
  const { locale } = useI18n();
  usePageInfoUpdate('perps', locale);
  const { t } = useI18n();
  const tAny = t as unknown as Record<string, any>;
  const selectCex = useSelector((state: RootState) => state.assets.selectCex);
  const isLogin = useSelector((state: RootState) => state.user.isLogin);
  const [positionSymbols, setPositionSymbols] = useState<PositionSymbolsResponse>(initData);
  const [status, setStatus] = useState<'init' | 'loading' | 'generating' | 'end'>('init');
  const [loading, setLoading] = useState(false);
  const [messageChunks, setMessageChunks] = useState<MessageChunk[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamAbortController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isLogin) {
      setPositionSymbols(initData);
      return;
    }

    const fetchSymbols = async () => {
      try {
        const res = await position_symbols({ cex_name: selectCex.toLowerCase() });
        if (!res.data.symbols || res.data.symbols.length === 0) {
          setPositionSymbols(initData);
        } else {
          setPositionSymbols(res);
        }
      } catch {
        setPositionSymbols(initData);
      }
    };

    fetchSymbols();
  }, [selectCex, isLogin]);

  const cleanup = useCallback(() => {
    if (streamAbortController.current) {
      streamAbortController.current.abort();
      streamAbortController.current = null;
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
  }, []);

  const startStreaming = useCallback(
    async (symbol: string) => {
      if (!isLogin) {
        message.warning(tAny?.common?.pleaseLogin ?? 'Please login first');
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
        streamAbortController.current = new AbortController();
        // `分析|symbol:SOLUSDT|binance`
        const query = `${t.agent.analyze}|symbol:${symbol}|${selectCex.toLowerCase()}`;
        const streamGenerator = position_risk_management_streaming(
          query,
          undefined,
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
              // no-op
            } else if ('event' in chunk && chunk.event === 'workflow_finished') {
              streamAbortController.current = null;
              setIsStreaming(false);
            } else if ('event' in chunk && chunk.event === 'message_end') {
              streamAbortController.current = null;
              setIsStreaming(false);
            } else {
              if ('data' in chunk) {
                if (chunk.data?.text) {
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

          if (newContent !== undefined && newContent !== null && newContent !== '') {
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
        message.error(tAny?.common?.requestFailed ?? 'Request failed, please try again');
        cleanup();
      } finally {
        streamAbortController.current = null;
        setLoading(false);
        setIsStreaming(false);
      }
    },
    [cleanup, isLogin, tAny],
  );

  const handleAnalizeCoin = useMemo(() => {
    return (data: { update_time: number; symbol: string }) => {
      if (!data.symbol) return;
      startStreaming(data.symbol);
    };
  }, [startStreaming]);

  return (
    <div className="perps-page mt-[10px] flex flex-col gap-4">
      <PlatformList showCoins={false} />

      <div className="h-auto w-full lg:h-[12vh]">
        <div
          id="date-swiper2"
          className="flex h-full flex-col gap-[10px] overflow-y-auto overflow-x-hidden scroll-smooth lg:flex-row lg:gap-[14px] lg:overflow-x-auto lg:overflow-y-hidden"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#cf0 #eee',
          }}>
          {positionSymbols.data.symbols.map((item, index) => (
            <div
              key={`${item.symbol}-${index}`}
              className={`w-full flex-shrink-0 lg:w-[200px] ${
                item.symbol ? 'cursor-pointer' : 'cursor-not-allowed'
              } overflow-hidden rounded-[4px]`}>
              <CoinSlide
                onClick={handleAnalizeCoin}
                data={{
                  update_time: item.update_time,
                  symbol: item.symbol,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <ChatMessage
        status={status}
        stopCreation={stopCreation}
        isStreaming={isStreaming}
        tip={tAny?.agent?.analyzing ?? 'Analyzing...'}
        loading={loading}
        messages={messageChunks}
        className="h-[60vh] bg-[#F2F2F2]"
      />
    </div>
  );
};
