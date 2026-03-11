import { useState, useEffect, ReactNode, memo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@src/store';
import { useI18n } from '@src/lib/i18n';
import { Input, message } from '@src/ui';
import StreamingModal from './StreamingModal';
import TendBox from './TendBox';
import CoinList from './CoinList';
import { setPageInfo } from '@src/store/slices/pageInfoSlice';
import type { AppDispatch } from '@src/store';
import { useDispatch } from 'react-redux';
import { usePageInfoUpdate } from '@src/lib/hooks/usePageInfoUpdate';
import { CoinHeader } from './CoinHeader';
import { StrategyHeader } from './StrategyHeader';
import { TrackerHeader } from './TrackerHeader';

interface TabItem {
  id: number;
  title: string;
  select: boolean;
}

// 兼容 TendBox 的 StrategyItem 类型 (label: ReactNode)
interface TendBoxStrategyItem {
  label: React.ReactNode;
  value: string;
}

type StreamingType = 'analyse' | 'recommend' | null;

export const Politer = memo(() => {
  const { t, locale } = useI18n();
  usePageInfoUpdate('poliet', locale);
  const tAny = t as unknown as Record<string, any>;
  const dispatch = useDispatch<AppDispatch>();
  const isLogin = useSelector((state: RootState) => state.user?.isLogin ?? false);
  const isOpen = useSelector((state: RootState) => state.ui.isSidePanelOpen);

  const [btns, setBtns] = useState<TabItem[]>([
    { id: 1, title: 'Picker', select: true },
    { id: 2, title: 'Tracker', select: false },
  ]);

  // 当翻译加载完成后更新按钮文本
  useEffect(() => {
    setBtns([
      { id: 1, title: t.agent?.picker || 'Picker', select: btns[0]?.select ?? true },
      { id: 2, title: t.agent?.tracker || 'Tracker', select: btns[1]?.select ?? false },
    ]);
  }, [t]);

  const [searchStr, setSearchStr] = useState<string>('');
  const [streamingModal, setStreamingModal] = useState<{
    isOpen: boolean;
    type: StreamingType;
    query: string;
    coinSymbol?: string;
    title?: ReactNode;
  }>({
    isOpen: false,
    type: null,
    query: '',
  });

  const selectId = btns.find(btn => btn.select)?.id ?? null;

  const handleClick = (btn: TabItem) => {
    setBtns(btns.map(b => ({ ...b, select: b.id === btn.id })));
    if (btn.id === 1) {
      dispatch(
        setPageInfo({
          page: 'poliet',
          info: {
            title: t.agent?.picker || 'Picker Agent',
            description: t.agent?.pickerAgentDesc || 'Analyze Binance spot and futures markets',
          },
        }),
      );
    } else {
      dispatch(
        setPageInfo({
          page: 'poliet',
          info: {
            title: t.agent?.tracker || 'Tracker Agent',
            description: t.agent?.trackerAgentDesc || 'Filter Binance spot tokens by technical indicators',
          },
        }),
      );
    }
  };

  const handleSearch = (value: string) => {
    setSearchStr(value);
  };

  // 处理币种分析
  const handleCoinAnalyze = async (symbol: string, coinType: number, logo: string) => {
    if (!isLogin) {
      message.warning(tAny?.common?.pleaseLogin ?? 'Please login first');
      return;
    }
    const typeStr = coinType === 2 ? (tAny?.agent?.contract ?? 'contract') : '';
    const query = `${tAny?.agent?.analyze ?? 'Analyze'} ${symbol} ${typeStr}`.trim();

    setStreamingModal({
      isOpen: true,
      type: 'analyse',
      query,
      coinSymbol: symbol,
      title: (
        <CoinHeader
          symbol={symbol}
          type={coinType === 1 ? 'SPOT' : 'FUTURE'}
          priceLoop={true}
          logo={`https://cdn.linklayer.ai/coinimages/${logo}`}
          tradingUrl={`https://www.binance.com/en/trade/${symbol.split('USDT')[0].toUpperCase()}_USDT?type=spot`}></CoinHeader>
      ),
    });
  };

  // 处理策略分析
  const handleStrategyAnalyze = async (strategy: TendBoxStrategyItem) => {
    if (!isLogin) {
      message.warning(tAny?.common?.pleaseLogin ?? 'Please login first');
      return;
    }

    // 将 ReactNode 转换为字符串
    const labelStr = typeof strategy.label === 'string' ? strategy.label : String(strategy.label);
    const query = `${labelStr} ${strategy.value}`;
    setStreamingModal({
      isOpen: true,
      type: 'recommend',
      query,
      title: <TrackerHeader title={strategy.label} desc={strategy.value}></TrackerHeader>,
    });
  };

  // 关闭弹窗
  const handleCloseModal = () => {
    setStreamingModal({
      isOpen: false,
      type: null,
      query: '',
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mt-[2vh] flex gap-[10px]">
        {btns.map(btn => (
          <button
            key={btn.id}
            style={{ fontSize: 12 }}
            className={`rounded-full px-4 py-2 font-bold ${btn.select ? 'bg-[#cf0] text-black' : 'bg-[#F4FFC8] text-gray-400'}`}
            onClick={() => handleClick(btn)}>
            {btn.title}
          </button>
        ))}
        {selectId === 1 && (
          <div className="absolute right-0 w-[180px]">
            <Input
              search
              allowClear
              value={searchStr}
              onChange={e => setSearchStr(e.target.value)}
              onSearch={handleSearch}
              placeholder={t.agent?.searchPlaceholder || 'Search for more tokens to ask Agent'}
            />
          </div>
        )}
      </div>

      {selectId === 1 && (
        <div className="mt-4 flex flex-col overflow-hidden rounded-[8px] border-[1px] border-black bg-white">
          <CoinList
            isOpen={isOpen}
            isLogin={isLogin}
            searchStr={searchStr}
            onConsultClick={(symbol, logo) => handleCoinAnalyze(symbol, 1, logo)}
            onContractClick={(symbol, logo) => handleCoinAnalyze(symbol, 2, logo)}
          />
        </div>
      )}

      {selectId === 2 && (
        <div>
          <TendBox onAnalyze={handleStrategyAnalyze} />
        </div>
      )}

      {/* 流式弹窗 */}
      {streamingModal.isOpen && streamingModal.type && (
        <StreamingModal
          isOpen={streamingModal.isOpen}
          onClose={handleCloseModal}
          type={streamingModal.type}
          query={streamingModal.query}
          coinSymbol={streamingModal.coinSymbol}
          title={streamingModal.title}
          isLogin={isLogin}
        />
      )}
    </div>
  );
});

Politer.displayName = 'Politer';
