import { useState, useEffect } from 'react';
import { get_spot_price } from '@src/api/agent_c';
import { useI18n } from '@src/lib/i18n';

const light = chrome.runtime.getURL('content-ui/coinHeader/light.svg');
const go = chrome.runtime.getURL('content-ui/coinHeader/go.svg');

export interface CoinHeaderProps {
  symbol: string;
  logo: string;
  priceLoop: boolean;
  tradingUrl: string;
  type: 'SPOT' | 'FUTURE';
}

export const CoinHeader = (props: CoinHeaderProps) => {
  const { t } = useI18n();
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPrice = async (showLoading: boolean) => {
      try {
        if (showLoading) {
          setLoading(true);
        }
        const response = await get_spot_price({ symbol: props.symbol.split('USDT')[0].toUpperCase() });
        setPrice(response.data.price);
      } catch (error) {
        console.error('Failed to fetch spot price:', error);
        setPrice(null);
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    };

    if (props.priceLoop) {
      // 立即调用一次，显示 loading
      fetchPrice(true);
      // 设置定时器，每8秒调用一次，不显示 loading
      const intervalId = setInterval(() => fetchPrice(false), 8000);
      // 清理函数：组件卸载或依赖变化时清除定时器
      return () => clearInterval(intervalId);
    }
  }, [props.symbol, props.priceLoop]);

  const handleToTrading = () => {
    window.open(props.tradingUrl, '_blank');
    // window.open(
    //   `https://www.binance.com/en/trade/${props.symbol.split('USDT')[0].toUpperCase()}_USDT?type=spot`,
    //   "_blank"
    // );
  };

  return (
    <div className="m-4 flex gap-[14px] rounded-[8px] bg-black p-6 text-[12px] font-bold text-white">
      <div className="h-[86px] w-[86px] overflow-hidden rounded-full border-[6px] border-solid border-[#cf0] bg-white">
        <img src={`${props.logo}`} className="h-full w-full" alt={props.symbol}></img>
      </div>
      <div className="flex flex-1 flex-col gap-[2px]">
        <div className="flex h-[42px] items-center justify-between rounded-[4px] bg-[#1C1C1C] p-4">
          <div>{props.symbol}</div>
          <div>
            {loading ? (
              <span className="text-gray-400">{t.common.loading}</span>
            ) : price !== null ? (
              <span>${props.priceLoop ? price.toLocaleString() : '-'}</span>
            ) : (
              <span className="text-white"></span>
            )}
          </div>
        </div>
        <div className="flex gap-[2px]">
          <div className="flex h-[42px] flex-1 items-center gap-4 bg-[#1C1C1C] p-4">
            {props.type === 'SPOT' ? t.common.spot : t.common.futures}
            <img src={light} alt="" />
          </div>
          <div
            className="flex h-[42px] flex-1 cursor-pointer items-center gap-4 bg-[#1C1C1C] p-4 transition-colors hover:bg-[#2a2a2a]"
            onClick={handleToTrading}>
            {t.common.trading}
            <img src={go} alt="" />
          </div>
        </div>
      </div>
    </div>
  );
};
