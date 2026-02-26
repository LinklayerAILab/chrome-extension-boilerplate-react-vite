import { useSelector } from 'react-redux';
import { RootState } from '@src/store';
import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@src/lib/i18n';
import { Button } from '@src/ui';
import { query_tasks } from '@src/api/agent_c';
import type { QueryTasksItem, QueryTasksParams, QueryTasksResponse, QueryTasksType } from '@src/api/agent_c';
import { usePageInfoUpdate } from '@src/lib/hooks/usePageInfoUpdate';
const bookIcon = chrome.runtime.getURL('content-ui/points/book.svg');
type ListItem = {
  value: number;
  select: boolean;
  money: string;
  count: number;
};

type CoinListItem = {
  label: string;
  value: string;
  select: boolean;
  icon: string;
  disabled: boolean;
};

// 日期格式化函数
const formatDate = (timestamp: number, format: string = 'MM/DD HH:mm') => {
  const date = new Date(timestamp);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

// 获取任务类型名称
const getTypeKey = (
  type: QueryTasksType,
): 'bind_web3' | 'bind_email' | 'follow_x' | 'telegram_group' | 'new_user' | 'invite_user' | 'subcribe' => {
  switch (type) {
    case 1:
      return 'bind_web3';
    case 2:
      return 'bind_email';
    case 3:
      return 'follow_x';
    case 4:
      return 'telegram_group';
    case 5:
      return 'new_user';
    case 6:
      return 'invite_user';
    case 7:
      return 'subcribe';
    default:
      return 'bind_web3'; // 默认值，避免返回空字符串
  }
};

export const Points = () => {
  const { t, locale } = useI18n();
  usePageInfoUpdate('points', locale);
  // const points = useSelector((state: RootState) => state.user.points);
  // const pointsLoading = useSelector((state: RootState) => state.user.pointsLoading);
  // const otherInfo = useSelector((state: RootState) => state.user.otherInfo);
  const isLogin = useSelector((state: RootState) => state.user.isLogin);

  // 充值选项列表
  const [list, setList] = useState<ListItem[]>([
    {
      value: 1,
      select: true,
      money: '9.9',
      count: 900,
    },
    {
      value: 2,
      select: false,
      money: '29.9',
      count: 3200,
    },
    {
      value: 3,
      select: false,
      money: '49.9',
      count: 6000,
    },
  ]);

  // 支付方式列表
  const [coinList, setCoinList] = useState<CoinListItem[]>([
    {
      label: 'USDT',
      value: 'usdt',
      select: true,
      icon: chrome.runtime.getURL('content-ui/points/usdt.svg'),
      disabled: false,
    },
    {
      label: 'USDC',
      value: 'usdc',
      select: false,
      icon: chrome.runtime.getURL('content-ui/points/usdc.svg'),
      disabled: true,
    },
  ]);

  const [listLoading, setListLoading] = useState(true);
  const [records, setRecords] = useState<QueryTasksItem[]>([]);
  const params = useRef<QueryTasksParams>({
    page: 1,
    size: 1000,
  });
  const [recordsLoading, setRecordsLoading] = useState(true);

  // 获取积分记录列表
  const handleGetList = async () => {
    try {
      const res = await query_tasks(params.current);
      // service 拦截器返回 response.data，所以 res.data 是任务列表数据
      // 使用类型守卫和类型断言
      const data = res.data as { Res?: QueryTasksItem[]; Total?: number } | null;
      if (data?.Res) {
        setRecords(data.Res);
      } else {
        setRecords([]);
      }
    } finally {
      setRecordsLoading(false);
    }
  };

  // 处理 list 项点击
  const handleListItemClick = (clickedValue: number) => {
    setList(prevList =>
      prevList.map(item => ({
        ...item,
        select: item.value === clickedValue,
      })),
    );
  };

  // 处理 coinList 项点击
  const handleCoinListClick = (item: CoinListItem) => {
    if (item.disabled) {
      return;
    }
    if (item.select) {
      return;
    }
    setCoinList(prevList =>
      prevList.map(coin => ({
        ...coin,
        select: coin.value === item.value,
      })),
    );
  };

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const t2 = setTimeout(() => {
      setListLoading(false);
    }, 500);

    if (isLogin) {
      handleGetList();
      // 每8秒刷新一次数据
      intervalId = setInterval(() => {
        handleGetList();
      }, 8000);
    } else {
      // 未登录时延迟结束加载状态
      const t3 = setTimeout(() => {
        setRecordsLoading(false);
        clearTimeout(t3);
      }, 1000);
    }

    return () => {
      clearTimeout(t2);
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLogin]);

  const pointerIcon = chrome.runtime.getURL('content-ui/points/money.svg');
  const rightIcon = chrome.runtime.getURL('content-ui/points/success.svg');

  return (
    <div className="flex flex-col gap-4 text-black">
      {/* 充值区域 */}
      <div className="flex-1 rounded-[8px] bg-white">
        <div className="mb-[1vh] flex items-center justify-start text-[14px] font-bold">
          {t.myPoints?.rechargePoints || 'Points'}
        </div>

        <>
          <div className="mt-[1vh] flex flex-col gap-[1vh]">
            {list.map(item => (
              <div
                key={item.value}
                className="flex h-[5.6vh] cursor-pointer items-center justify-between rounded-[8px] bg-[#EBEBEB] px-[12px] text-[12px] font-bold"
                onClick={() => handleListItemClick(item.value)}>
                <div className="flex items-center gap-[0.5vh]">
                  <div className="flex h-[2.4vh] w-[2.4vh] items-center justify-center rounded-full bg-black">
                    <img
                      src={pointerIcon}
                      alt="pointer"
                      className="w-[1.8vh]"
                      style={{ transform: 'translate(1px)' }}
                    />
                  </div>
                  {item.count}
                </div>
                <div className="flex items-center gap-[0.5vh]">
                  <span>$ {item.money}</span>
                  <div
                    className={`flex h-[2.2vh] w-[2.2vh] items-center justify-center rounded-full border-[2px] border-solid border-black ${
                      item.select ? 'bg-[#DFFF67]' : ''
                    }`}>
                    {item.select ? <img src={rightIcon} alt="right" className="w-[1.2vh]" /> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-[14px] text-[12px] font-bold">{t.myPoints?.paymentMethod || 'Payment Method'}</div>

          <div className="mt-[8px] flex flex-wrap justify-between gap-[8px]">
            {coinList.map(item => (
              <div
                className={`flex h-[42px] w-[calc(50%-4px)] items-center justify-between rounded-[8px] bg-[#EBEBEB] px-[12px] ${
                  item.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                }`}
                key={item.value}
                onClick={() => handleCoinListClick(item)}>
                <div className="flex items-center gap-[6px]">
                  <img src={item.icon} className="h-[2.2vh] w-[2.2vh]" alt="icon" />
                  <span className="text-[11px] font-bold">{item.label}</span>
                </div>

                <div
                  className={`flex h-[2.2vh] w-[2.2vh] items-center justify-center rounded-full border-[2px] border-solid border-black ${
                    item.select ? 'bg-[#DFFF67]' : ''
                  }`}>
                  {item.select ? <img src={rightIcon} alt="right" className="w-[1.2vh]" /> : null}
                </div>
              </div>
            ))}
          </div>

          {/* 充值按钮 */}
          <div className="mt-[2vh] flex cursor-pointer select-none items-center justify-center rounded-[5px]">
            <Button size="large" className="font-bold" style={{ background: '#cf0' }} block>
              {t.myPoints?.recharge || 'Recharge'}
            </Button>
          </div>
        </>
      </div>

      {/* 积分记录列表 */}
      <div className="rounded-[8px] bg-white py-[1vh]">
        <div className="flex items-center justify-start gap-[4px] text-[14px] font-bold">
          <img src={bookIcon} className="w-[16px]" alt="points" />
          {t.myPoints?.pointsRecord || 'Points Record'}
        </div>

        <div className="mt-[1vh] overflow-hidden rounded-[6px] border-[2px] border-solid border-black">
          {/* 表头 */}
          <div className="flex h-[36px] items-center bg-[#cf0] text-[12px] text-[#7E9D00]">
            <div className="flex w-[100px] items-center justify-start pl-[12px] text-[11px] font-bold">
              {t.common?.time || 'Time'}
            </div>
            <div className="flex flex-1 items-center justify-center text-[11px] font-bold">
              {t.common?.type || 'Type'}
            </div>
            <div className="flex w-[80px] items-center justify-end pr-[12px] text-[11px] font-bold">
              {t.common?.points || 'Points'}
            </div>
          </div>

          {recordsLoading ? (
            // 骨架屏加载
            <div className="space-y-2 py-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex animate-pulse items-center justify-between gap-[4%]">
                  <div className="h-[3vh] w-[35%] rounded bg-gray-200"></div>
                  <div className="h-[3vh] w-[35%] rounded bg-gray-200"></div>
                  <div className="h-[3vh] w-[25%] rounded bg-gray-200"></div>
                </div>
              ))}
            </div>
          ) : records.length > 0 ? (
            <div className="min-h-[34vh] overflow-y-auto">
              {
                // 记录列表
                records.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex h-[5vh] items-center justify-evenly border-b border-gray-100 px-3 text-[12px] font-bold last:border-0">
                    {/* Time */}
                    <div className="flex w-[100px] items-center justify-start text-gray-600">
                      {item.timestamp ? formatDate(item.timestamp * 1000, 'MM/DD HH:mm') : '-'}
                    </div>
                    {/* Type */}
                    <div className="flex flex-1 items-center justify-center pl-[12px] font-bold text-gray-700">
                      {item.type ? (t.subscribe?.[getTypeKey(item.type)] ?? getTypeKey(item.type)) : '-'}
                    </div>

                    {/* Points */}
                    <div className="flex w-[80px] items-center justify-end font-bold">+{item.point || '0'}</div>
                  </div>
                ))
              }
            </div>
          ) : (
            // 空状态
            <div className="flex h-[30vh] items-center justify-center text-[12px] text-gray-500">
              {t.common?.noData || 'No Data'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
