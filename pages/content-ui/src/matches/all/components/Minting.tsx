import { useCallback, useEffect, useMemo, useState } from 'react';
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
const timeoutIcon = chrome.runtime.getURL('content-ui/platform/timeout.svg');
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
  const diff = 2592000000;
  const now = Date.now();
  const periodEnd = normalizeTimestamp(data.period_end);
  const claimTime = normalizeTimestamp(data.claim_time);

  const handleType = () => {
    if (data.period_start === 0) {
      return 0;
    }
    if (data.claim_flag) {
      return 1;
    }
    if (now - periodEnd > diff) {
      return 2;
    }
    return 3;
  };

  const handleClass = () => {
    if (data.claim_flag || handleType() === 0) {
      return 'bg-[#cf0] border-b-[#fff]';
    }
    if (now - periodEnd > diff) {
      return 'bg-[#CECECE] border-b-white lg:border-b-black';
    }
    return 'bg-[#cf0] border-b-[#fff]';
  };

  const handleImg = () => {
    if (handleType() === 0) {
      return clockIcon;
    }
    if (data.claim_flag) {
      return successIcon;
    }
    if (now - periodEnd > diff) {
      return timeoutIcon;
    }
    return clockIcon;
  };

  const dateText = handleType() === 0 ? '---' : handleType() === 1 ? formatDate(claimTime) : formatDate(periodEnd);

  return (
    <div className="h-[140px] rounded-[8px] bg-white lg:h-[16vh] lg:bg-[#ebebeb]">
      <div
        className={`${handleClass()} border-b-solid flex h-[50px] items-center justify-center border-b-[1px] lg:h-[5vh]`}>
        <span className="flex items-center gap-[6px] font-bold">
          <img src={dakaIcon} alt="daka" className="h-[16px] w-[16px]" />
          <span>{dateText}</span>
        </span>
      </div>
      <div>
        <div className="relative flex h-[38px] items-center justify-center py-[10px] lg:h-[6vh] lg:py-[1vh]">
          <img
            src={handleImg()}
            alt="status"
            className={`h-[28px] lg:h-[4vh] ${
              handleType() === 2 ? 'absolute top-[-10px] h-[48px] w-[48px] lg:top-[-1.7vh] lg:h-[8vh] lg:w-[8vh]' : ''
            }`}
          />
        </div>
        <div className="flex items-center justify-center font-bold">
          <div>
            <span>{data.claim_amount || '--'}</span> <span>LLAx</span>
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
  const initClaimList: ClaimInfoItem[] = useMemo(
    () =>
      Array.from({ length: 8 }).map(() => ({
        claim_flag: false,
        period_start: 0,
        period_end: 0,
        claim_time: 0,
        claim_amount: 0,
      })),
    [],
  );
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
    get_claim_info(params)
      .then(res => {
        if (!res.data.claim_info || res.data.claim_info.length === 0) {
          setClaimInfo([...initClaimList]);
          return;
        }
        setClaimInfo(res.data.claim_info);
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
  }, [selectCex, isLogin, fetchLiquidationData, initClaimList]);

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
            <div className="flex flex-col gap-[6px] p-[14px] lg:gap-[1vh] lg:p-0">
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

              <div className="absolute right-[20px] top-[22px]">
                <ReceiveBtn disabled>{t.home?.received || 'Received'}</ReceiveBtn>
              </div>
            </div>
          </ReceivedCard>

          <ReceivedCard
            bg="bg-[#C4BEFF]"
            title={t.home?.recurringRewards || 'Recurring Rewards'}
            desc={t.home?.recurringRewardsDesc || 'Claim your recurring rewards'}>
            <div className="flex flex-col gap-[6px] p-[14px] lg:gap-[1vh] lg:p-0">
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

              <div className="absolute right-[20px] top-[22px]">
                <ReceiveBtn>{t.home?.claim || 'Claim'}</ReceiveBtn>
              </div>
            </div>
          </ReceivedCard>
        </div>

        <div className="relative mt-[20px] h-[220px] w-full rounded-[8px] lg:mt-[2vh] lg:bg-[#fff]">
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
              className="flex h-full gap-[10px] overflow-x-auto overflow-y-hidden scroll-smooth lg:gap-[14px]"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#cf0 #eee',
              }}>
              {claimInfo.map((item, idx) => (
                <div
                  key={idx}
                  className="w-[44%] flex-shrink-0 cursor-pointer overflow-hidden rounded-[4px] lg:w-[200px]">
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
