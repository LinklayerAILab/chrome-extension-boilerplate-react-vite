import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@src/store';
import { useI18n } from '@src/lib/i18n';
import { message } from '@src/ui';
import {
  cancel_collect_c,
  get_collect_c,
  get_gain_ranking_c,
  set_collect_c,
  type GetGainRankingItem,
} from '@src/api/agent_c';

type CoinItem = GetGainRankingItem & {
  loading?: boolean;
};

export interface CoinsListProps {
  isOpen?: boolean;
  isLogin?: boolean;
  onConsultClick: (symbol: string, logo: string) => void;
  onContractClick: (symbol: string, logo: string) => void;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  tableHeaders?: {
    tokenName: string;
    currentPrice: string;
    spot: string;
    futures: string;
  };
  containerClassName?: string;
  tableHeight?: string;
  searchStr?: string; // 新增 searchStr 参数
}
const rightIcon = chrome.runtime.getURL('content-ui/agent/right.svg');
const rightIconGary = chrome.runtime.getURL('content-ui/agent/rightGary.svg');

const PAGE_SIZE = 20;
const SCROLL_THRESHOLD = 160;

const CoinImage = ({ src, symbol }: { src: string; symbol: string }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-[20px] w-[20px] items-center justify-center rounded-full border border-gray-300 bg-gray-100 text-xs font-bold">
        {symbol.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return <img src={src} alt={symbol} className="h-[20px] w-[20px] rounded-full" onError={() => setFailed(true)} />;
};

const StarButton = ({
  loading,
  collected,
  onToggle,
}: {
  loading: boolean;
  collected: boolean;
  onToggle: () => void;
}) => {
  return (
    <button
      type="button"
      className="mr-1 inline-flex h-[20px] w-[20px] items-center justify-center"
      style={{ color: collected ? 'orange' : '#ccc' }}
      onClick={onToggle}
      aria-label={collected ? 'Unfavorite' : 'Favorite'}>
      {loading ? (
        <span className="h-[14px] w-[14px] animate-spin rounded-full border-2 border-orange-300 border-t-transparent" />
      ) : collected ? (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current">
          <path d="M12 2l2.9 6.1 6.7.6-5 4.5 1.5 6.6L12 16.9 5.9 19.8l1.5-6.6-5-4.5 6.7-.6L12 2z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current stroke-[1.6]">
          <path d="M12 2l2.9 6.1 6.7.6-5 4.5 1.5 6.6L12 16.9 5.9 19.8l1.5-6.6-5-4.5 6.7-.6L12 2z" />
        </svg>
      )}
    </button>
  );
};

const ArrowButton = ({ disabled, onClick }: { disabled: boolean; onClick?: () => void }) => {
  return (
    <button
      type="button"
      className={`flex h-[22px] w-[22px] items-center justify-center rounded-full ${
        disabled ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled}>
      {disabled ? (
        <img className="h-[20px] w-[20px]" src={rightIconGary}></img>
      ) : (
        <img className="h-[20px] w-[20px]" src={rightIcon}></img>
      )}
    </button>
  );
};

export const CoinList = ({
  isOpen = true,
  isLogin: isLoginProp,
  onConsultClick,
  onContractClick,
  onSearch,
  searchPlaceholder = 'Search',
  tableHeaders,
  containerClassName = 'flex w-full flex-col gap-[14px] overflow-hidden',
  tableHeight = 'h-[68vh]',
  searchStr,
}: CoinsListProps) => {
  const { t } = useI18n();
  const tAny = t as unknown as Record<string, any>;
  const isLogin = useSelector((state: RootState) => state.user.isLogin);

  // 使用翻译后的占位符或传入的占位符
  const effectiveSearchPlaceholder =
    searchPlaceholder !== 'Search' ? searchPlaceholder : t?.agent?.searchPlaceholder || 'Search';

  // 使用传入的 isLoginProp（如果存在）或从 store 读取的值
  const effectiveIsLogin = isLoginProp !== undefined ? isLoginProp : isLogin;

  const [currentList, setCurrentList] = useState<CoinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScrollLoading, setIsScrollLoading] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const paramsRef = useRef({ page: 1, size: PAGE_SIZE });
  const gainsRef = useRef<GetGainRankingItem[]>([]);
  const collectRef = useRef<string[]>([]);
  const searchRef = useRef('');
  const timerRef = useRef<number | null>(null);
  const isScrollLoadingRef = useRef(false);

  const headers = useMemo(
    () => ({
      tokenName: tableHeaders?.tokenName || t?.agent?.tokenName || 'Token',
      currentPrice: tableHeaders?.currentPrice || t?.agent?.currentPrice || 'Price',
      spot: tableHeaders?.spot || t?.agent?.spot || 'Spot',
      futures: tableHeaders?.futures || t?.agent?.futures || 'Futures',
    }),
    [tableHeaders, t],
  );

  const normalizeSymbols = useCallback((symbols: string[] | null | undefined) => {
    return symbols ? symbols.map(item => item.toUpperCase()) : [];
  }, []);

  const applyCollect = useCallback((list: GetGainRankingItem[]) => {
    const collectSet = new Set(collectRef.current);
    return list.map(item => ({
      ...item,
      collect: collectSet.has(item.symbol.toUpperCase()),
      loading: false,
    }));
  }, []);

  const rebuildList = useCallback(
    (pageOverride?: number, searchOverride?: string) => {
      const page = pageOverride ?? paramsRef.current.page;
      const search = searchOverride ?? searchRef.current;
      const baseList = gainsRef.current;
      const filtered = search
        ? baseList.filter(item => item.symbol.toLowerCase().includes(search.toLowerCase()))
        : baseList;
      const mapped = applyCollect(filtered);
      const sorted = [...mapped].sort((a, b) => Number(b.collect) - Number(a.collect));
      const endIndex = page * paramsRef.current.size;
      const slice = sorted.slice(0, endIndex);

      setCurrentList(slice);
      setHasMoreData(slice.length < sorted.length);
    },
    [applyCollect],
  );

  const loadCollects = useCallback(async () => {
    if (!isLogin) {
      collectRef.current = [];
      return;
    }
    const res = await get_collect_c();
    collectRef.current = normalizeSymbols(res.data.symbols);
  }, [isLogin, normalizeSymbols]);

  const loadRanking = useCallback(async () => {
    const res = await get_gain_ranking_c();
    gainsRef.current = res.data.res || [];
  }, []);

  const refreshList = useCallback(async () => {
    // 只在侧边栏打开时才执行轮询刷新
    if (!isOpen) {
      return;
    }
    if (isScrollLoadingRef.current || searchRef.current) {
      return;
    }
    try {
      if (effectiveIsLogin) {
        await loadCollects();
      }
      await loadRanking();
      rebuildList();
    } catch (error) {
      message.warning('Data refresh failed');
    }
  }, [isOpen, effectiveIsLogin, isScrollLoadingRef, searchRef, loadCollects, loadRanking, rebuildList]);

  const startTimer = useCallback(() => {
    // 只在侧边栏打开且已登录时才启动轮询
    if (!isOpen || !effectiveIsLogin) {
      return;
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }
    if (searchRef.current) {
      return;
    }
    timerRef.current = window.setInterval(() => {
      refreshList();
    }, 8000);
  }, [isOpen, effectiveIsLogin, refreshList, searchStr]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || isScrollLoadingRef.current || loading) {
      return;
    }
    if (el.scrollTop + el.clientHeight < el.scrollHeight - SCROLL_THRESHOLD) {
      return;
    }
    if (!hasMoreData || searchRef.current) {
      return;
    }

    isScrollLoadingRef.current = true;
    setIsScrollLoading(true);
    paramsRef.current.page += 1;
    rebuildList(paramsRef.current.page);
    window.setTimeout(() => {
      isScrollLoadingRef.current = false;
      setIsScrollLoading(false);
    }, 100);
  }, [hasMoreData, loading, rebuildList, searchStr]);

  const handleCollect = useCallback(
    async (symbol: string, collect: boolean) => {
      if (!isLogin) {
        message.info(tAny?.common?.pleaseLogin || 'Please login first');
        return;
      }
      setCurrentList(prev => prev.map(item => (item.symbol === symbol ? { ...item, loading: true } : item)));
      try {
        if (collect) {
          await set_collect_c(symbol);
        } else {
          await cancel_collect_c(symbol);
        }
        await loadCollects();
        rebuildList();
      } catch (error) {
        message.error(tAny?.common?.requestFailed || 'Update failed');
      } finally {
        setCurrentList(prev => prev.map(item => (item.symbol === symbol ? { ...item, loading: false } : item)));
      }
    },
    [isLogin, loadCollects, rebuildList],
  );

  useEffect(() => {
    // 只在侧边栏打开时才初始化数据
    if (!isOpen) {
      return;
    }

    const init = async () => {
      setLoading(true);
      paramsRef.current.page = 1;
      try {
        if (effectiveIsLogin) {
          await loadCollects();
        }
        await loadRanking();
        rebuildList(1, searchRef.current);
      } finally {
        setLoading(false);
      }
    };

    init();
    return () => {
      stopTimer();
    };
  }, [isOpen, effectiveIsLogin, loadCollects, loadRanking, rebuildList, stopTimer]);

  useEffect(() => {
    // 只在侧边栏打开且已登录时才启动定时器
    if (isOpen && effectiveIsLogin) {
      startTimer();
      return () => {
        stopTimer();
      };
    } else {
      // 如果侧边栏关闭或未登录，确保停止定时器
      stopTimer();
    }
  }, [isOpen, effectiveIsLogin, startTimer, stopTimer]);

  const handleSearchChange = (value: string) => {
    paramsRef.current.page = 1;
    searchRef.current = value;
    rebuildList(1, value);
    if (value) {
      stopTimer();
    } else {
      startTimer();
    }
    onSearch?.(value);
  };

  // 监听外部传入的 searchStr 参数变化
  useEffect(() => {
    if (searchStr !== undefined && searchStr !== searchRef.current) {
      handleSearchChange(searchStr);
    }
  }, [searchStr]);

  const skeletonRows = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, index) => (
        <div key={index} className="mb-[1vh] flex animate-pulse items-center space-x-4">
          <div className="h-[30px] w-[30px] rounded-full bg-gray-200" />
          <div className="h-[30px] flex-1 rounded bg-gray-200" />
          <div className="h-[30px] flex-1 rounded bg-gray-200" />
          <div className="h-[30px] flex-1 rounded bg-gray-200" />
          <div className="h-[30px] flex-1 rounded-full bg-gray-200" />
        </div>
      )),
    [],
  );

  const formatName = useCallback((symbol: string) => symbol.split('USDT')[0], []);
  const priceColor = useCallback((gain: number) => {
    if (gain > 0) {
      return 'text-[#8AA90B]';
    }
    if (gain < 0) {
      return 'text-[#FF1616]';
    }
    return 'text-black';
  }, []);

  return (
    <div className={`${containerClassName} relative rounded-[8px] bg-[#F1F1F1]`}>
      {/* <div className="flex h-[42px] items-center rounded-[8px] border border-black bg-white px-[6px] absolute top-[-15vh]">
        <input
          value={searchStr}
          onChange={(event) => handleSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="flex-1 bg-transparent text-[16px] outline-none"
        />
      </div> */}

      <div className="relative rounded-[8px] bg-white">
        <div className="sticky left-0 right-0 top-0 flex h-[40px] items-center rounded-t-[8px] bg-[#cf0] px-[10px] text-[14px] font-bold text-[#666]">
          <div className="flex flex-1 items-center justify-start">{headers.tokenName}</div>
          <div className="flex flex-1 items-center justify-start">{headers.currentPrice}</div>
          <div className="flex w-[60px] items-center justify-center">{headers.spot}</div>
          <div className="flex w-[60px] items-center justify-center">{headers.futures}</div>
        </div>

        <div
          ref={scrollRef}
          className={`flex-1 overflow-y-auto overflow-x-hidden ${tableHeight} rounded-[8px]`}
          onScroll={handleScroll}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#ccc #f1f5f9', // Firefox: thumb color, track color (slate-300, slate-100)
          }}>
          {loading ? (
            <div className="space-y-4 p-4">{skeletonRows}</div>
          ) : (
            <table className="w-full text-[14px]" cellPadding={0} cellSpacing={0}>
              <tbody>
                {currentList.map((item, index) => (
                  <tr
                    key={item.symbol}
                    className="flex pl-[10px]"
                    style={{ backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F3F3F3' }}>
                    <td className="flex flex-1 items-center">
                      <div className="flex h-[50px] items-center">
                        {isLogin && (
                          <StarButton
                            loading={Boolean(item.loading)}
                            collected={Boolean(item.collect)}
                            onToggle={() => handleCollect(item.symbol, !item.collect)}
                          />
                        )}
                        <div className="flex items-center gap-[6px]" title={item.symbol}>
                          <CoinImage src={`https://cdn.linklayer.ai/coinimages/${item.image}`} symbol={item.symbol} />
                          <span className="text-[12px]">{formatName(item.symbol)}</span>
                        </div>
                      </div>
                    </td>
                    <td className={`flex flex-1 items-center justify-start ${priceColor(item.gain)}`}>
                      <div className="flex h-[50px] items-center justify-start text-[12px]">
                        $ {String(item.price).substring(0, 8)}
                      </div>
                    </td>
                    <td className="flex w-[60px] items-center justify-center">
                      <div className="flex h-[50px] items-center justify-center">
                        <ArrowButton
                          disabled={!(item.symbol_type === 0 || item.symbol_type === 2)}
                          onClick={() => onConsultClick(item.symbol, item.image)}
                        />
                      </div>
                    </td>
                    <td className="flex w-[60px] items-center justify-center">
                      <div className="flex h-[50px] items-center justify-center">
                        <ArrowButton
                          disabled={!(item.symbol_type === 1 || item.symbol_type === 2)}
                          onClick={() => onContractClick(item.symbol, item.image)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !searchStr && (
            <div className="flex items-center justify-center py-4 text-[14px] text-gray-500">
              {isScrollLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#8AA90B]" />
                  <span>{tAny?.common?.loading || 'Loading...'}</span>
                </div>
              ) : hasMoreData ? (
                <span>{tAny?.common?.scrollToLoadMore || 'Scroll to load more'}</span>
              ) : (
                <span>{tAny?.common?.noMoreData || 'No more data'}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoinList;
