import { AlphaCard } from './AlphaCard';
import { AlphaCardSkeleton } from './AlphaCardSkeleton';
import { AlphaEmptyState } from './AlphaEmptyState';
import { AlphaHeaderSkeleton } from './AlphaHeaderSkeleton';
import { useI18n } from '@src/lib/i18n';
import { usePageInfoUpdate } from '@src/lib/hooks/usePageInfoUpdate';
import { Skeleton } from '@src/ui';
import { useEffect, useState } from 'react';
import {
  alpha_token_info,
  alpha_token_price,
  liquidity_check,
  update_time,
  type AlphaTokenItem,
} from '@src/api/agent_c';
import { useSelector } from 'react-redux';
import { RootState } from '@src/store';

export const Alpha = () => {
  const { t, locale } = useI18n();

  // 监听语言切换事件，更新页面标题和描述
  usePageInfoUpdate('alpha', locale);

  const dunpai = chrome.runtime.getURL('content-ui/alpha/dunpai.svg');
  const time = chrome.runtime.getURL('content-ui/alpha/time.svg');
  const isLogin = useSelector((state: RootState) => state.user.isLogin);
  type AlphaTokenWithPrice = AlphaTokenItem & { price?: number };
  const [alphaData, setAlphaData] = useState<AlphaTokenWithPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [liquidityLoading, setLiquidityLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [updateTime, setUpdateTime] = useState(0);
  const [relativeTime, setRelativeTime] = useState('0m age');
  useEffect(() => {
    if (!updateTime) {
      setRelativeTime('0m age');
      return;
    }
    const update = () => {
      const diffMs = Date.now() - updateTime;
      const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
      const days = Math.floor(totalMinutes / 1440); // 1天 = 1440分钟
      const minutes = totalMinutes % 1440;

      if (days > 0) {
        setRelativeTime(`${days}d${minutes}m age`);
      } else {
        setRelativeTime(`${totalMinutes}m age`);
      }
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [updateTime]);
  useEffect(() => {
    let isCancelled = false;
    const loadAlphaData = async () => {
      setLoading(true);
      try {
        const infoRes = await alpha_token_info();
        if (isCancelled) return;
        const tokens = infoRes?.data?.tokens || [];

        if (tokens.length === 0) {
          setAlphaData([]);
          setLoading(false);
          setLiquidityLoading(false);
          setPriceLoading(false);
          return;
        }

        const tokenAddresses = tokens
          .map(token => token.token_address || token.symbol)
          .filter((address): address is string => Boolean(address));

        if (tokenAddresses.length === 0) {
          setAlphaData(tokens);
          setLoading(false);
          setLiquidityLoading(false);
          setPriceLoading(false);
          return;
        }

        setAlphaData(tokens);
        setLoading(false);
        setLiquidityLoading(true);
        setPriceLoading(true);

        alpha_token_price({ token_addresses: tokenAddresses })
          .then(priceRes => {
            if (isCancelled) return;
            const priceMap = new Map<string, number>();
            priceRes?.data?.prices?.forEach(priceItem => {
              const key = priceItem.token_address || priceItem.symbol;
              if (key) {
                priceMap.set(key, priceItem.price);
              }
            });

            setAlphaData(prev =>
              prev.map(token => {
                const key = token.token_address || token.symbol;
                const price = key ? priceMap.get(key) : undefined;
                return { ...token, price };
              }),
            );
          })
          .catch(() => {
            if (isCancelled) return;
          })
          .finally(() => {
            if (isCancelled) return;
            setPriceLoading(false);
          });

        liquidity_check({ token_addresses: tokenAddresses })
          .then(liquidityRes => {
            if (isCancelled) return;
            const liquidityMap = new Map<
              string,
              { level?: number; color?: string; d2_result?: string | Record<string, unknown> }
            >();
            liquidityRes?.data?.results?.forEach(item => {
              const key = item.token_address || item.symbol;
              if (key) {
                liquidityMap.set(key, {
                  level: item.level,
                  color: item.color,
                  d2_result: item.d2_result,
                });
              }
            });

            setAlphaData(prev =>
              prev.map(token => {
                const key = token.token_address || token.symbol;
                const liquidity = key ? liquidityMap.get(key) : undefined;
                return {
                  ...token,
                  level: liquidity?.level ?? token.level,
                  color: liquidity?.color ?? token.color,
                  d2_result: liquidity?.d2_result ?? token.d2_result,
                };
              }),
            );
          })
          .catch(() => {
            if (isCancelled) return;
          })
          .finally(() => {
            if (isCancelled) return;
            setLiquidityLoading(false);
          });
      } catch {
        if (isCancelled) return;
        setAlphaData([]);
        setLoading(false);
        setLiquidityLoading(false);
        setPriceLoading(false);
      }
    };

    loadAlphaData();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isLogin) {
      update_time().then(res => {
        setUpdateTime(res.data.block_time * 1000);
      });
    }
  }, [isLogin]);

  const formatPrice = (price?: number) => {
    if (price === undefined || Number.isNaN(price)) return '--';
    return price.toFixed(6);
  };
  const formatDepth = (depth?: number) => {
    if (!depth) return '--';
    const str = (depth * 100).toString();
    return str.length > 5 ? str.slice(0, 5) : str;
  };

  return (
    <div className="flex flex-col gap-4">
      {!loading && alphaData.length > 0 && (
        <>
          <div className="mt-2 flex items-center justify-between text-black">
            <div className="text-[13px] font-bold">{t.alpha?.myAlphaHolding || 'My Alpha Holding'}</div>
            <div className="flex items-center gap-2">
              <img src={time} alt="Time Icon" className="h-[14px] w-[14px] text-[12px]" /> {relativeTime}
            </div>
          </div>
          <div className="flex min-h-[100px] flex-col rounded-[8px] border-[2px] border-solid border-black">
            <div className="mx-[1px] mt-[1px] flex h-[68px] items-center justify-center gap-2 rounded-[6px] bg-black text-[17px] font-bold text-[#cf0]">
              <img src={dunpai} alt="Dunpai Logo" className="h-[18px] w-[18px]" />
              {t.alpha?.worstToken || 'Worst Token'}
            </div>

            <div className="flex h-full flex-wrap items-center justify-center gap-3 py-2 text-[14px] text-black">
              {liquidityLoading
                ? Array.from({ length: 5 }).map((_, idx) => (
                    <Skeleton
                      key={`worst-token-skeleton-${idx}`}
                      className="h-[2.4vh] w-16 rounded-full border-[2px] border-solid border-black"
                    />
                  ))
                : alphaData
                    .filter(item => item.color === 'RED')
                    .map(item => (
                      <div
                        key={item.symbol}
                        className="rounded-full border-[2px] border-solid border-black px-3 py-[0.6vh] text-center">
                        {item.symbol}
                      </div>
                    ))}
            </div>
          </div>
        </>
      )}
      {loading && <AlphaHeaderSkeleton />}

      {loading ? (
        // 骨架屏：显示 3 个骨架卡片
        <>
          <AlphaCardSkeleton />
          <AlphaCardSkeleton />
          <AlphaCardSkeleton />
        </>
      ) : alphaData.length === 0 ? (
        // 空数据状态
        <AlphaEmptyState />
      ) : (
        // 数据加载完成后渲染实际数据
        alphaData.map((item, idx) => (
          <AlphaCard
            key={`${item.symbol}-${idx}`}
            title={item.symbol}
            price={formatPrice(item.price)}
            depth={formatDepth(item?.d2_result?.slope)}
            type={item.level ?? 3}
            icon={item.icon_url}
            statusColor={item.color}
            statusLoading={liquidityLoading}
            priceLoading={priceLoading}
            depthLoading={liquidityLoading}
            data={item}
            isLogin={isLogin}
          />
        ))
      )}
    </div>
  );
};
