import { useSelector } from 'react-redux';
import { RootState } from '@src/store';
import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@src/lib/i18n';
import { Button, message } from '@src/ui';
import { query_tasks } from '@src/api/agent_c';
import type { QueryTasksItem, QueryTasksParams, QueryTasksResponse, QueryTasksType } from '@src/api/agent_c';
import { stripe_checkout, savePendingOrder, STRIPE_ERROR_CODES, PACKAGE_BY_LIST_VALUE } from '@src/api/stripe';
import type { StripeCheckoutData } from '@src/api/stripe';
import { usePageInfoUpdate } from '@src/lib/hooks/usePageInfoUpdate';
import {
  getPayConfig,
  switchBscChain,
  getTokenBalance,
  executeTransfer,
  executeViaBackgroundScript,
} from '../lib/payment';
import { getLastProviderId } from '../lib/walletStorage';
import { parseUnits } from 'viem';
import { StripeResult } from './StripeResult';
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
  // 钱包重连成功后同步回 App（App 是钱包状态的唯一写者）
  onWalletReconnected?: (state: { address: string; chainId: string | null; providerId?: string }) => void;
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
  onWalletReconnected,
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
    {
      label: t.myPoints?.stripe?.cardLabel ?? 'Card',
      value: 'stripe',
      select: false,
      icon: chrome.runtime.getURL('content-ui/points/card.svg'),
      disabled: false,
    },
    {
      label: 'LLA',
      value: 'lla',
      select: false,
      icon: chrome.runtime.getURL('content-ui/points/lla.svg'),
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

  // 支付状态
  const [payLoading, setPayLoading] = useState(false);

  // Stripe 支付结果视图（仅发起支付/6006 恢复的那一次会话内展示，下次进入直接是 Points 页）
  const [showStripeResult, setShowStripeResult] = useState(false);

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

  // 在新标签页打开 Stripe 托管收银台：优先 background chrome.tabs.create
  // （不受弹窗拦截，也避开 content script 中 await 后丢失用户激活手势的问题），
  // 失败时退回 window.open，两条路径都失败则提示允许弹窗。
  const openCheckoutTab = (url: string) => {
    chrome.runtime.sendMessage({ type: 'OPEN_URL', url }, response => {
      if (chrome.runtime.lastError || !response?.success) {
        const win = window.open(url, '_blank', 'noopener');
        if (!win) {
          message.warning(t.myPoints?.stripe?.popupBlocked ?? 'The payment page could not be opened.');
        }
      }
    });
  };

  // Stripe 托管 Checkout：创建会话后新标签页打开收银台，侧边窗切换到轮询结果视图。
  // 卡片支付无需钱包连接。
  const handleStripePay = async () => {
    if (payLoading) return;

    if (!isLogin) {
      message.error(t.common?.pleaseLogin ?? 'Please log in first');
      return;
    }

    const selectedItem = list.find(item => item.select);
    if (!selectedItem) {
      message.warning(t.common?.select ?? 'Please select a package');
      return;
    }
    const packageType = PACKAGE_BY_LIST_VALUE[selectedItem.value];

    setPayLoading(true);
    try {
      const res = await stripe_checkout(packageType);
      await savePendingOrder({
        order_no: res.data.order_no,
        package_type: packageType,
        created_at: Math.floor(Date.now() / 1000),
      });
      openCheckoutTab(res.data.checkout_url);
      setShowStripeResult(true);
    } catch (err) {
      const e = err as { code?: number; message?: string; data?: StripeCheckoutData };
      if (e.code === STRIPE_ERROR_CODES.NOT_ENABLED) {
        message.warning(t.myPoints?.stripe?.notAvailable ?? 'Card payment is not available yet.');
        // 禁用卡片选项并回退 USDT（与 web 端行为一致）
        setCoinList(prev => {
          const next = prev.map(it => (it.value === 'stripe' ? { ...it, disabled: true, select: false } : it));
          if (!next.some(it => it.select && !it.disabled)) {
            return next.map(it => ({ ...it, select: it.value === 'usdt' }));
          }
          return next;
        });
      } else if (e.code === STRIPE_ERROR_CODES.INVALID_PACKAGE) {
        message.error(t.myPoints?.stripe?.invalidPackage ?? 'Invalid package selected.');
      } else if (e.code === STRIPE_ERROR_CODES.UPSTREAM_ERROR) {
        message.error(t.myPoints?.stripe?.upstreamError ?? 'Payment service is temporarily unavailable.');
      } else if (e.code === STRIPE_ERROR_CODES.PENDING_LIMIT) {
        // 6006：后端在 data 中返回同套餐已有挂单 - 恢复其支付
        const conflict = e.data;
        if (conflict?.order_no && conflict.checkout_url) {
          await savePendingOrder({
            order_no: conflict.order_no,
            package_type: packageType,
            created_at: Math.floor(Date.now() / 1000),
          });
          message.info(t.myPoints?.stripe?.resumingPayment ?? 'Opening the existing payment page...');
          openCheckoutTab(conflict.checkout_url);
          setShowStripeResult(true);
          return;
        }
        message.error(t.myPoints?.stripe?.pendingLimit ?? 'You have too many unfinished orders.');
      } else if (e.code === 429) {
        message.warning(t.myPoints?.stripe?.tooManyRequests ?? 'Too many requests. Please wait a moment.');
      } else {
        message.error(e.message || t.common?.transactionFailed || 'Request failed');
      }
    } finally {
      // 与 web 端不同：侧边窗不会因跳转而卸载，按钮必须复位
      setPayLoading(false);
    }
  };

  // 支付处理
  const handlePay = async () => {
    // Stripe 分支必须先于钱包检查 - 卡片支付无需钱包
    const payCoin = coinList.find(item => item.select);
    if (payCoin?.value === 'stripe') {
      await handleStripePay();
      return;
    }

    const selectedItem = list.find(item => item.select);
    if (!selectedItem) {
      message.warning(t.common?.select ?? 'Please select a package');
      return;
    }

    // 如果 props 中没有钱包状态（钱包锁定/状态被轮询清空），尝试恢复连接
    let effectiveWalletConnected = walletConnected;
    let effectiveWalletAddress = walletAddress;
    let effectiveProviderId = providerId;
    let effectiveWalletChainId = walletChainId;

    if (!walletConnected || !walletAddress) {
      setPayLoading(true);
      try {
        // 定位用户最后使用的钱包（优先 prop，其次跨锁定存活的 LAST_PROVIDER_KEY）
        const pid = providerId || (await getLastProviderId()) || undefined;

        // 被动检查：provider 解析的账户查询，可静默恢复仅 React 状态丢失的场景
        try {
          const accounts = (await executeViaBackgroundScript('wallet_getAccounts', [pid])) as string[];
          if (accounts?.length > 0) {
            effectiveWalletConnected = true;
            effectiveWalletAddress = accounts[0];
          }
        } catch (error) {
          console.warn('[Points] Passive account check failed:', error);
        }

        // 主动唤起：弹出钱包自身的解锁/连接窗口（eth_requestAccounts）
        if (!effectiveWalletConnected || !effectiveWalletAddress) {
          const hideLoading = message.loading(t.myPoints?.walletReconnecting ?? 'Reconnecting wallet...', 0);
          try {
            const accounts = (await executeViaBackgroundScript('wallet_requestAccounts', [pid])) as string[];
            if (accounts?.length > 0) {
              effectiveWalletConnected = true;
              effectiveWalletAddress = accounts[0];
            }
          } catch (error: any) {
            const rejected =
              error?.code === 4001 ||
              error?.message?.includes('User rejected') ||
              error?.message?.includes('User denied');
            if (rejected) {
              message.warning(t.myPoints?.reconnectCancelled ?? 'Wallet connection cancelled');
            } else {
              message.error(
                `${t.myPoints?.reconnectFailed ?? 'Failed to reconnect wallet'}: ${error?.message ?? 'unknown'}`,
              );
            }
            return;
          } finally {
            hideLoading();
          }
          message.success(t.myPoints?.walletReconnected ?? 'Wallet reconnected');
        }

        // 恢复 chainId 并同步回 App（保持轮询/事件状态一致）
        if (effectiveWalletConnected && effectiveWalletAddress) {
          try {
            const chainId = (await executeViaBackgroundScript('wallet_getChainId', [pid])) as string;
            effectiveWalletChainId = chainId || walletChainId;
          } catch {
            effectiveWalletChainId = walletChainId;
          }
          effectiveProviderId = pid || effectiveProviderId;
          console.log('[Points] Wallet reconnected:', {
            effectiveWalletAddress,
            effectiveProviderId,
            effectiveWalletChainId,
          });
          onWalletReconnected?.({
            address: effectiveWalletAddress,
            chainId: effectiveWalletChainId,
            providerId: pid,
          });
        }
      } finally {
        setPayLoading(false);
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

  if (showStripeResult) {
    return <StripeResult onBack={() => setShowStripeResult(false)} />;
  }

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
