import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@src/store';
import { useI18n } from '@src/lib/i18n';
import { service } from '@src/api/service';
import { get_claim_info, position_symbols } from '@src/api/agent_c';
import type { ClaimInfoItem, PositionSymbolsItem } from '@src/api/agent_c';
import { PlatformList } from './PlatformList';
import { Popover } from '@src/ui';
import { usePageInfoUpdate } from '@src/lib/hooks/usePageInfoUpdate';
const question = chrome.runtime.getURL('content-ui/minting/question.svg');
const dakaIcon = chrome.runtime.getURL('content-ui/platform/daka.svg');
const successIcon = chrome.runtime.getURL('content-ui/platform/successIcon.svg');
const clockIcon = chrome.runtime.getURL('content-ui/platform/clock.svg');
export interface LiquidationCalculatedRequest {
  cex_name: string;
}

export interface AgentCResponse {
  code: number;
  msg?: string;
  data?: unknown;
}

export interface LiquidationCalculatedResponse extends AgentCResponse {
  data: {
    loss_count: number;
    period_start: number;
    period_end: number;
  };
}

const normalizeTimestamp = (value?: number) => {
  if (!value) return 0;
  return value < 1_000_000_000_000 ? value * 1000 : value;
};

const formatDate = (value?: number) => {
  const ts = normalizeTimestamp(value);
  if (!ts) return '-';
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const useCountdown = (target?: number) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const targetMs = normalizeTimestamp(target);
  const diff = Math.max(targetMs - now, 0);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (value: number) => String(value).padStart(2, '0');
  return `${days} days ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const ReceivedCard = ({
  bg,
  title,
  desc,
  children,
}: {
  bg: string;
  title: string;
  btn: ReactNode;
  desc: string;
  children: ReactNode;
}) => {
  return (
    <div className={`relative w-full flex-1 rounded-[8px] bg-[#EBEBEB] p-[10px]`}>
      <div
        className={`flex h-[60px] items-center justify-between rounded-[8px] p-[14px] text-[16px] font-bold text-black ${bg}`}>
        <div className="receive-card-title flex items-center gap-2 text-[14px]">
          {title}
          <Popover content={<div>{desc}</div>}>
            <img src={question}></img>
          </Popover>
        </div>
        <div></div>
      </div>
      {/* <div className="text-[12px] text-black/70 mt-[4px] px-[14px]">{desc}</div> */}
      <div className="mt-[10px]">{children}</div>
    </div>
  );
};

const LabelAndVal = ({ label, value, className }: { label: string; value: ReactNode; className?: string }) => {
  return (
    <div
      className={`flex items-center justify-between rounded-[4px] bg-white p-[10px] text-[12px] text-black ${className || ''}`}>
      <span className="text-[12px] text-[#676767]">{label}</span>
      <span className="italic">{value}</span>
    </div>
  );
};

const ReceiveBtn = ({
  children,
  disabled,
  className,
}: {
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) => {
  return (
    <div
      className={`h-[36px] w-[132px] rounded-[6px] border border-black bg-white transition-all ${disabled ? 'cursor-not-allowed border-[#D9D9D9]' : 'cursor-pointer'}`}>
      <button
        type="button"
        disabled={disabled}
        className={`block h-[31px] w-full rounded-[4px] py-[6px] text-[12px] font-bold ${
          disabled
            ? 'cursor-not-allowed bg-[#e5e5e5] text-[#666]'
            : 'cursor-pointer bg-black text-white active:bg-[#222]'
        } ${className || ''}`}>
        {children}
      </button>
    </div>
  );
};

const ReceiveSlide = ({ data }: { data: ClaimInfoItem }) => {
  const isPlaceholder = !data.id;
  const { t } = useI18n();

  const getChannelLabel = () => {
    if (data.channel_id === 2) return t.home?.oneTime || 'One-Time';
    if (data.channel_id === 3) return t.home?.monthly || 'Monthly';
    return data.channel_type || '';
  };

  return (
    <div className="h-[140px] rounded-[8px] bg-white lg:h-[14vh] lg:bg-[#ebebeb]">
      <div
        className={`border-b-solid flex h-[50px] items-center justify-center border-b-[1px] border-b-[#fff] bg-[#cf0] lg:h-[5vh]`}>
        <span className="flex items-center gap-[6px] font-bold">
          <img src={dakaIcon} alt="daka" className="h-[16px] w-[16px]" />
          <span className="text-[14px]">{isPlaceholder ? '---' : formatDate(new Date(data.created_at).getTime())}</span>
        </span>
      </div>
      <div>
        <div
          className={`relative flex items-center justify-center ${
            data.channel_id ? 'h-[38px] lg:h-[3.5vh]' : 'h-[52px] py-1 lg:h-[5vh]'
          }`}>
          <img
            src={isPlaceholder ? clockIcon : successIcon}
            alt="status"
            className={`${data.channel_id ? 'h-[28px] lg:h-[2vh]' : 'h-[28px] lg:h-[3vh]'}`}
          />
        </div>
        <div className="flex items-center justify-center text-[12px] font-bold">
          <div className="text-center">
            {data.channel_type && <div>{isPlaceholder ? '--' : getChannelLabel()}</div>}
            <div>
              <span className="text-[12px]">{isPlaceholder ? '--' : data.amount}</span> <span>LLAx</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Minting = () => {
  const { t, locale } = useI18n();
  const selectCex = useSelector((state: RootState) => state.assets.selectCex);
  const isLogin = useSelector((state: RootState) => state.user.isLogin);

  // 监听语言切换事件，更新页面标题和描述
  usePageInfoUpdate('earn', locale);
  const [calculated, setCalculated] = useState<LiquidationCalculatedResponse>();
  const [undue, setUndue] = useState<LiquidationCalculatedResponse>();
  const initClaimList: ClaimInfoItem[] = Array.from({ length: 8 }, () => ({
    id: 0,
    user_id: '',
    channel_id: 0,
    channel_type: '',
    reference_id: '',
    amount: 0,
    before_balance: 0,
    after_balance: 0,
    pool_before: 0,
    pool_after: 0,
    created_at: '',
  }));
  const [claimInfo, setClaimInfo] = useState<ClaimInfoItem[]>([...initClaimList]);
  const [, setPositionSymbols] = useState<PositionSymbolsItem[]>([]);

  const fetchLiquidationData = useCallback(async () => {
    const params: LiquidationCalculatedRequest = { cex_name: selectCex.toLowerCase() };
    const resUndue = await service.post<LiquidationCalculatedResponse>('/v1/liquidation_undue', params);
    setUndue(resUndue);
    const resCalculated = await service.post<LiquidationCalculatedResponse>('/v1/liquidation_calculated', params);
    setCalculated(resCalculated);
  }, [selectCex]);

  useEffect(() => {
    if (!isLogin) {
      setClaimInfo([...initClaimList]);
      setUndue(undefined);
      setCalculated(undefined);
      setPositionSymbols([]);
      return;
    }

    const params = { cex_name: selectCex.toLowerCase() };
    get_claim_info({ cex_name: selectCex.toLowerCase(), channel_ids: [2, 3] })
      .then(res => {
        const records = res.data?.records ?? [];
        setClaimInfo(records.length > 0 ? records : [...initClaimList]);
      })
      .catch(() => {
        setClaimInfo([...initClaimList]);
      });

    fetchLiquidationData();

    position_symbols(params)
      .then(res => {
        setPositionSymbols(res.data.symbols || []);
      })
      .catch(() => {
        setPositionSymbols([]);
      });

    const calculatedInterval = window.setInterval(() => {
      service.post<LiquidationCalculatedResponse>('/v1/liquidation_calculated', params).then(res => {
        setCalculated(res);
      });
    }, 10000);

    return () => {
      window.clearInterval(calculatedInterval);
    };
  }, [selectCex, isLogin, fetchLiquidationData]);

  const countdown = useCountdown(undue?.data?.period_end);

  const clock2 = chrome.runtime.getURL('content-ui/platform/clock2.svg');
  const book2 = chrome.runtime.getURL('content-ui/platform/book2.svg');

  return (
    <div className="mt-[10px] flex flex-col gap-4 text-black">
      <PlatformList />

      <div
        className="relative mt-[14px] h-auto w-full rounded-[8px] bg-[#ebebeb] p-[14px] lg:bg-[#fff] lg:p-0"
        id="context-box-2">
        <div className="flex flex-col items-center justify-between gap-[14px]">
          <ReceivedCard
            bg="bg-[#EBFF99]"
            title={t.home?.retroactiveBonus || 'Retroactive Bonus'}
            desc={t.home?.retroactiveBonusDesc || 'Claim your retroactive bonus'}>
            <div className="flex flex-col gap-[6px]">
              <LabelAndVal
                label={t.home?.ready || 'Ready'}
                value={t.home?.claimAllBonuses || 'Claim All Bonuses at Once'}
              />
              <LabelAndVal
                label={t.home?.cycle || 'Cycle'}
                value={`${formatDate(calculated?.data?.period_start)} - ${formatDate(calculated?.data?.period_end)}`}
              />
              <LabelAndVal
                label={t.home?.liquidation || 'Liquidation'}
                value={`${calculated?.data?.loss_count || '-'} ${t.home?.times || 'times'}`}
              />
              <LabelAndVal label={t.home?.bonus || 'Bonus'} value={<span className="text-shadow-white">- LLAx</span>} />
            </div>
          </ReceivedCard>

          <ReceivedCard
            bg="bg-[#C4BEFF]"
            title={t.home?.recurringRewards || 'Recurring Rewards'}
            desc={t.home?.recurringRewardsDesc || 'Claim your recurring rewards'}>
            <div className="flex flex-col gap-[6px]">
              <LabelAndVal
                label={t.home?.countdown || 'Countdown'}
                value={
                  <div className="flex items-center gap-2">
                    <img src={clock2} className="w-[16px]" alt="clock" />
                    <span className="text-[12px]">{countdown}</span>
                  </div>
                }
              />
              <LabelAndVal
                label={t.home?.cycle || 'Cycle'}
                value={`${formatDate(undue?.data?.period_start)} - ${formatDate(undue?.data?.period_end)}`}
              />
              <LabelAndVal
                label={t.home?.liquidation || 'Liquidation'}
                value={`${undue?.data?.loss_count || '-'} ${t.home?.times || 'times'}`}
              />
              <LabelAndVal
                label={t.home?.rewards || 'Rewards'}
                value={<span className="text-shadow-white">- LLAx</span>}
              />
            </div>
          </ReceivedCard>
        </div>

        <div className="mt-[20px] w-full lg:mt-[2vh]">
          <style>{`
            #date-swiper::-webkit-scrollbar {
              height: 4px;
            }
            #date-swiper::-webkit-scrollbar-track {
              background: transparent;
            }
            #date-swiper::-webkit-scrollbar-thumb {
              background-color: #cf0;
              border-radius: 4px;
            }
            #date-swiper::-webkit-scrollbar-thumb:hover {
              background-color: #abd501;
            }
          `}</style>
          <div className="mb-[14px] flex items-center text-[16px] font-bold lg:mb-[1vh]">
            <img src={book2} alt="book2" className="mr-[6px]" />
            {t.home?.claimHistory || 'Claim History'}
          </div>
          <div className="h-[150px] w-full lg:h-[18vh]">
            <div
              id="date-swiper"
              className="flex h-[16vh] gap-[10px] overflow-x-auto overflow-y-hidden scroll-smooth lg:gap-[14px]"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#cf0 #eee',
              }}>
              {claimInfo.map((item, idx) => (
                <div
                  key={idx}
                  className="mb-[1vh] h-[15vh] min-w-[200px] max-w-[200px] flex-shrink-0 cursor-pointer overflow-hidden rounded-[4px]">
                  <ReceiveSlide data={item} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
