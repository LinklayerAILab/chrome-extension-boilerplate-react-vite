import { memo, useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@src/store';
import { useI18n } from '@src/lib/i18n';
import { setPageInfo } from '@src/store/slices/pageInfoSlice';
import { usePageInfoUpdate } from '@src/lib/hooks/usePageInfoUpdate';
import { Input } from '@src/ui';
import { HistoryOutlined } from '@ant-design/icons';
import { AddWatchTab } from './AddWatchTab';
import { WatchListTab } from './WatchListTab';
import { DailyReportTab } from './DailyReportTab';
import { AddMoreIcon } from './AddMoreIcon';

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

  /**
   * Add Watch 的搜索词提升到这里：搜索框移到了 tab 条右侧，需要与 AddWatchTab
   * 共享同一份状态。顺带让「切到别的 tab 再切回来」保留搜索词（原先 state 在
   * AddWatchTab 内，切走重挂载即清空）。
   */
  const [addWatchSearch, setAddWatchSearch] = useState('');

  /**
   * 日报的报告日期（后端 SSE start 事件里的 report_date）。
   * null = 尚未收到 start 事件（流未开始/未生成）。
   */
  const [reportDate, setReportDate] = useState<string | null>(null);

  /**
   * 日报 tab 右侧：显示日报的报告日期（report_date）。
   *
   * 数据来自 SSE start 事件（后端按 BJT 02:00 截断的「报告日期」），
   * 不是订阅到期时间 —— 两者语义完全不同。
   * 无日期（流未开始 / 尚无日报）时**不渲染该组件**，避免占位显示无关信息。
   */
  const reportDateBadge = useMemo(() => {
    if (!reportDate) return null;

    const date = new Date(reportDate);
    if (Number.isNaN(date.getTime())) {
      // 后端若返回非标准日期串，原样展示而非丢弃
      return { text: reportDate, title: reportDate };
    }
    return {
      text: `${tAny?.guard?.dailyReportDate || 'Report date'}：${date.toLocaleDateString(locale)}`,
      title: date.toLocaleString(locale),
    };
  }, [locale, reportDate, tAny]);

  const tabs: Array<{ id: TabId; title: string; desc: string }> = [
    {
      id: 1,
      title: tAny?.guard?.addWatch || 'Add',
      desc: tAny?.guard?.addWatchDesc || 'Search and add tokens listed on Binance CEX + BNB Chain DEX',
    },
    {
      id: 2,
      title: tAny?.guard?.watchList || 'Follow',
      desc: tAny?.guard?.watchListDesc || 'Liquidity status of tokens you are following',
    },
    {
      id: 3,
      title: tAny?.guard?.dailyReport || 'Daily',
      desc: tAny?.guard?.dailyReportDesc || 'Daily interpretation of liquidity reports for your watched tokens',
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

  /**
   * 打开消息历史（options 页的消息中心）。
   *
   * 经 background 的 chrome.tabs.create 打开：content script 里直接 window.open
   * 扩展页容易被弹窗拦截，且拿不到用户激活手势。
   */
  const handleOpenMessageHistory = useCallback(() => {
    const url = chrome.runtime.getURL('options/index.html');
    chrome.runtime.sendMessage({ type: 'OPEN_URL', url }, response => {
      if (chrome.runtime.lastError || !response?.success) {
        console.warn('[Politer] Failed to open message history:', chrome.runtime.lastError ?? response?.error);
      }
    });
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 text-black">
      {/*
        tab 条：左侧 tabs，右侧为该 tab 的专属控件。
        「添加」显示搜索框、「关注」显示消息历史链接 + 添加按钮、「日报」显示描述，
        三者互斥，高度统一为 34px 与 tab 齐平。
      */}
      <div className="flex shrink-0 items-center gap-2 pb-1">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`shrink-0 rounded-full px-4 py-2.5 text-[12px] font-bold transition-colors ${
                activeTab === tab.id ? 'bg-[#CCFF00] text-black' : 'bg-[#F4FFC8] text-[#849638]'
              }`}
              onClick={() => handleSelectTab(tab.id)}>
              {tab.title}
            </button>
          ))}
        </div>
        {activeTab === 1 && (
          // h-[34px]：与 tab 高度对齐（tab 为 12px 文字 + py-2.5 ≈ 34px）。
          // Input 的 size 变体会强行写死 40/44px，故用 className 覆盖而非 size。
          <div className="w-[210px] shrink-0">
            <Input
              search
              allowClear
              size="small"
              value={addWatchSearch}
              onChange={e => setAddWatchSearch(e.target.value)}
              placeholder={tAny?.guard?.searchPlaceholder || 'Search token name / symbol / contract'}
              className="!h-[34px]"
            />
          </div>
        )}
        {activeTab === 2 && (
          <>
            {/*
              消息历史：打开 options 页的消息中心。
              走 background 的 OPEN_URL 而非 window.open —— 扩展页与外部页
              都在新标签打开，且不受 content script 弹窗拦截限制。
              图标点击域：36×34 的可点区域，图标 18px 居中；文案走 aria-label。
            */}
            <button
              type="button"
              onClick={handleOpenMessageHistory}
              aria-label={tAny?.guard?.messageHistory || 'Messages'}
              title={tAny?.guard?.messageHistory || 'Messages'}
              className="flex h-[34px] w-9 shrink-0 items-center justify-center rounded-full bg-[#F4FFC8] text-[16px] text-black transition-colors hover:bg-[#cf0]">
              <HistoryOutlined />
            </button>
            <button
              type="button"
              onClick={() => handleSelectTab(1)}
              className="flex h-[34px] w-[150px] shrink-0 items-center justify-between gap-2 rounded-lg border-2 border-black bg-white px-3 text-black transition-colors hover:bg-[#F4FFC8]">
              <span className="flex min-w-0 items-center gap-2">
                <AddMoreIcon />
                <span className="truncate text-[12px] font-semibold">{tAny?.guard?.addMore || 'Add Tokens'}</span>
              </span>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white text-base font-semibold leading-none">
                +
              </span>
            </button>
          </>
        )}
        {activeTab === 3 && reportDateBadge && (
          // 日报右侧：仅在有报告日期时渲染。无日期不占位，右侧留空。
          <div
            title={reportDateBadge.title}
            className="flex h-[34px] w-[210px] shrink-0 items-center justify-center rounded-lg bg-[#EAEAEA] px-3 text-[12px] font-semibold leading-tight text-black/70">
            <span className="truncate">{reportDateBadge.text}</span>
          </div>
        )}
      </div>

      {/* 内容区占满剩余高度，由各 tab 自己决定内部滚动区域 */}
      <div className="flex min-h-0 flex-1 flex-col">
        {activeTab === 1 && <AddWatchTab isOpen={isOpen} searchStr={addWatchSearch} />}
        {activeTab === 2 && <WatchListTab isOpen={isOpen} />}
        {activeTab === 3 && <DailyReportTab onReportDate={setReportDate} />}
      </div>
    </div>
  );
});

Politer.displayName = 'Politer';
