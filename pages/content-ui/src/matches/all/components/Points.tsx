import { useSelector } from 'react-redux';
import { RootState } from '@src/store';
import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@src/lib/i18n';
import { Button, message } from '@src/ui';
import { query_tasks } from '@src/api/agent_c';
import type { QueryTasksItem, QueryTasksParams, QueryTasksResponse, QueryTasksType } from '@src/api/agent_c';
import { usePageInfoUpdate } from '@src/lib/hooks/usePageInfoUpdate';
import { getPayConfig, switchBscChain, getTokenBalance, executeTransfer } from '../lib/payment';
import { parseUnits } from 'viem';
const bookIcon = chrome.runtime.getURL('content-ui/points/book.svg');
const percent12 = chrome.runtime.getURL('content-ui/points/12percent.svg');
const percent20 = chrome.runtime.getURL('content-ui/points/20percent.svg');
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

interface PointsProps {
  walletConnected?: boolean;
  walletAddress?: string;
  providerId?: string;
  walletChainId?: string;
}

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

export const Points = ({
  walletConnected = false,
  walletAddress = '',
  providerId = '',
  walletChainId = '',
}: PointsProps) => {
  const { t, locale } = useI18n();
  usePageInfoUpdate('points', locale);
  const isLogin = useSelector((state: RootState) => state.user.isLogin);
  const isDev = process.env.CLI_CEB_DEV === 'true';

  // 充值选项列表
  const [list, setList] = useState<ListItem[]>([
    {
      value: 1,
      select: true,
      money: '9.9',
      count: 990,
    },
    {
      value: 2,
      select: false,
      money: '29.9',
      count: 3400,
    },
    {
      value: 3,
      select: false,
      money: '99.9',
      count: 12500,
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
      disabled: false,
    },
  ]);

  const [listLoading, setListLoading] = useState(true);
  const [records, setRecords] = useState<QueryTasksItem[]>([]);
  const params = useRef<QueryTasksParams>({
    page: 1,
    size: 1000,
  });
  const [recordsLoading, setRecordsLoading] = useState(true);

  // 支付状态
  const [payLoading, setPayLoading] = useState(false);

  // 等待确认提示（使用 message.loading）
  const waitingMsgRef = useRef<(() => void) | null>(null);
  const previousRecordsCountRef = useRef(0); // 交易前记录数
  const pollingActiveRef = useRef(false); // 轮询是否活跃
  const confirmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 获取积分记录列表
  const handleGetList = async () => {
    try {
      const res = await query_tasks(params.current);
      // service 拦截器返回 response.data，所以 res.data 是任务列表数据
      const data = res.data as { Res?: QueryTasksItem[]; Total?: number } | null;
      if (data?.Res) {
        const newRecords = data.Res;
        setRecords(newRecords);

        // 如果正在等待确认，且记录数有变化，说明交易已确认
        if (
          waitingMsgRef.current &&
          pollingActiveRef.current &&
          newRecords.length !== previousRecordsCountRef.current
        ) {
          pollingActiveRef.current = false;
          if (confirmIntervalRef.current) {
            clearInterval(confirmIntervalRef.current);
            confirmIntervalRef.current = null;
          }
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          waitingMsgRef.current();
          waitingMsgRef.current = null;
          message.success('Transaction confirmed');
        }
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

  // 支付处理
  const handlePay = async () => {
    const selectedItem = list.find(item => item.select);
    if (!selectedItem) {
      message.warning(t.common?.select ?? 'Please select a package');
      return;
    }

    // 如果 props 中没有钱包状态，尝试从 storage 读取作为兜底
    let effectiveWalletConnected = walletConnected;
    let effectiveWalletAddress = walletAddress;
    let effectiveProviderId = providerId;
    let effectiveWalletChainId = walletChainId;

    if (!walletConnected || !walletAddress) {
      try {
        // 尝试通过 background script 获取当前账户
        const accounts = await chrome.runtime.sendMessage({ type: 'WEB3_REQUEST', method: 'eth_accounts', args: [] });
        if (accounts?.result && accounts.result.length > 0) {
          effectiveWalletConnected = true;
          effectiveWalletAddress = accounts.result[0];
          // 获取 chainId 和 providerId
          const chainIdResult = await chrome.runtime.sendMessage({
            type: 'WEB3_REQUEST',
            method: 'eth_chainId',
            args: [],
          });
          effectiveWalletChainId = chainIdResult?.result || walletChainId;
          const providerIdResult = await new Promise<any>((resolve, reject) => {
            chrome.runtime.sendMessage({ type: 'GET_PROVIDER_ID' }, resolve);
          });
          effectiveProviderId = providerIdResult?.result || providerId;
          console.log('[Points] Recovered wallet state from storage:', {
            effectiveWalletConnected,
            effectiveWalletAddress,
            effectiveProviderId,
            effectiveWalletChainId,
          });
        }
      } catch (error) {
        console.warn('[Points] Failed to recover wallet state:', error);
      }
    }

    if (!effectiveWalletConnected || !effectiveWalletAddress) {
      message.error(t.loginPanel?.connectFirst ?? 'Please connect your wallet first');
      return;
    }

    const selectedCoin = coinList.find(item => item.select);
    if (!selectedCoin) {
      message.warning(t.common?.select ?? 'Please select a payment method');
      return;
    }

    setPayLoading(true);

    try {
      const config = getPayConfig(isDev);
      const tokenConfig = config.tokens[selectedCoin.value as 'usdt' | 'usdc'];
      if (!tokenConfig) {
        message.error('Unsupported payment method');
        return;
      }

      // 1. 先切换链，确保在正确链上查询余额
      const currentChainId = effectiveWalletChainId?.startsWith('0x')
        ? parseInt(effectiveWalletChainId, 16)
        : parseInt(effectiveWalletChainId, 10);
      if (currentChainId !== config.chainId) {
        await switchBscChain(config.chainId, effectiveProviderId);
        // 等待链切换完成
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 2. 检查余额
      const requiredAmount = parseUnits(selectedItem.money, tokenConfig.decimal);
      let balance: bigint;
      try {
        balance = await getTokenBalance(tokenConfig.address, effectiveWalletAddress, effectiveProviderId);
      } catch (error: any) {
        console.error('[Points] getTokenBalance failed:', error);
        const errorMsg = error?.message ?? 'Unknown error';
        message.error(`Failed to query ${tokenConfig.label} balance: ${errorMsg}`);
        return;
      }

      if (balance < requiredAmount) {
        const balanceStr = (Number(balance) / 10 ** tokenConfig.decimal).toFixed(2);
        message.error(
          `${t.common?.insufficientBalance ?? 'Insufficient balance'}: ${balanceStr} ${tokenConfig.label}, need ${selectedItem.money} ${tokenConfig.label}`,
        );
        return;
      }

      // 3. 执行转账
      const txHash = await executeTransfer(
        tokenConfig.address,
        config.payeeAddress,
        selectedItem.money,
        tokenConfig.decimal,
        effectiveWalletAddress,
        effectiveProviderId,
      );

      message.success(t.common?.transactionSubmitted ?? 'Transaction submitted');

      // 记录当前记录数，用于确认检测（使用实际 records 长度而不是 ref）
      previousRecordsCountRef.current = records.length;

      // 显示等待确认的 loading 弹层（设置最大等待时间 60 秒）
      waitingMsgRef.current = message.loading(
        t.myPoints?.waitingConfirmation ?? 'Waiting for chain confirmation...',
        60,
      );

      // 启动轮询标志
      pollingActiveRef.current = true;

      // 每2秒轮询一次，确认检测在 handleGetList 内部完成
      confirmIntervalRef.current = window.setInterval(() => {
        if (!pollingActiveRef.current) {
          if (confirmIntervalRef.current) {
            clearInterval(confirmIntervalRef.current);
            confirmIntervalRef.current = null;
          }
          return;
        }
        handleGetList();
      }, 2000);

      // 超时自动关闭（60秒，与 message.loading 的 duration 一致）
      timeoutRef.current = window.setTimeout(() => {
        if (waitingMsgRef.current) {
          waitingMsgRef.current();
          waitingMsgRef.current = null;
        }
        pollingActiveRef.current = false;
        if (confirmIntervalRef.current) {
          clearInterval(confirmIntervalRef.current);
          confirmIntervalRef.current = null;
        }
        timeoutRef.current = null;
      }, 60000);
    } catch (error: any) {
      message.error(error.message ?? t.common?.transactionFailed ?? 'Transaction failed');
    } finally {
      setPayLoading(false);
    }
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
                  {item.value === 2 && <img src={percent12} className="ml-[50px] h-[14px]"></img>}
                  {item.value === 3 && <img src={percent20} className="ml-[45px] h-[14px]"></img>}
                </div>
                <div className="flex items-center gap-[0.5vh]">
                  <span className="text-[14px]">${item.money}</span>
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
            <Button
              size="small"
              className="font-bold"
              style={{ background: '#cf0' }}
              block
              loading={payLoading}
              onClick={handlePay}>
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
