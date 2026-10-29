import { Button, Copy, message } from '@src/ui';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@src/store';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { get_llax_balance, get_user_info, type LLAxBalanceData } from '@src/api/agent_c';
import { useI18n } from '@src/lib/i18n';
import { usePageInfoUpdate } from '@src/lib/hooks/usePageInfoUpdate';
import { setOtherInfo, syncPoints } from '@src/store/slices/userSlice';
import { setSelectedMenuId } from '@src/store/slices/uiSlice';
import { refreshGuardEntitlement, selectEntitlement, selectWatchQuota } from '@src/store/slices/guardSlice';
import { executeClaimFlow } from '../lib/claimLlax';

/** 权益轮询间隔，与 GuardEntitlementBar 保持一致 */
const ENTITLEMENT_POLL_INTERVAL_MS = 60_000;

const formatAddress = (address: string, startLength = 6, endLength = 4): string => {
  if (!address || address.length <= startLength + endLength) {
    return address;
  }
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
};

/** 秒数拆成天/时/分/秒四段，由调用方按语种拼接单位 */
const splitDuration = (totalSeconds: number) => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return {
    days: Math.floor(safe / 86400),
    hours: Math.floor((safe % 86400) / 3600),
    minutes: Math.floor((safe % 3600) / 60),
    seconds: safe % 60,
  };
};

interface AccountPageProps {
  onLogout?: () => void;
  walletAddress?: string;
  walletChainId?: string;
  providerId?: string;
  isConnected?: boolean;
}

/**
 * 个人中心页面（原 LoginPanel 弹层的整页版本）。
 *
 * 结构对齐设计稿：账户卡片（头像 + Log out + 四行数据）→ 邀请 & LLAx → About Points。
 * 头像来自 /v1/get_userinfo 的 image 字段；关注位与试用倒计时来自 Guard 权益。
 */
export const AccountPage = ({
  onLogout,
  walletAddress = '',
  walletChainId = '',
  providerId = '',
  isConnected = false,
}: AccountPageProps) => {
  const { t, locale } = useI18n();
  usePageInfoUpdate('account', locale);
  const tAny = t as unknown as Record<string, any>;
  const dispatch = useDispatch<AppDispatch>();

  const points = useSelector((state: RootState) => state.user.points);
  const otherInfo = useSelector((state: RootState) => state.user.otherInfo);
  const isLogin = useSelector((state: RootState) => state.user?.isLogin ?? false);
  const entitlement = useSelector(selectEntitlement);
  /** 关注位用量（试用档收敛为 3，订阅档沿用后端上限） */
  const quota = useSelector(selectWatchQuota);

  const smallPeople = chrome.runtime.getURL('content-ui/smallPeople.svg');
  const smallMoney = chrome.runtime.getURL('content-ui/smallMoney.svg');
  const iconEvmAddress = chrome.runtime.getURL('content-ui/account/icon-evm-address.svg');
  const iconMyPoints = chrome.runtime.getURL('content-ui/account/icon-my-points.svg');
  const iconWatchQuota = chrome.runtime.getURL('content-ui/account/icon-watch-quota.svg');
  const iconFreeEnds = chrome.runtime.getURL('content-ui/account/icon-free-ends.svg');

  const [llaxBalance, setLlaxBalance] = useState<LLAxBalanceData['balance'] | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  /** 本地递减的剩余秒数；权益刷新时以后端值为准重置 */
  const [remaining, setRemaining] = useState(0);

  const fetchLlaxBalance = useCallback(() => {
    get_llax_balance()
      .then(response => {
        setLlaxBalance(response.data?.balance ?? null);
      })
      .catch(() => {
        setLlaxBalance(null);
      });
  }, []);

  // 进入页面：刷新积分 / 用户信息 / LLAx，并拉一次权益
  useEffect(() => {
    dispatch(syncPoints());
    fetchLlaxBalance();
    dispatch(refreshGuardEntitlement());
    get_user_info()
      .then(response => {
        const info = response.data;
        dispatch(
          setOtherInfo({
            web3_address: info.web3_address,
            email: info.email,
            invite_code: info.invite_code,
            invite_count: info.invite_count,
            image: info.image || '',
          }),
        );
      })
      .catch(() => {
        // 头像等次要信息，失败静默
      });
  }, [dispatch, fetchLlaxBalance]);

  // 权益轮询：页面停留期间每 60 秒校准一次
  useEffect(() => {
    if (!isLogin) return;
    const timer = window.setInterval(() => dispatch(refreshGuardEntitlement()), ENTITLEMENT_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [dispatch, isLogin]);

  // Free Ends：以后端 remaining_seconds 为基准本地每秒递减。
  // 仅在活跃态（试用中/订阅中）运行 —— 过期或未激活时该行显示状态文案，
  // 持续走秒既无意义，也会让整个组件每秒重渲染一次。
  const entitlementActive = entitlement?.status === 'trial_active' || entitlement?.status === 'paid_active';
  useEffect(() => {
    if (!entitlementActive) {
      setRemaining(0);
      return;
    }
    const base = entitlement?.remaining_seconds ?? 0;
    if (base <= 0) {
      setRemaining(0);
      return;
    }
    setRemaining(base);
    const timer = window.setInterval(() => {
      setRemaining(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [entitlement?.remaining_seconds, entitlementActive]);

  const handleClaim = useCallback(async () => {
    if (!isConnected || !walletAddress) {
      message.warning(tAny?.loginPanel?.connectFirst ?? 'Please connect your wallet first');
      return;
    }
    if (claimLoading) return;

    setClaimLoading(true);
    try {
      const result = await executeClaimFlow(walletAddress, walletChainId, providerId || undefined, step => {
        if (step === 'signing-message') message.info(tAny?.claim?.stepSignMessage ?? 'Please sign the message');
        if (step === 'submitting-claim') message.info(tAny?.claim?.stepSubmitClaim ?? 'Submitting claim');
        if (step === 'waiting-receipt') message.info(tAny?.claim?.stepWaitReceipt ?? 'Waiting for confirmation');
      });

      if (result.success) {
        message.success(
          result.txHash
            ? `${tAny?.claim?.claimSuccess ?? 'Claimed'} ${result.txHash.slice(0, 10)}...`
            : (tAny?.claim?.claimSuccess ?? 'LLAx claimed successfully!'),
        );
      } else if (result.error) {
        message.error(result.error);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : (tAny?.claim?.claimFailed ?? 'Claim failed'));
    } finally {
      setClaimLoading(false);
      fetchLlaxBalance();
    }
  }, [claimLoading, fetchLlaxBalance, isConnected, providerId, tAny, walletAddress, walletChainId]);

  const walletReady = isConnected && Boolean(walletAddress);

  const quotaText = useMemo(() => {
    if (!quota) return '--/--';
    return `${quota.current}/${quota.max}`;
  }, [quota]);

  /**
   * 倒计时文案：按语种拼接单位。
   * 中文/日文/韩文：7天 2小时 39分 19秒（数字与单位间无空格）
   * 英文/俄文：7d 2h 39m 19s
   * 为 0 的高位段省略，避免显示「0天」；全为 0 时显示 0 + 秒单位。
   */
  const durationText = useMemo(() => {
    const { days, hours, minutes, seconds } = splitDuration(remaining);
    const u = {
      d: tAny?.loginPanel?.durationDays ?? 'd',
      h: tAny?.loginPanel?.durationHours ?? 'h',
      m: tAny?.loginPanel?.durationMinutes ?? 'm',
      s: tAny?.loginPanel?.durationSeconds ?? 's',
    };
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}${u.d}`);
    if (days > 0 || hours > 0) parts.push(`${hours}${u.h}`);
    if (days > 0 || hours > 0 || minutes > 0) parts.push(`${minutes}${u.m}`);
    parts.push(`${seconds}${u.s}`);
    return parts.join(' ');
  }, [remaining, tAny]);

  const claimDisabled = claimLoading || !llaxBalance || llaxBalance.balance <= 0;

  /**
   * 「Free Ends」一行的标签与数值。
   *
   * 后端 status 是权益来源的唯一真相（推导规则见 c_agent guard_entitlement.go）：
   * - trial_active  试用中 → 免费试用剩余 + 倒计时
   * - paid_active   已订阅 → 订阅剩余 + 倒计时（此时 remaining_seconds 已是 paid_until 剩余）
   * - trial_expired 试用已过期 → 状态文案，无倒计时
   * - paid_expired  订阅已过期 → 状态文案，无倒计时
   * - new           从未激活   → 状态文案，无倒计时
   *
   * 早期实现不看 status，一律显示「免费试用剩余 + remaining_seconds」，
   * 导致已付费用户看到「免费试用剩余 151天」这种与实际权益来源不符的文案。
   */
  const freeEndsView = useMemo(() => {
    const status = entitlement?.status;
    const isTrial = status === 'trial_active';
    const isPaid = status === 'paid_active';

    if (isTrial || isPaid) {
      return {
        label: isPaid
          ? (tAny?.loginPanel?.freeEndsPaid ?? 'Subscription ends in')
          : (tAny?.loginPanel?.freeEnds ?? 'Free Ends'),
        value: durationText,
        dimmed: false,
      };
    }

    // 非活跃态：复用 guard 段已有的状态文案，不再显示无意义的 0 秒倒计时
    const expiredKey =
      status === 'paid_expired'
        ? 'entitlementPaidExpired'
        : status === 'trial_expired'
          ? 'entitlementTrialExpired'
          : 'entitlementNew';
    const expiredFallback =
      status === 'paid_expired'
        ? 'Subscription expired'
        : status === 'trial_expired'
          ? 'Trial expired'
          : 'Not activated';

    return {
      label: tAny?.loginPanel?.freeEnds ?? 'Free Ends',
      value: entitlement ? (tAny?.guard?.[expiredKey] ?? expiredFallback) : '--',
      dimmed: true,
    };
  }, [entitlement, durationText, tAny]);

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* 账户卡片 */}
      <div className="rounded-[8px] border-[1.5px] border-black bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="h-[56px] w-[56px] shrink-0 overflow-hidden rounded-full border-2 border-black bg-[#CCFF00]">
            {otherInfo.image ? <img src={otherInfo.image} className="h-full w-full object-cover" alt="" /> : null}
          </div>
          <Button
            id="logout"
            size="small"
            className="bg-[#CCFF00] font-bold"
            style={{ background: '#CCFF00' }}
            onClick={onLogout}>
            {tAny?.loginPanel?.logout ?? 'Log out'}
          </Button>
        </div>

        <div className="mt-3 flex flex-col gap-2 rounded-[6.5px] border-[1.5px] border-black p-2">
          {/* My Points */}
          <div className="flex h-[44px] items-center justify-between rounded-[6px] border border-black bg-white px-3">
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              <img src={iconMyPoints} className="h-5 w-5" alt="" />
              {tAny?.loginPanel?.myPoints ?? 'My Points'}
            </span>
            <span className="text-[13px] font-semibold">{points || '---'}</span>
          </div>

          {/* EVM Address */}
          <div className="flex h-[44px] items-center justify-between rounded-[6px] border border-black bg-white px-3">
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              <img src={iconEvmAddress} className="h-4 w-4" alt="" />
              {tAny?.loginPanel?.evmAddress ?? 'EVM Address'}
            </span>
            <span className="flex items-center gap-1">
              {walletReady ? (
                <span className="text-[12px] font-semibold" title={walletAddress}>
                  {formatAddress(walletAddress, 6, 4)}
                </span>
              ) : (
                <span className="text-[12px] text-[#999999]">
                  {tAny?.loginPanel?.walletDisconnected ?? 'Wallet disconnected'}
                </span>
              )}
              <Copy text={walletReady ? walletAddress : ''} />
            </span>
          </div>

          {/* Watch Quota */}
          <div className="flex h-[44px] items-center justify-between rounded-[6px] border border-black bg-white px-3">
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              <img src={iconWatchQuota} className="h-4 w-4" alt="" />
              {tAny?.loginPanel?.watchQuota ?? 'Watch Quota'}
            </span>
            <span className="text-[13px] font-semibold">{quotaText}</span>
          </div>

          {/* Free Ends：标签与数值随权益状态切换（试用 / 订阅 / 过期） */}
          <div className="flex h-[44px] items-center justify-between rounded-[6px] border border-black bg-white px-3">
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              <img src={iconFreeEnds} className="h-4 w-4" alt="" />
              {freeEndsView.label}
            </span>
            <span
              className={`whitespace-nowrap text-[13px] font-semibold tabular-nums ${
                freeEndsView.dimmed ? 'text-[#999999]' : ''
              }`}>
              {freeEndsView.value}
            </span>
          </div>
        </div>
      </div>

      {/* 邀请人数 + LLAx（沿用原弹层样式） */}
      <div className="flex gap-[4px]">
        <div className="h-[52px] w-[20%] rounded-[8px] bg-[#cf0] px-2 py-3">
          <div className="flex h-full items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={smallPeople} alt="" />
            </div>
            <div className="font-bold text-black">{otherInfo.invite_count || '0'}</div>
          </div>
        </div>
        <div className="h-[52px] flex-1 rounded-[8px] bg-[#E9FF93] px-2 py-3">
          <div className="flex h-full items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={smallMoney} alt="" />
              <div className="text-[12px] text-[#666666]">LLAx</div>
            </div>
            <div className="flex items-center gap-1 text-[12px] font-bold text-black">
              {llaxBalance && (llaxBalance.frozen_amount ?? 0) > 0 ? (
                <span className="whitespace-nowrap font-normal text-[#666]" title={tAny?.claim?.frozenTip ?? ''}>
                  ({tAny?.claim?.frozenAmount ?? 'Frozen'}: {llaxBalance.frozen_amount})
                </span>
              ) : (
                <span>{llaxBalance?.balance}</span>
              )}
            </div>
            <Button onClick={handleClaim} disabled={claimDisabled}>
              {claimLoading ? 'Claiming...' : (tAny?.claim?.claimButton ?? 'Claim')}
            </Button>
          </div>
        </div>
      </div>

      {/* About Points */}
      <div className="overflow-hidden rounded-[8px] border-[1.5px] border-black">
        <div className="bg-[#E9FF93] p-4">
          <h3 className="text-[18px] font-bold">{tAny?.loginPanel?.aboutPoints ?? 'About Points'}</h3>
          <p className="mt-2 text-[12px] leading-relaxed text-black/80">
            {tAny?.loginPanel?.aboutPointsDesc ?? 'Log in to enjoy free perks, and purchase points for more benefits.'}
          </p>
          <button
            type="button"
            onClick={() => dispatch(setSelectedMenuId(6))}
            className="mt-4 w-full rounded-[6px] border-[1.5px] border-black bg-white py-2 text-[14px] font-bold shadow-[3px_3px_0_0_#000] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
            {tAny?.loginPanel?.subscribe ?? 'Subscribe'}
          </button>
        </div>
        <div className="bg-[#F2F2F2] px-4 py-2 text-[13px] font-bold">
          {tAny?.loginPanel?.benefitsInclude ?? 'Benefits include:'}
        </div>
        <ul className="flex flex-col gap-2 bg-white px-4 py-3 text-[12px] leading-relaxed">
          {[
            tAny?.loginPanel?.benefitFreePicks,
            tAny?.loginPanel?.benefitFreeQuota,
            tAny?.loginPanel?.benefitMonth1,
            tAny?.loginPanel?.benefitMonth3,
            tAny?.loginPanel?.benefitMonth12,
          ]
            .filter(Boolean)
            .map((line, index) => (
              <li key={index}>{line}</li>
            ))}
        </ul>
      </div>
    </div>
  );
};

AccountPage.displayName = 'AccountPage';

export default AccountPage;
