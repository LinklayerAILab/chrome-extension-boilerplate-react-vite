import { memo, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@src/store';
import { useI18n } from '@src/lib/i18n';
import { setPageInfo } from '@src/store/slices/pageInfoSlice';
import { usePageInfoUpdate } from '@src/lib/hooks/usePageInfoUpdate';
import { AddWatchTab } from './AddWatchTab';
import { WatchListTab } from './WatchListTab';
import { DailyReportTab } from './DailyReportTab';
import { GuardEntitlementBar } from './GuardEntitlementBar';

type TabId = 1 | 2 | 3;

/**
 * Politer（Piloter）模块：合并 bodyguard-app 三模块为 tab 切换。
 * 1 = Add Watch（搜索代币 + 关注）
 * 2 = Watch List（关注列表 + 健康灯球卡片）
 * 3 = Daily Report（AI 日报 SSE 流）
 * 仅渲染当前 tab：切换即重挂载刷新，替代 bodyguard 的 React Query 缓存联动。
 */
export const Politer = memo(() => {
  const { t, locale } = useI18n();
  usePageInfoUpdate('poliet', locale);
  const tAny = t as unknown as Record<string, any>;
  const dispatch = useDispatch<AppDispatch>();
  const isOpen = useSelector((state: RootState) => state.ui.isSidePanelOpen);

  const [activeTab, setActiveTab] = useState<TabId>(1);

  const tabs: Array<{ id: TabId; title: string; desc: string }> = [
    {
      id: 1,
      title: tAny?.guard?.addWatch || 'Add watch',
      desc: tAny?.guard?.addWatchDesc || 'Search and watch Binance tokens',
    },
    {
      id: 2,
      title: tAny?.guard?.watchList || 'Watch List',
      desc: tAny?.guard?.watchListDesc || 'Liquidity health for every watched token',
    },
    {
      id: 3,
      title: tAny?.guard?.dailyReport || 'Daily',
      desc:
        tAny?.guard?.dailyReportDesc ||
        'Health check on every coin you watch, delivered at 02:00 daily — calm days included.',
    },
  ];

  const handleSelectTab = useCallback(
    (id: TabId) => {
      setActiveTab(id);
      const tab = tabs.find(item => item.id === id);
      if (tab) {
        dispatch(
          setPageInfo({
            page: 'poliet',
            info: { title: tab.title, description: tab.desc },
          }),
        );
      }
    },
    // tabs 由 t 派生，语言切换后随闭包更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, tAny],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 text-black">
      {/* 权益横幅挂在 tab 条上方：三个 tab 都可见（Politer 只挂载激活 tab） */}
      <div className="shrink-0 empty:hidden">
        <GuardEntitlementBar isOpen={isOpen} />
      </div>
      <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`shrink-0 rounded-lg border-2 border-black px-3 py-2 text-[12px] font-bold transition-colors ${
              activeTab === tab.id ? 'bg-[#CCFF00] text-black' : 'bg-white text-black/45 hover:bg-[#F4FFC8]'
            }`}
            onClick={() => handleSelectTab(tab.id)}>
            {tab.title}
          </button>
        ))}
      </div>

      {/* 内容区占满剩余高度，由各 tab 自己决定内部滚动区域 */}
      <div className="flex min-h-0 flex-1 flex-col">
        {activeTab === 1 && <AddWatchTab isOpen={isOpen} />}
        {activeTab === 2 && <WatchListTab isOpen={isOpen} onGoAdd={() => setActiveTab(1)} />}
        {activeTab === 3 && <DailyReportTab />}
      </div>
    </div>
  );
});

Politer.displayName = 'Politer';
