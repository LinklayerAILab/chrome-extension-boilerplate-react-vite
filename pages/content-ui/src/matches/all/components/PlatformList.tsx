import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@src/store';
import { Popover, message } from '@src/ui';
import { useI18n } from '@src/lib/i18n';
import { platformListData, type PlatformItem } from '../lib/enum';
import { get_cex } from '@src/api/agent_c';
import { getSyncAssets, setSelectCex } from '@src/store/slices/assetsSlice';
import type { GetAssetWithLogoItem } from '@src/api/agent_c';
import StreamingModal from './StreamingModal';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import type { Swiper as SwiperClass } from 'swiper';
import { CoinHeader } from './CoinHeader';
const btcIcon = chrome.runtime.getURL('content-ui/coins/btc.svg');
const ethIcon = chrome.runtime.getURL('content-ui/coins/eth.svg');
const dogeIcon = chrome.runtime.getURL('content-ui/coins/doge.svg');
const solIcon = chrome.runtime.getURL('content-ui/coins/sol.svg');
const trxIcon = chrome.runtime.getURL('content-ui/coins/trx.svg');
const xrpIcon = chrome.runtime.getURL('content-ui/coins/xrp.svg');
const zecIcon = chrome.runtime.getURL('content-ui/coins/zec.svg');
const bnbIcon = chrome.runtime.getURL('content-ui/coins/bnb.svg');
export type PlatformListProps = {
  handleClick?: (item: PlatformItem) => void;
  handleUpload?: () => void;
  enabledCex?: string[];
  handleAssetClick?: (asset: GetAssetWithLogoItem) => void;
  showCoins?: boolean;
};

const normalizeName = (value: string) => value.trim().toLowerCase();

const buildList = (enabledSet: Set<string> | null, selectedName: string) =>
  platformListData.map(item => ({
    ...item,
    selected: item.name === selectedName,
    disabled: enabledSet ? !enabledSet.has(item.name.toLowerCase()) : item.disabled,
  }));

const fallbackAssets: GetAssetWithLogoItem[] = [
  { asset: 'BTC', free: '0', logo: btcIcon },
  { asset: 'ETH', free: '0', logo: ethIcon },
  { asset: 'SOL', free: '0', logo: solIcon },
  { asset: 'BNB', free: '0', logo: bnbIcon },
  { asset: 'XRP', free: '0', logo: xrpIcon },
  { asset: 'ZEC', free: '0', logo: zecIcon },
  { asset: 'DOGE', free: '0', logo: dogeIcon },
  { asset: 'TRC', free: '0', logo: trxIcon },
];

export const PlatformList = ({
  handleClick,
  handleUpload,
  enabledCex,
  handleAssetClick,
  showCoins = true,
}: PlatformListProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const selectCex = useSelector((state: RootState) => state.assets.selectCex);
  const isLogin = useSelector((state: RootState) => state.user.isLogin);
  const assets = useSelector((state: RootState) => state.assets.assets);
  const { t } = useI18n();
  const tAny = t as unknown as Record<string, any>;

  const [streamingModal, setStreamingModal] = useState<{
    isOpen: boolean;
    type: 'analyse' | 'recommend' | null;
    query: string;
    coinSymbol?: string;
    title?: string;
    logo?: string;
  }>({
    isOpen: false,
    type: null,
    query: '',
  });

  const enabledKey = enabledCex?.join('|') ?? '';
  const enabledSet = useMemo(() => {
    if (!enabledCex || enabledCex.length === 0) return null;
    return new Set(enabledCex.map(normalizeName));
  }, [enabledKey]);

  const effectiveEnabledSet = isLogin ? enabledSet : null;
  const [list, setList] = useState(() => buildList(effectiveEnabledSet, selectCex));
  const prevButtonRef = useRef<HTMLDivElement | null>(null);
  const nextButtonRef = useRef<HTMLDivElement | null>(null);
  const swiperRef = useRef<SwiperClass | null>(null);

  useEffect(() => {
    setList(buildList(effectiveEnabledSet, selectCex));
  }, [effectiveEnabledSet, selectCex]);

  useEffect(() => {
    dispatch(getSyncAssets(selectCex));
  }, [dispatch, selectCex]);

  useEffect(() => {
    if (!swiperRef.current || !prevButtonRef.current || !nextButtonRef.current) return;
    swiperRef.current.params.navigation = {
      ...(swiperRef.current.params.navigation || {}),
      prevEl: prevButtonRef.current,
      nextEl: nextButtonRef.current,
    };
    swiperRef.current.navigation?.init();
    swiperRef.current.navigation?.update();
  }, []);

  useEffect(() => {
    if (!isLogin) return;

    let isCancelled = false;
    get_cex()
      .then(res => {
        if (isCancelled) return;
        const enabled = new Set(res.data.cex.map(name => name.toLowerCase()));
        setList(prev =>
          prev.map(item => ({
            ...item,
            disabled: !enabled.has(item.name.toLowerCase()),
            selected: item.name.toLowerCase() === selectCex.toLowerCase(),
          })),
        );
      })
      .catch(() => {
        // Keep previous state if request fails.
      });

    return () => {
      isCancelled = true;
    };
  }, [isLogin, selectCex]);

  const onSelect = (item: PlatformItem) => {
    if (item.disabled) return;

    setList(prev =>
      prev.map(entry => ({
        ...entry,
        selected: entry.name === item.name,
      })),
    );
    dispatch(setSelectCex(item.name));
    handleClick?.(item);
  };

  const displayAssets = assets.length ? assets : fallbackAssets;

  const handleAssetAnalyze = (asset: GetAssetWithLogoItem) => {
    if (!isLogin) {
      message.warning(tAny?.common?.pleaseLogin ?? 'Please login first');
      return;
    }

    const query = `${tAny?.agent?.analyze ?? 'Analyze'} ${asset.asset}`.trim();
    setStreamingModal({
      isOpen: true,
      type: 'analyse',
      query,
      coinSymbol: asset.asset,
      title: `${asset.asset} ${tAny?.agent?.analyzeCoin ?? 'Analyzing Coin'}`,
      logo: asset.logo,
    });
  };

  const handleCloseModal = () => {
    setStreamingModal({
      isOpen: false,
      type: null,
      query: '',
    });
  };

  return (
    <div className="w-full rounded-[8px] border-[2px] border-solid border-black p-[14px]">
      <div className="flex h-full flex-col-reverse gap-[14px] overflow-hidden lg:flex-col">
        <div className="flex w-full items-center justify-between gap-[20px] overflow-x-scroll" id="coin-list-box">
          {list.map(item => (
            <div
              key={item.name}
              className={`${item.selected ? 'border-b-[#cf0]' : 'border-b-white'} border-b-[4px] border-solid lg:border-none`}>
              <div
                onClick={() => onSelect(item)}
                className={`flex h-[60px] w-[60px] flex-shrink-0 select-none flex-col items-center justify-center border-[4px] ${
                  item.selected ? 'border-[#cf0]' : 'border-white'
                } ${item.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} rounded-full bg-white`}>
                <img
                  src={item.selected ? item.imgA : item.imgB}
                  alt={item.name}
                  className="h-[56px] w-[56px] select-none object-contain"
                  style={{ filter: item.selected ? 'none' : 'grayscale(100%)' }}
                />
              </div>
              <div
                className={`my-[8px] flex items-center justify-center text-[12px] font-bold text-black ${item.disabled ? 'text-gray-400' : ''}`}>
                {item.name}
              </div>
            </div>
          ))}
        </div>
        {showCoins ? (
          <div className="flex h-[76px] w-full select-none items-center justify-center rounded-[8px] border-[3px] border-solid border-[#cf0] bg-black px-[10px] py-[14px]">
            <div
              ref={prevButtonRef}
              className="crypto-swiper-button-prev flex cursor-pointer items-center justify-center pr-[10px] transition-opacity hover:opacity-70">
              <svg
                className="h-[24px] w-[24px]"
                style={{ color: '#666666' }}
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12.5 4.5 7.5 10l5 5.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <Swiper
              key={assets.length}
              modules={[Navigation]}
              slidesPerView={6}
              slidesPerGroup={6}
              spaceBetween={12}
              watchOverflow={false}
              breakpoints={{
                320: {
                  slidesPerView: 6,
                  slidesPerGroup: 6,
                  spaceBetween: 4,
                },
              }}
              onBeforeInit={swiper => {
                swiperRef.current = swiper;
                if (prevButtonRef.current) {
                  swiper.params.navigation = {
                    ...(swiper.params.navigation || {}),
                    prevEl: prevButtonRef.current,
                  };
                }
                if (nextButtonRef.current) {
                  swiper.params.navigation = {
                    ...(swiper.params.navigation || {}),
                    nextEl: nextButtonRef.current,
                  };
                }
              }}
              navigation={{
                prevEl: prevButtonRef.current,
                nextEl: nextButtonRef.current,
              }}
              loop
              className="flex h-full items-center"
              style={{ width: '480px', overflow: 'hidden' }}>
              {displayAssets.map((crypto, index) => (
                <SwiperSlide
                  title={crypto.asset}
                  key={`${crypto.asset}-${index}`}
                  className="flex h-full items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (!assets.length) return;
                      handleAssetAnalyze(crypto);
                      handleAssetClick?.(crypto);
                    }}
                    className={`flex h-full items-center justify-center rounded-full text-[12px] font-bold text-white transition-transform ${
                      assets.length ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'
                    }`}>
                    {crypto.logo ? (
                      <img
                        src={crypto.logo}
                        alt={crypto.asset}
                        className={`h-[30px] w-[30px] rounded-full bg-white lg:h-[32px] lg:w-[32px]`}
                      />
                    ) : (
                      <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full border-[1px] border-solid border-[#666] bg-[#eee] font-bold text-black">
                        {crypto.asset.slice(0, 2)}
                      </div>
                    )}
                  </button>
                </SwiperSlide>
              ))}
            </Swiper>

            <div
              ref={nextButtonRef}
              className="crypto-swiper-button-next flex cursor-pointer items-center justify-center pl-[10px] transition-opacity hover:opacity-70">
              <svg
                className="h-[24px] w-[24px]"
                style={{ color: '#666666' }}
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M7.5 4.5 12.5 10l-5 5.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        ) : (
          <></>
        )}
      </div>
      {streamingModal.isOpen && streamingModal.type && (
        <StreamingModal
          isOpen={streamingModal.isOpen}
          onClose={handleCloseModal}
          type={streamingModal.type}
          query={streamingModal.query}
          coinSymbol={streamingModal.coinSymbol}
          title={
            <CoinHeader
              symbol={streamingModal.coinSymbol!}
              logo={`${streamingModal.logo}`}
              priceLoop={false}
              tradingUrl={`https://www.binance.com/en/trade/${streamingModal.coinSymbol!.split('USDT')[0].toUpperCase()}_USDT?type=spot`}
              type="SPOT"></CoinHeader>
          }
        />
      )}
    </div>
  );
};
