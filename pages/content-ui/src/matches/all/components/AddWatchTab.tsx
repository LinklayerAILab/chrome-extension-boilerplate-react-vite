import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@src/store';
import { useI18n } from '@src/lib/i18n';
import { Input, message } from '@src/ui';
import {
  addToWatchlist,
  getPrices,
  removeFromWatchlist,
  searchTokens,
  type GuardPriceItem,
  type GuardToken,
} from '@src/api/guard';
import { shouldPromptGuardPush } from '@src/lib/guardPush';
import { selectIsPushMuted } from '@src/store/slices/guardSlice';
import { formatPrice, formatPriceFull, gainColor } from '@src/lib/display';
import { TokenIcon } from './TokenIcon';
import { PushPromptDialog } from './PushPromptDialog';

const PAGE_SIZE = 20;
const SCROLL_THRESHOLD = 160;
const SEARCH_DEBOUNCE_MS = 300;
const PRICE_POLL_INTERVAL_MS = 10_000;

/**
 * 按 token_id 去重。
 * 服务端是 offset 分页：两次请求之间底层数据顺序变动时，下一页可能返回上一页已有的行，
 * 直接拼接会让同一 token_id 在列表里出现两次（React 重复 key 警告 + 重复渲染）。
 * 参考 bodyguard-app add/page.tsx 的 seen 去重。
 */
const dedupeByTokenId = (items: WatchToken[]): WatchToken[] => {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.token_id)) return false;
    seen.add(item.token_id);
    return true;
  });
};

type WatchToken = GuardToken & { loading?: boolean };

interface AddWatchTabProps {
  /** 侧边栏是否打开（关闭时暂停轮询） */
  isOpen: boolean;
}

/** 推送授权引导的判据见 @src/lib/guardPush（基于 /v1/guard/entitlement） */

/**
 * Add Watch tab：搜索代币 + 无限滚动列表 + 价格轮询 + 关注/取关（乐观更新）。
 * 移植自 bodyguard-app /add，分页由服务端 offset 承担（bodyguard 用 React Query useInfiniteQuery）。
 */
export const AddWatchTab = memo(({ isOpen }: AddWatchTabProps) => {
  const { t, locale } = useI18n();
  const tAny = t as unknown as Record<string, any>;
  const dispatch = useDispatch<AppDispatch>();
  const isLogin = useSelector((state: RootState) => state.user?.isLogin ?? false);
  /** 用户已在设置面板/横幅里静音推送时，不再引导授权 */
  const isPushMuted = useSelector(selectIsPushMuted);

  const [searchStr, setSearchStr] = useState('');
  const [list, setList] = useState<WatchToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScrollLoading, setIsScrollLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [priceMap, setPriceMap] = useState<Record<string, GuardPriceItem>>({});
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const keywordRef = useRef('');
  const fetchingRef = useRef(false);
  // 请求代际：每次发起新请求自增，旧请求返回时代际不符则丢弃，防过期响应覆盖新结果
  const reqGenRef = useRef(0);
  const listRef = useRef<WatchToken[]>([]);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  useEffect(() => {
    listRef.current = list;
  }, [list]);

  /**
   * 加载一页；reset 时回到第一页（keyword 用服务端过滤）。
   * 搜索 reset 不被 fetchingRef 拦截（新搜索直接取代在飞请求）；
   * 滚动加载与在飞请求互斥；await 返回后代际不符的过期响应整体丢弃，
   * 避免旧关键词/旧 offset 的结果拼接进新列表。
   */
  const loadTokens = useCallback(
    async (reset: boolean, keyword: string) => {
      if (!reset && fetchingRef.current) return;
      const gen = ++reqGenRef.current;
      fetchingRef.current = true;
      const offset = reset ? 0 : offsetRef.current;
      if (reset) {
        setLoading(true);
      } else {
        setIsScrollLoading(true);
      }
      try {
        const res = await searchTokens({
          keyword: keyword || undefined,
          limit: PAGE_SIZE,
          offset,
        });
        if (gen !== reqGenRef.current) return;
        const items = (res.data?.items || []).map(item => ({ ...item }));
        const total = res.data?.total ?? 0;
        // 滚动加载时与已加载列表合并后去重，避免 offset 分页漂移导致重复 token_id
        setList(prev => dedupeByTokenId(reset ? items : [...prev, ...items]));
        offsetRef.current = offset + items.length;
        setHasMore(items.length > 0 && offset + items.length < total);
      } catch (error) {
        if (gen !== reqGenRef.current) return;
        message.error(error instanceof Error ? error.message : tAny?.common?.requestFailed || 'Request failed');
        if (reset) {
          setList([]);
          setHasMore(false);
        }
      } finally {
        // 仅最新请求有权复位共享状态，避免旧请求的 finally 干扰新请求
        if (gen === reqGenRef.current) {
          fetchingRef.current = false;
          setLoading(false);
          setIsScrollLoading(false);
        }
      }
    },
    [tAny],
  );

  // 首次加载
  useEffect(() => {
    loadTokens(true, '');
  }, [loadTokens]);

  // 搜索防抖：输入变化后重新拉第一页
  useEffect(() => {
    if (searchStr === keywordRef.current) return;
    const timer = window.setTimeout(() => {
      keywordRef.current = searchStr;
      loadTokens(true, searchStr);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchStr, loadTokens]);

  // 价格轮询（10s），仅侧边栏打开时执行；失败静默等下一轮
  useEffect(() => {
    if (!isOpen) return;

    const fetchPrices = async () => {
      const symbols = [...new Set(listRef.current.map(item => item.cex_symbol).filter(Boolean))];
      if (symbols.length === 0) return;
      try {
        const res = await getPrices(symbols);
        const nextMap: Record<string, GuardPriceItem> = {};
        (res.data?.items || []).forEach(item => {
          nextMap[item.cex_symbol] = item;
        });
        setPriceMap(nextMap);
      } catch {
        // 轮询失败静默，下一轮重试
      }
    };

    fetchPrices();
    const timer = window.setInterval(fetchPrices, PRICE_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isOpen, list]);

  // 滚动触底加载下一页
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || fetchingRef.current || loading) return;
    if (el.scrollTop + el.clientHeight < el.scrollHeight - SCROLL_THRESHOLD) return;
    if (!hasMore) return;
    loadTokens(false, keywordRef.current);
  }, [hasMore, loading, loadTokens]);

  /** 关注/取关，成功后本地更新 is_watched / watchlist_id（乐观联动 Watch List） */
  const handleToggleWatch = useCallback(
    async (token: WatchToken) => {
      if (!isLogin) {
        message.warning(tAny?.common?.pleaseLogin || 'Please login first');
        return;
      }
      setList(prev => prev.map(item => (item.token_id === token.token_id ? { ...item, loading: true } : item)));
      try {
        if (token.is_watched) {
          if (token.watchlist_id !== undefined && token.watchlist_id !== null) {
            await removeFromWatchlist(token.watchlist_id);
          }
          setList(prev =>
            prev.map(item =>
              item.token_id === token.token_id ? { ...item, is_watched: false, watchlist_id: null } : item,
            ),
          );
        } else {
          const res = await addToWatchlist({ token_id: token.token_id });
          setList(prev =>
            prev.map(item =>
              item.token_id === token.token_id ? { ...item, is_watched: true, watchlist_id: res.data?.id } : item,
            ),
          );
          // 添加关注后：没有本地授权/订阅记录就直接引导授权（不查后端权益）
          // 已静音推送（设置面板长期静音 / 横幅 24h 静音）时不再打扰
          if (!isPushMuted && shouldPromptGuardPush()) {
            setShowPushPrompt(true);
          }
        }
      } catch (error) {
        message.error(error instanceof Error ? error.message : tAny?.common?.requestFailed || 'Request failed');
      } finally {
        setList(prev => prev.map(item => (item.token_id === token.token_id ? { ...item, loading: false } : item)));
      }
    },
    [dispatch, isLogin, isPushMuted, tAny],
  );

  const skeletonRows = renderSkeletonRows();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="shrink-0">
        <Input
          search
          allowClear
          value={searchStr}
          onChange={e => setSearchStr(e.target.value)}
          placeholder={tAny?.guard?.searchPlaceholder || 'Search token name / symbol / contract'}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[6.5px] border-[1.5px] border-black bg-white">
        <div className="flex h-[48px] shrink-0 items-center justify-between bg-[#CCFF00] px-5 py-3.5 text-xs font-medium text-[#7e9d00]">
          <div className="flex flex-1 items-center justify-start">{tAny?.guard?.name || 'Name'}</div>
          <div className="flex flex-1 items-center justify-start">{tAny?.guard?.price || 'Price'}</div>
          <div className="flex w-[60px] items-center justify-center">{tAny?.guard?.follow || 'Follow'}</div>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
          onScroll={handleScroll}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#ccc #f1f5f9',
          }}>
          {loading ? (
            <div className="space-y-4 p-4">{skeletonRows}</div>
          ) : list.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-[14px] text-gray-500">
              {tAny?.common?.noData || 'No data'}
            </div>
          ) : (
            <table className="w-full text-[14px]" cellPadding={0} cellSpacing={0}>
              <tbody>
                {list.map((item, index) => {
                  const price = item.cex_symbol ? priceMap[item.cex_symbol] : undefined;
                  return (
                    <tr
                      key={item.token_id}
                      className="flex h-14 items-center justify-between px-5"
                      style={{ backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F3F3F3' }}>
                      <td className="flex flex-1 items-center">
                        <div className="flex flex-1 items-center gap-1.5" title={item.symbol}>
                          <TokenIcon src={item.image_url} symbol={item.symbol} size={30} />
                          <span className="text-[13px] font-semibold">{item.symbol}</span>
                        </div>
                      </td>
                      <td
                        className="flex flex-1 items-center justify-start text-xs font-semibold"
                        style={{ color: gainColor(price?.gain) }}
                        title={formatPriceFull(price?.price, locale)}>
                        <div className="flex items-center justify-start">{formatPrice(price?.price, locale)}</div>
                      </td>
                      <td className="flex items-center justify-center">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            aria-label={item.is_watched ? 'Unfollow' : 'Follow'}
                            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-black text-[18px] font-semibold leading-none transition-opacity hover:opacity-80 ${
                              item.is_watched ? 'bg-[#CCFF00] text-black' : 'bg-[#CCFF00] text-black'
                            }`}
                            disabled={Boolean(item.loading)}
                            onClick={() => handleToggleWatch(item)}>
                            {item.loading ? (
                              <span className="h-[12px] w-[12px] animate-spin rounded-full border-2 border-gray-400 border-t-black" />
                            ) : item.is_watched ? (
                              '−'
                            ) : (
                              '+'
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!loading && list.length > 0 && (
            <div className="flex items-center justify-center py-4 text-[14px] text-gray-500">
              {isScrollLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#8AA90B]" />
                  <span>{tAny?.common?.loading || 'Loading...'}</span>
                </div>
              ) : hasMore ? (
                <span>{tAny?.common?.scrollToLoadMore || 'Scroll to load more'}</span>
              ) : (
                <span>{tAny?.common?.noMoreData || 'No more data'}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <PushPromptDialog isOpen={showPushPrompt} onClose={() => setShowPushPrompt(false)} />
    </div>
  );
});

AddWatchTab.displayName = 'AddWatchTab';

/** 骨架屏行（固定 12 行，避免列表加载时跳动） */
function renderSkeletonRows() {
  return Array.from({ length: 12 }).map((_, index) => (
    <div key={index} className="mb-[1vh] flex animate-pulse items-center space-x-4">
      <div className="h-[24px] w-[24px] rounded-full bg-gray-200" />
      <div className="h-[24px] flex-1 rounded bg-gray-200" />
      <div className="h-[24px] w-[60px] rounded bg-gray-200" />
    </div>
  ));
}
