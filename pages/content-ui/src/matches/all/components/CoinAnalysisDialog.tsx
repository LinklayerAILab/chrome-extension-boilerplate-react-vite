import { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@src/store';
import { useI18n } from '@src/lib/i18n';
import { message } from '@src/ui';
import { formatChangePct } from '@src/lib/display';
import {
  coinAnalysisStream,
  type GuardLiquidityChangeItem,
  GUARD_ANALYSIS_DISABLED,
  GUARD_TRIAL_EXPIRED,
  GUARD_SUBSCRIPTION_EXPIRED,
} from '@src/api/guard';
import Dialog from './Dialog';
import { ReportStream } from './ReportStream';

const lightIcon = chrome.runtime.getURL('content-ui/coinHeader/light.svg');
const goIcon = chrome.runtime.getURL('content-ui/coinHeader/go.svg');

interface CoinAnalysisDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 代币标识（/v1/guard/dify/coin-analysis 的 token_id） */
  tokenId: string;
  /** 代币 symbol（标题） */
  symbol: string;
  /** 代币 logo（image_url），为空时显示 symbol 前两位 */
  logo?: string;
  /** CEX symbol（构造 Binance 交易链接） */
  cexSymbol?: string;
  /** 当前价格（WatchListTab 的 /prices 轮询结果） */
  price?: number | null;
  /** 流动性变化（CEX / DEX 5m 深度），来自 /v1/guard/liquidity_change */
  liquidity?: GuardLiquidityChangeItem;
}

/** 后端错误码 → 本地化提示键（与 bodyguard AgentStream 的过期拦截语义一致） */
const ERROR_MESSAGE_KEY: Record<number, string> = {
  [GUARD_TRIAL_EXPIRED]: 'trialExpiredToast',
  [GUARD_SUBSCRIPTION_EXPIRED]: 'paidExpiredToast',
  [GUARD_ANALYSIS_DISABLED]: 'analysisDisabled',
};

/** 价格展示：固定 $，按量级取小数位（与参考页一致） */
const formatDialogPrice = (price?: number | null): string => {
  if (price === undefined || price === null || Number.isNaN(price)) return '—';
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  if (price > 0) return `$${price.toFixed(6)}`;
  return '$0';
};

/** 流动性涨跌色（与 bodyguard /tokens/[tokenId] 一致：≥0 荧光绿，<0 橙） */
const liquidityColor = (pct?: number | null): string => ((pct ?? -1) >= 0 ? '#CCFF00' : '#FFBE34');

/**
 * 单币 AI 分析弹窗，UI 对齐 ll-agent `app/crypto-analysis/[symbol]/page.tsx`：
 * 顶部黑色代币卡（logo + Price 行 + SPOT / TRADING 两个按钮），下方 markdown 流式分析。
 * 扩展内没有路由，用 Dialog 承载；点击其它币切换分析目标不在本弹窗范围内。
 */
export const CoinAnalysisDialog = memo(
  ({ isOpen, onClose, tokenId, symbol, logo, cexSymbol, price, liquidity }: CoinAnalysisDialogProps) => {
    const { t } = useI18n();
    const tAny = t as unknown as Record<string, any>;
    const address = useSelector((state: RootState) => state.user.address);

    const createStream = useCallback(
      (signal: AbortSignal) => coinAnalysisStream(tokenId, signal, address),
      [tokenId, address],
    );

    const handleError = useCallback(
      (errorMessage: string, code?: number) => {
        const key = code !== undefined ? ERROR_MESSAGE_KEY[code] : undefined;
        const localized = key ? (tAny?.guard?.[key] as string | undefined) : undefined;
        message.error(localized || errorMessage);
      },
      [tAny],
    );

    const handleToTrading = useCallback(() => {
      const base = (cexSymbol || symbol).replace(/USDT$/i, '');
      window.open(`https://www.binance.com/en/trade/${base}_USDT?type=spot`, '_blank', 'noopener');
    }, [cexSymbol, symbol]);

    return (
      <Dialog isOpen={isOpen} onClose={onClose}>
        <div className="relative flex max-h-[85vh] flex-col gap-3">
          <button
            type="button"
            aria-label={tAny?.common?.close || 'Close'}
            onClick={onClose}
            className="absolute right-2 top-2 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/90 text-[16px] leading-none text-black hover:bg-white">
            &times;
          </button>

          {/* 顶部黑色代币卡（参考页 crypto-analysis 的 bg-black 卡片） */}
          <div className="flex items-center gap-4 rounded-[8px] border-2 border-black bg-black p-[20px] text-white">
            <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-white text-[24px] font-bold text-black">
              {logo ? (
                <img src={logo} alt={symbol} className="h-[60px] w-[60px] rounded-full object-cover" />
              ) : (
                symbol.slice(0, 2).toUpperCase()
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
              <div className="flex h-[38px] items-center justify-between rounded-[4px] bg-[#1C1C1C] px-[14px] text-[14px]">
                <span>{tAny?.common?.price || 'Price'}</span>
                <span className="font-bold text-[#cf0]">{formatDialogPrice(price)}</span>
              </div>

              <div className="flex items-center gap-[2px] text-[14px]">
                <div className="flex h-[38px] w-[40%] items-center justify-center rounded-[4px] bg-[#1C1C1C] px-[14px]">
                  {tAny?.common?.spot || 'SPOT'}
                  <img src={lightIcon} alt="" className="ml-[4px]" />
                </div>
                <button
                  type="button"
                  onClick={handleToTrading}
                  className="flex h-[38px] flex-1 cursor-pointer items-center justify-center rounded-[4px] bg-[#1C1C1C] px-[14px] hover:opacity-80">
                  {tAny?.common?.trading || 'TRADING'}
                  <img src={goIcon} alt="" className="ml-[4px]" />
                </button>
              </div>
            </div>
          </div>

          {/* 流动性连体卡：左 DEX / 右 CEX（参考 bodyguard /tokens/[tokenId] 的连体卡） */}
          <div className="relative flex rounded-lg border-2 border-black bg-white">
            {[tAny?.guard?.dexLiquidity || 'DEX Liquidity', tAny?.guard?.cexLiquidity || 'CEX Liquidity'].map(
              (label, index) => {
                const pct = index === 0 ? liquidity?.dex?.depth_change_pct : liquidity?.cex?.depth_change_pct;
                return (
                  <div key={label} className={`flex-1 p-3 ${index === 1 ? 'border-l-2 border-l-black' : ''}`}>
                    <div className="flex items-center justify-center rounded-[4px] px-3 py-2">
                      <span
                        className="text-center text-2xl font-bold"
                        style={{
                          color: liquidityColor(pct),
                          WebkitTextStroke: '3px black',
                          paintOrder: 'stroke fill',
                        }}>
                        {formatChangePct(pct)}
                      </span>
                    </div>
                    <div className="text-center text-xs font-semibold text-black">{label}</div>
                  </div>
                );
              },
            )}
          </div>

          {/* markdown 正文：比日报默认小 2px（14px → 12px） */}
          <ReportStream
            key={tokenId}
            createStream={createStream}
            onError={handleError}
            contentClassName="h-[50vh]"
            contentStyle={{ fontSize: '12px' }}
          />
        </div>
      </Dialog>
    );
  },
);

CoinAnalysisDialog.displayName = 'CoinAnalysisDialog';

export default CoinAnalysisDialog;
