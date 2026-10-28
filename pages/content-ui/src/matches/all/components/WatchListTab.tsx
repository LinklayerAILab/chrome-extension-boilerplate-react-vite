import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@src/store';
import { useI18n } from '@src/lib/i18n';
import { formatPrice, formatPriceFull, gainColor, normalizeColor, trafficLightColor } from '@src/lib/display';
import { message } from '@src/ui';
import {
  getDashboard,
  getLiquidityChange,
  getPrices,
  removeFromWatchlist,
  type GuardColor,
  type GuardLiquidityChangeResponse,
  type GuardPriceItem,
  type GuardWatchlistItem,
} from '@src/api/guard';
import { TokenIcon } from './TokenIcon';
import { CoinAnalysisDialog } from './CoinAnalysisDialog';
import { refreshGuardEntitlement, selectEntitlement } from '@src/store/slices/guardSlice';

const DASHBOARD_POLL_INTERVAL_MS = 60_000;
const PRICE_POLL_INTERVAL_MS = 15_000;

/** 标题旁的两个小交易所图标（与 bodyguard /dashboard 一致） */
const EXCHANGE_ICONS = {
  binance: chrome.runtime.getURL('content-ui/guard/binance.svg'),
  pancake: chrome.runtime.getURL('content-ui/guard/cake.png'),
};

/** 灯球配色（移植 bodyguard tailwind brand token：green/yellow/red + stale 灰） */
const LIGHT_BALL_COLORS: Record<string, { base: string; light: string; dark: string; border: string }> = {
  green: { base: '#51FF6E', light: '#A7FFD5', dark: '#07C369', border: '#2EC94C' },
  yellow: { base: '#E1FF00', light: '#EEFF70', dark: '#C5CC05', border: '#B19F00' },
  red: { base: '#FF6063', light: '#FFACB4', dark: '#D9474C', border: '#F44A40' },
  stale: { base: '#E1FF00', light: '#EEFF70', dark: '#C5CC05', border: '#9CA3AF' },
};

const healthColors = (color?: GuardColor | string) =>
  LIGHT_BALL_COLORS[(color || 'stale').toLowerCase()] ?? LIGHT_BALL_COLORS.stale;

/** 40px 红黄绿健康灯球：径向渐变 + 内阴影模拟球体 */
const lightBallStyle = (color?: GuardColor | string): CSSProperties => {
  const c = healthColors(color);
  return {
    background: `linear-gradient(to bottom, ${c.light} 21%, ${c.base} 100%)`,
    border: '2px solid #000',
    boxShadow: `inset 0 3px 3px #fff, inset 0 -3px 3px ${c.dark}`,
  };
};

interface WatchListTabProps {
  /** 侧边栏是否打开（关闭时暂停轮询） */
  isOpen: boolean;
}

/**
 * Watch List tab：关注列表卡片（健康灯球 + 价格轮询 + 流动性变化，删除直接移除）。
 * 移植自 bodyguard-app /dashboard（60s 看板轮询 + 15s 价格轮询）。
 */
export const WatchListTab = memo(({ isOpen }: WatchListTabProps) => {
  const { t, locale } = useI18n();
  const tAny = t as unknown as Record<string, any>;
  const dispatch = useDispatch<AppDispatch>();
  const entitlement = useSelector(selectEntitlement);
  const isLogin = useSelector((state: RootState) => state.user.isLogin);

  const [items, setItems] = useState<GuardWatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [priceMap, setPriceMap] = useState<Record<string, GuardPriceItem>>({});
  const [liquidityMap, setLiquidityMap] = useState<GuardLiquidityChangeResponse>({});
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [agentItem, setAgentItem] = useState<GuardWatchlistItem | null>(null);

  const itemsRef = useRef<GuardWatchlistItem[]>([]);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await getDashboard();
      setItems(res.data?.items || []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : tAny?.common?.requestFailed || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [tAny]);

  /** 流动性变化随看板一起刷新 */
  const loadLiquidity = useCallback(async () => {
    const tokenIds = itemsRef.current.map(item => item.token.token_id).filter(Boolean);
    if (tokenIds.length === 0) {
      setLiquidityMap({});
      return;
    }
    try {
      const res = await getLiquidityChange(tokenIds);
      setLiquidityMap(res.data || {});
    } catch {
      // 流动性为辅助信息，失败静默
    }
  }, []);

  // 挂载加载 + 60s 看板轮询
  useEffect(() => {
    loadDashboard();
    if (!isOpen) return;
    const timer = window.setInterval(loadDashboard, DASHBOARD_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isOpen, loadDashboard]);

  // 列表变化后刷新流动性
  useEffect(() => {
    loadLiquidity();
  }, [items, loadLiquidity]);

  // 价格轮询（15s），仅侧边栏打开时执行；失败静默等下一轮
  useEffect(() => {
    if (!isOpen) return;

    const fetchPrices = async () => {
      const symbols = [...new Set(itemsRef.current.map(item => item.token.cex_symbol).filter(Boolean))];
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
  }, [isOpen, items]);

  /** 删除关注（乐观移除，失败回滚） */
  const handleDelete = useCallback(
    async (id: number) => {
      setDeletingId(id);
      const snapshot = itemsRef.current;
      setItems(prev => prev.filter(item => item.id !== id));
      try {
        await removeFromWatchlist(id);
        // 删除后关注位用量变化，立即刷新权益（否则横幅要等 60 秒轮询）
        void dispatch(refreshGuardEntitlement());
      } catch (error) {
        setItems(snapshot);
        message.error(error instanceof Error ? error.message : tAny?.common?.requestFailed || 'Request failed');
      } finally {
        setDeletingId(null);
      }
    },
    [dispatch, tAny],
  );

  /**
   * Guard 套餐赠送服务：分析不校验/扣减积分，仅要求登录。
   * 与 bodyguard AgentStream 一致，试用/订阅过期时不发请求，先提示再拦截。
   */
  const handleAgent = useCallback(
    async (item: GuardWatchlistItem) => {
      if (!isLogin) {
        message.warning(tAny?.common?.pleaseLogin || 'Please login first');
        return;
      }
      // refreshGuardEntitlement 失败会 reject（不再吞成 null），这里必须兜住，
      // 否则会变成未捕获的 Promise rejection。失败时回退到 Redux 里的快照，
      // 仍由下方统一判断试用/订阅状态。
      const latest = await dispatch(refreshGuardEntitlement())
        .unwrap()
        .catch(() => null);
      const status = latest?.status ?? entitlement?.status;
      if (status === 'trial_expired' || status === 'paid_expired') {
        message.error(
          status === 'paid_expired'
            ? tAny?.guard?.paidExpiredToast || 'Subscription expired'
            : tAny?.guard?.trialExpiredToast || 'Trial expired',
        );
        return;
      }
      setAgentItem(item);
    },
    [dispatch, entitlement?.status, isLogin, tAny],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* 列表区固定高度 + 内部滚动：卡片高度固定，超出部分在卡片区域内滚动 */}
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#ccc #f1f5f9' }}>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex animate-pulse gap-2 rounded-[5px] border border-black bg-white p-2">
                <div className="flex w-[81px] flex-col items-center gap-2 rounded-[5px] border border-black p-2">
                  <div className="h-[40px] w-[40px] rounded-full bg-gray-200" />
                  <div className="h-[40px] w-[40px] rounded-full bg-gray-200" />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="h-[29px] rounded-[2px] bg-gray-200" />
                  <div className="h-[29px] rounded-[2px] bg-gray-200" />
                  <div className="h-[29px] rounded-[2px] bg-gray-200" />
                  <div className="h-[26px] rounded-[5px] bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[8px] border border-black bg-white py-10 text-[12px] text-gray-500">
            <span>{tAny?.common?.noData || 'No data'}</span>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => {
              const token = item.token;
              const price = token.cex_symbol ? priceMap[token.cex_symbol] : undefined;
              const liquidity = liquidityMap[token.token_id]?.cex;
              const depthPct = liquidity?.depth_change_pct;
              // 徽章配色跟随健康灯（bodyguard /dashboard 逻辑），与涨跌符号无关
              const lightColor = trafficLightColor(normalizeColor(item.health?.color));
              const arrow = depthPct != null && depthPct > 0 ? '↑' : depthPct != null && depthPct < 0 ? '↓' : '';
              const pctText = depthPct == null || Number.isNaN(depthPct) ? '—' : `${depthPct.toFixed(2)}%`;
              return (
                <div key={item.id} className="rounded-[5px] border border-black bg-white p-2">
                  <div className="flex gap-2">
                    {/* 左：图标 + 健康灯球 */}
                    <div className="flex w-[81px] shrink-0 flex-col items-center justify-evenly gap-1.5 rounded-[5px] border border-black bg-white p-2">
                      <TokenIcon src={token.image_url} symbol={token.symbol} size={40} bordered />
                      <div className="h-[40px] w-[40px] rounded-full" style={lightBallStyle(item.health?.color)} />
                    </div>

                    {/* 右：Symbol / Price / Liquidity / 操作 */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex w-full items-center justify-between rounded-[2px] bg-[#F3F3F3] px-2.5 py-1.5">
                        <span className="flex items-center gap-1" title={token.name || token.symbol}>
                          <span className="truncate text-[13px] font-bold">{token.symbol}</span>
                          {/* 两个小交易所图标（Binance / PancakeSwap），与 bodyguard /dashboard 一致 */}
                          <img src={EXCHANGE_ICONS.binance} alt="Binance" className="h-3.5 w-3.5" />
                          <img src={EXCHANGE_ICONS.pancake} alt="PancakeSwap" className="h-3.5 w-3.5" />
                        </span>
                      </div>

                      <div className="flex items-center justify-between overflow-hidden rounded-[2px] bg-[#F3F3F3] px-2.5 py-1.5">
                        <span className="text-xs font-semibold text-black">{tAny?.guard?.price || 'Price'}</span>
                        <span
                          className="text-xs font-semibold"
                          style={{ color: gainColor(price?.gain) }}
                          title={formatPriceFull(price?.price, locale)}>
                          {formatPrice(price?.price, locale)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between rounded-[2px] bg-[#F3F3F3] px-2.5 py-1.5">
                        <span className="text-xs font-semibold text-black">
                          {tAny?.guard?.liquidity || 'Liquidity'}
                        </span>
                        <span
                          className="inline-block max-w-[60%] truncate rounded-full border px-1.5 py-0.5 text-xs font-semibold"
                          style={{ color: lightColor, borderColor: lightColor }}>
                          {arrow} {pctText} ({tAny?.common?.time5m || '5m'})
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {token.contract_address && (
                          <a
                            href={`https://bscscan.com/token/${token.contract_address}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 rounded-[5px] border border-black bg-white px-2 py-1 text-center text-xs font-semibold text-black hover:bg-[#F3F3F3]">
                            {tAny?.guard?.explorer || 'BscScan'}
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleAgent(item)}
                          className="flex-1 rounded-[5px] border border-black bg-white px-2 py-1 text-center text-xs font-semibold text-black hover:bg-[#F3F3F3]">
                          {tAny?.common?.agent || 'Agent'}
                        </button>
                        <button
                          type="button"
                          aria-label="Delete"
                          disabled={deletingId === item.id}
                          onClick={() => handleDelete(item.id)}
                          className="flex items-center justify-center rounded-[5px] border border-black bg-white px-2 py-1 text-black hover:bg-red-50 hover:text-red-500 disabled:opacity-60">
                          <svg className="h-[14px] w-[14px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {agentItem && (
        <CoinAnalysisDialog
          isOpen
          onClose={() => setAgentItem(null)}
          tokenId={agentItem.token.token_id}
          symbol={agentItem.token.symbol}
          logo={agentItem.token.image_url}
          cexSymbol={agentItem.token.cex_symbol}
          price={agentItem.token.cex_symbol ? priceMap[agentItem.token.cex_symbol]?.price : null}
          liquidity={liquidityMap[agentItem.token.token_id]}
        />
      )}
    </div>
  );
});

WatchListTab.displayName = 'WatchListTab';
