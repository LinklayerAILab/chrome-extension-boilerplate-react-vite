import { useMemo, useState } from 'react';
import { Button, Skeleton } from '@src/ui';
import { useI18n } from '@src/lib/i18n';
import StreamingModal from './StreamingModal';
import { CoinHeader } from './CoinHeader';

interface AlphaCardProps {
  title: string;
  price: string;
  depth?: string;
  type: number;
  icon: string;
  statusColor?: string;
  statusLoading?: boolean;
  priceLoading?: boolean;
  depthLoading?: boolean;
  data?: unknown;
}

export const AlphaCard = ({
  title = 'Token Name',
  price = '--',
  depth = '--',
  icon = '',
  statusColor,
  statusLoading = false,
  priceLoading = false,
  depthLoading = false,
  data,
}: AlphaCardProps) => {
  const { t } = useI18n();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const zichan = chrome.runtime.getURL('content-ui/alpha/zichan.svg');
  const rise = chrome.runtime.getURL('content-ui/alpha/rise.svg');
  const downRed = chrome.runtime.getURL('content-ui/alpha/down-red.svg');
  const downYellow = chrome.runtime.getURL('content-ui/alpha/down-yellow.svg');

  const handleClass = () => {
    if (statusColor === 'GREEN') {
      return 'text-[#2EC94C] border-[#2EC94C] bg-[#F3FFEF]';
    }
    if (statusColor === 'RED') {
      return 'text-[#F44A40] border-[#F44A40] bg-[#FFFDF4]';
    }
    if (statusColor === 'YELLOW') {
      return 'text-[#B1B100] border-[#B1B100] bg-[#FFF7F7]';
    }
    return undefined;
  };

  const handleIcon = () => {
    if (statusColor === 'GREEN') {
      return rise;
    }
    if (statusColor === 'RED') {
      return downRed;
    }
    if (statusColor === 'YELLOW') {
      return downYellow;
    }
    return undefined;
  };

  const randomDelay = useMemo(() => (Math.random() * 1 + 0.5).toFixed(2), []);
  const renderClass = (str?: string) => {
    if (str === 'GREEN') return 'gradientFade1';
    if (str === 'RED') return 'gradientFade2';
    if (str === 'YELLOW') return 'gradientFade3';
    return '';
  };

  const handleAgentClick = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const query = useMemo(() => JSON.stringify(data ?? {}), [data]);
  const handleExplorer = () => {
    window.open(`https://bscscan.com/token/${data.token_address}`, '__blank');
  };
  return (
    <div className="alpha-card flex gap-3 px-[14px] py-[14px] text-[12px] text-black">
      <div className="flex w-[110px] flex-col items-center justify-center gap-2 rounded-[8px] border-[2px] border-solid border-black p-[10px]">
        {statusLoading ? (
          <Skeleton.Circle className="h-[4.3vh] w-[4.3vh] border-[2px] border-solid border-black" />
        ) : (
          <div className="h-[4.3vh] w-[4.3vh] rounded-full border-[2px] border-solid border-black">
            <img src={icon} alt="" className="h-full w-full rounded-full"></img>
          </div>
        )}
        {statusLoading ? (
          <Skeleton.Circle className="h-[4.3vh] w-[4.3vh] border-[2px] border-solid border-black" />
        ) : statusColor ? (
          <div
            className="alpha-status h-[4.3vh] w-[4.3vh] rounded-full border-[2px] border-solid border-black"
            style={{
              animation: `${renderClass(statusColor)} 4s ease-in-out ${randomDelay}s infinite`,
            }}></div>
        ) : null}
      </div>
      <div className="alpha-card-content flex flex-1 flex-col gap-2">
        <div className="flex items-center justify-between rounded-[4px] bg-[#f3f3f3] px-4 py-2">
          <div className="text-[12px]">{title}</div>
          <div>--</div>
        </div>
        <div className="flex items-center justify-between rounded-[4px] bg-[#f3f3f3] px-4 py-2">
          <div className="text-[12px]">{t.common?.price || 'Price'}</div>
          <div className="flex items-center gap-1">
            <img src={zichan} alt=""></img>

            {priceLoading ? <Skeleton.Text className="w-16" /> : <span>{price}</span>}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-[4px] bg-[#f3f3f3] px-4 py-2">
          <div className="text-[12px]">{t.common?.lpDepth || 'LP depth'}</div>
          <div
            className={`h-[24px] border-[1px] border-solid ${handleClass()} flex items-center justify-center rounded-full px-2 text-[10px] font-bold`}>
            <img src={handleIcon()} alt="" />
            {depthLoading ? (
              <Skeleton.Text className="w-16" />
            ) : (
              <span>
                {depth}%({t.common?.time5m || '15m'})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button block style={{ fontSize: '12px', padding: '0px 5px' }} onClick={handleExplorer}>
            {t.common?.explorer || 'Explorer'}
          </Button>
          <Button id="agent-btn" block style={{ fontSize: '12px', padding: '0px 5px' }} onClick={handleAgentClick}>
            {t.common?.agent || 'Agent'}
          </Button>
        </div>
      </div>
      {isModalOpen && (
        <StreamingModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          type="liquidity_check"
          title={
            <CoinHeader
              symbol={title}
              type="SPOT"
              priceLoop={false}
              logo={icon}
              tradingUrl={`https://www.binance.com/zh-CN/alpha/bsc/${data.token_address}`}></CoinHeader>
          }
          query={query}
        />
      )}
    </div>
  );
};
