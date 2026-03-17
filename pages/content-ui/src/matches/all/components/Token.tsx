import { getBinanceTokenPrice, getBinanceTokenScreen, BinanceTokenScreenItem } from '@src/api/agent_c';
import { useI18n } from '@src/lib/i18n';
import { setPageInfo } from '@src/store/slices/pageInfoSlice';
import { setTokenList } from '@src/store/slices/tokenSlice';
import { Button, Skeleton } from '@src/ui';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { StatusIndicator } from './StatusIndicator';
import type { RootState } from '@src/store';

const topLight = chrome.runtime.getURL('content-ui/xInject/top-light.svg');
const priceIcon = chrome.runtime.getURL('content-ui/token/price.svg');
const defaultTokenLogo = chrome.runtime.getURL('content-ui/coins/bnb.svg');

interface TokenCardProps {
  name: string;
  price?: number;
  logo: string;
  contractAddress: string;
}

const TokenCard = ({ name, contractAddress, price, logo }: TokenCardProps) => {
  const { t } = useI18n();

  const optimal = t.common?.optimal || 'Optimal';
  const lpDepth = t.common?.lpDepth || 'LP Depth';
  const lpStability = t.common?.lpStability || 'LP Stability';
  const trade = t.common?.trade || 'Trade';
  const agent = t.common?.agent || 'Agent';
  const formatPriceTruncate = (value: number, decimals: number) => {
    const factor = 10 ** decimals;
    const truncated = Math.trunc(value * factor) / factor;
    return truncated.toFixed(decimals);
  };
  const priceText = price !== undefined ? formatPriceTruncate(price, 6) : '--';
  const toPlainString = (value: number) => {
    if (!Number.isFinite(value)) {
      return String(value);
    }
    const fixed = value.toFixed(18);
    return fixed.replace(/\.?0+$/, '');
  };
  const priceTitle = price !== undefined ? toPlainString(price) : '--';
  const displayName = name.length > 15 ? `${name.slice(0, 15)}...` : name;
  const handleTrade = () => {
    window.open(
      `https://pancakeswap.finance/swap?inputCurrency=0x55d398326f99059fF775485246999027B3197955&outputCurrency=${contractAddress}`,
      '_blank',
    );
  };

  return (
    <div className="token-card flex rounded-lg bg-[#F4F4F4] p-[14px]">
      <div className="border-r-solid flex w-[310px] flex-col border-r-[1px] border-r-[#Eeee] pr-[14px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[4px]">
            <img
              src={logo || defaultTokenLogo}
              alt={`${name} logo`}
              className="h-[30px] w-[30px] rounded-full bg-white"
            />
            <div className="flex flex-col gap-1">
              <div className="w-full text-[13px] font-bold" title={name.toUpperCase()}>
                {displayName.toUpperCase()}
              </div>
              <div className="flex w-full items-center text-[10px] font-bold" title={priceTitle}>
                <img src={priceIcon} alt="Price" className="h-[12px] w-[12px]" /> ${priceText}
              </div>
            </div>
          </div>

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
        <Button size="small" style={{ height: 30 }} onClick={handleTrade}>
          {trade}
        </Button>
        <Button size="small" style={{ height: 30 }} type="primary">
          {agent}
        </Button>
      </div>
    </div>
  );
};

const TokenCardSkeleton = () => {
  return (
    <div className="token-card flex rounded-lg bg-[#F4F4F4] p-[14px]">
      <div className="border-r-solid flex w-[310px] flex-col border-r-[1px] border-r-[#Eeee] pr-[14px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[4px]">
            <Skeleton.Circle className="h-[30px] w-[30px]" />
            <div className="flex flex-col items-center gap-2">
              <Skeleton.Text className="h-4 w-20" />
              <Skeleton.Text className="h-3 w-16" />
            </div>
          </div>
          <div className="flex items-center gap-[4px]">
            <Skeleton.Circle className="h-[22px] w-[22px]" />
            <Skeleton.Text className="h-3 w-14" />
          </div>
        </div>
        <div className="mt-[10px] flex items-center gap-[14px] rounded-lg pt-[10px]">
          <Skeleton className="h-[26px] flex-1 rounded-[15px]" />
          <Skeleton className="h-[26px] flex-1 rounded-[15px]" />
        </div>
      </div>
      <div className="flex w-[100px] flex-col gap-[14px] pl-[14px]">
        <Skeleton.Button style={{ height: 30 }} />
        <Skeleton.Button style={{ height: 30 }} />
      </div>
    </div>
  );
};

export const Token = () => {
  const { t } = useI18n();
  const dispatch = useDispatch();

  const tokenList = useSelector((state: RootState) => state.tokens.tokenList);
  const [tokens, setTokens] = useState<BinanceTokenScreenItem[]>(tokenList);
  const [listLoading, setListLoading] = useState(false);

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

  useEffect(() => {
    setTokens(tokenList);
  }, [tokenList]);

  useEffect(() => {
    let isActive = true;
    const fetchTokens = async () => {
      const hasCachedTokens = tokenList.length > 0;
      if (!hasCachedTokens) {
        setListLoading(true);
      }
      try {
        const screenResponse = hasCachedTokens ? null : await getBinanceTokenScreen();
        const freshTokenList = hasCachedTokens ? tokenList : (screenResponse?.data?.results ?? []);
        if (isActive && !hasCachedTokens) {
          setTokens(freshTokenList);
          dispatch(setTokenList(freshTokenList));
          setListLoading(false);
        }
        const tokenAddresses = freshTokenList
          .map(token => token.contractAddress)
          .filter((address): address is string => Boolean(address));
        if (tokenAddresses.length > 0) {
          try {
            const priceResponse = await getBinanceTokenPrice(tokenAddresses);
            const priceMap = new Map((priceResponse.data?.prices ?? []).map(item => [item.token_address, item.price]));
            if (isActive) {
              setTokens(prev =>
                prev.map(token => ({
                  ...token,
                  price: priceMap.get(token.contractAddress) ?? token.price,
                })),
              );
            }
          } catch (error) {
            console.error('Failed to load token prices:', error);
          }
        }
      } catch (error) {
        console.error('Failed to load token list:', error);
        if (isActive) {
          setTokens([]);
          setListLoading(false);
        }
      }
    };

    fetchTokens();
    return () => {
      isActive = false;
    };
  }, [dispatch, tokenList]);

  return (
    <div className="token-container">
      <div className="token-list-box mb-[20px] flex flex-col gap-[14px]">
        {listLoading &&
          Array.from({ length: 4 }).map((_, index) => <TokenCardSkeleton key={`token-skeleton-${index}`} />)}
        {!listLoading &&
          tokens.map(token => {
            const name = token.tokenSymbol;
            const logo = token.imageUrl;
            const key = token.contractAddress;

            return <TokenCard key={key} name={name} contractAddress={key} price={token.price} logo={logo} />;
          })}
      </div>
    </div>
  );
};
