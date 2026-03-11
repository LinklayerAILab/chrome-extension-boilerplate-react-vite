import { useI18n } from '@src/lib/i18n';
import { setPageInfo } from '@src/store/slices/pageInfoSlice';
import { Button } from '@src/ui';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { StatusIndicator } from './StatusIndicator';
const topLight = chrome.runtime.getURL('content-ui/xInject/top-light.svg');
const priceIcon = chrome.runtime.getURL('content-ui/token/price.svg');
// TokenCard 组件
interface TokenCardProps {
  name: string;
  symbol: string;
  price: string;
  logo: string;
}

const TokenCard = ({ name, symbol, price, logo }: TokenCardProps) => {
  const { t } = useI18n();

  // 安全检查：确保翻译对象存在
  const optimal = t.common?.optimal || 'Optimal';
  const lpDepth = t.common?.lpDepth || 'LP Depth';
  const lpStability = t.common?.lpStability || 'LP Stability';
  const trade = t.common?.trade || 'Trade';
  const agent = t.common?.agent || 'Agent';

  return (
    <div className="token-card flex rounded-lg bg-[#F4F4F4] p-[14px]">
      <div className="border-r-solid flex w-[310px] flex-col border-r-[1px] border-r-[#Eeee] pr-[14px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[4px]">
            <img src={logo} alt={`${name} logo`} className="h-[30px] w-[30px]" />
            <span className="text-[13px] font-bold">{name}</span>
          </div>
          <span className="flex items-center text-[10px] font-bold">
            <img src={priceIcon} alt="Price" className="h-[12px] w-[12px]" /> ${price}
          </span>
          <div className="flex items-center gap-[4px] text-[12px]">
            <StatusIndicator size={22} borderWidth={1} statusColor="GREEN" /> {optimal}
          </div>
        </div>
        <div className="mt-[10px] flex items-center gap-[14px] rounded-lg pt-[10px]">
          <div className="lh-[26px] flex h-[26px] flex-1 items-center justify-center gap-[4px] rounded-[15px] border-[1px] border-solid border-[#789600] bg-white text-[12px] text-[#789600]">
            {lpDepth} <img src={topLight} alt="" />
          </div>
          <div className="lh-[26px] flex h-[26px] flex-1 items-center justify-center gap-[4px] rounded-[15px] border-[1px] border-solid border-[#789600] bg-white text-[12px] text-[#789600]">
            {lpStability} <img src={topLight} alt="" />
          </div>
        </div>
      </div>
      <div className="flex w-[100px] flex-col gap-[14px] pl-[14px]">
        <Button size="small" style={{ height: 30 }}>
          {trade}
        </Button>
        <Button size="small" style={{ height: 30 }} type="primary">
          {agent}
        </Button>
      </div>
    </div>
  );
};

export const Token = () => {
  const { t } = useI18n();
  const dispatch = useDispatch();

  // 模拟代币数据
  const tokens = [
    {
      name: 'Aster',
      symbol: 'ASTR',
      price: '0.65',
      logo: chrome.runtime.getURL('content-ui/xInject/aster.svg'),
    },
    {
      name: 'Hana',
      symbol: 'Hana',
      price: '68.45',
      logo: chrome.runtime.getURL('content-ui/xInject/hana.svg'), // 临时使用相同的 logo
    },
    {
      name: 'Fandom',
      symbol: 'Fandom',
      price: '125',
      logo: chrome.runtime.getURL('content-ui/xInject/fandom.svg'), // 临时使用相同的 logo
    },
    {
      name: 'Stable',
      symbol: 'Stable',
      price: '0.655',
      logo: chrome.runtime.getURL('content-ui/xInject/stable.svg'), // 临时使用相同的 logo
    },
    {
      name: 'Koge',
      symbol: 'Koge',
      price: '12',
      logo: chrome.runtime.getURL('content-ui/xInject/koge.svg'), // 临时使用相同的 logo
    },
    {
      name: 'CAKE',
      symbol: 'CAKE',
      price: '2.45',
      change24h: '-1.23',
      volume24h: '234M',
      logo: chrome.runtime.getURL('content-ui/xInject/bnb.svg'), // 临时使用相同的 logo
    },
    {
      name: 'Wod',
      symbol: 'Wod',
      price: '12',
      logo: chrome.runtime.getURL('content-ui/xInject/wod.svg'), // 临时使用相同的 logo
    },
    {
      name: 'Bob',
      symbol: 'Bob',
      price: '5.98',
      logo: chrome.runtime.getURL('content-ui/xInject/bob.svg'), // 临时使用相同的 logo
    },
    {
      name: 'River',
      symbol: 'River',
      price: '4.58',
      logo: chrome.runtime.getURL('content-ui/xInject/river.svg'), // 临时使用相同的 logo
    },
  ];

  useEffect(() => {
    dispatch(
      setPageInfo({
        page: 'token',
        info: {
          title: t.agent?.token || 'BSC State-Scanner',
          description: t.agent?.tokenDesc || 'Live on-chain filtering for the most liquid assets on BNB Chain',
        },
      }),
    );
  }, [t]);

  return (
    <div className="token-container">
      <div className="token-list-box mb-[20px] flex flex-col gap-[14px]">
        {tokens.map((token, index) => (
          <TokenCard key={index} name={token.name} symbol={token.symbol} price={token.price} logo={token.logo} />
        ))}
      </div>
    </div>
  );
};
