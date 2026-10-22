import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@src/store';
import { useI18n } from '@src/lib/i18n';
import { Switch, message } from '@src/ui';
import { getVapidPublicKey, mutePush, type GuardEntitlement } from '@src/api/guard';
import {
  getMutedUntil,
  isPushDisabledError,
  refreshGuardEntitlement,
  selectEntitlement,
  selectPushSupported,
  setPushSupported,
} from '@src/store/slices/guardSlice';

/** 与 WatchListTab 的看板轮询保持一致 */
const ENTITLEMENT_POLL_INTERVAL_MS = 60_000;
/** 静音开关一次开启的时长 */
const MUTE_DURATION_MS = 24 * 60 * 60 * 1000;

const STATUS_LABEL_KEY: Record<GuardEntitlement['status'], string> = {
  new: 'entitlementNew',
  trial_active: 'entitlementTrial',
  trial_expired: 'entitlementTrialExpired',
  paid_active: 'entitlementPaid',
  paid_expired: 'entitlementPaidExpired',
};

/** RFC3339 → 本地日期时间；解析失败原样返回 */
const formatDateTime = (value: string, locale: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
};

/** 剩余时长：仅用数字 + 单位字母，避免依赖 i18n 插值 */
const formatRemaining = (seconds?: number | null): string => {
  if (!seconds || seconds <= 0) return '0h';
  const hours = Math.floor(seconds / 3600);
  if (hours < 1) return `${Math.max(1, Math.floor(seconds / 60))}m`;
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
};

/**
 * Guard 权益横幅：套餐状态 / 到期时间 / 关注位用量 / 静音开关。
 * 挂在 Politer 的 tab 条上方，三个 tab 都能看到。
 */
export const GuardEntitlementBar = memo(({ isOpen }: { isOpen: boolean }) => {
  const { t, locale } = useI18n();
  const tAny = t as unknown as Record<string, any>;
  const dispatch = useDispatch<AppDispatch>();
  const isLogin = useSelector((state: RootState) => state.user?.isLogin ?? false);
  const entitlement = useSelector(selectEntitlement);
  const pushSupported = useSelector(selectPushSupported);
  const [muteLoading, setMuteLoading] = useState(false);

  // 权益轮询：未登录或侧边栏关闭时暂停
  useEffect(() => {
    if (!isOpen || !isLogin) return;
    dispatch(refreshGuardEntitlement());
    const timer = window.setInterval(() => dispatch(refreshGuardEntitlement()), ENTITLEMENT_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isOpen, isLogin, dispatch]);

  // 探测推送是否启用（6130 静默降级）：推送未启用时静音开关无意义
  useEffect(() => {
    if (!isOpen || !isLogin) return;
    let cancelled = false;
    getVapidPublicKey().catch(error => {
      if (!cancelled && isPushDisabledError(error)) dispatch(setPushSupported(false));
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, isLogin, dispatch]);

  const statusLabel = useMemo(() => {
    if (!entitlement) return '';
    const key = STATUS_LABEL_KEY[entitlement.status];
    return tAny?.guard?.[key] ?? key;
  }, [entitlement, tAny]);

  const mutedUntil = getMutedUntil(entitlement);
  const muted = mutedUntil !== null;

  const handleToggleMute = useCallback(
    async (nextMuted: boolean) => {
      setMuteLoading(true);
      try {
        await mutePush(nextMuted ? new Date(Date.now() + MUTE_DURATION_MS).toISOString() : null);
        await dispatch(refreshGuardEntitlement()).unwrap();
      } catch (error) {
        if (isPushDisabledError(error)) {
          dispatch(setPushSupported(false));
        } else {
          message.error(error instanceof Error ? error.message : tAny?.common?.requestFailed || 'Request failed');
        }
      } finally {
        setMuteLoading(false);
      }
    },
    [dispatch, tAny],
  );

  if (!isLogin || !entitlement) return null;

  const active = entitlement.status === 'trial_active' || entitlement.status === 'paid_active';

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[6.5px] border-[1.5px] border-black bg-[#F4FFC8] px-3 py-2 text-[11px] text-black">
      <span
        className={`rounded-full border border-black px-2 py-0.5 font-bold ${
          active ? 'bg-[#CCFF00]' : 'bg-white text-black/50'
        }`}>
        {statusLabel}
      </span>

      {entitlement.expires_at && (
        <span className="text-black/70">
          {tAny?.guard?.entitlementExpiresAt ?? 'Valid until'}{' '}
          <span className="font-bold text-black">{formatDateTime(entitlement.expires_at, locale)}</span>
        </span>
      )}

      {active && entitlement.remaining_seconds ? (
        <span className="text-black/70">
          {tAny?.guard?.entitlementRemaining ?? 'Remaining'}{' '}
          <span className="font-bold text-black">{formatRemaining(entitlement.remaining_seconds)}</span>
        </span>
      ) : null}

      <span className="text-black/70">
        {tAny?.guard?.watchlistQuota ?? 'Watch slots'}{' '}
        <span className="font-bold text-black">
          {entitlement.watchlist_current} / {entitlement.watchlist_max_tokens}
        </span>
      </span>

      {mutedUntil && (
        <span className="text-black/50">
          {tAny?.guard?.muteUntil ?? 'Muted until'} {formatDateTime(mutedUntil, locale)}
        </span>
      )}

      {active && pushSupported && (
        <span className="ml-auto flex items-center gap-2">
          <Switch
            size="small"
            checked={muted}
            disabled={muteLoading}
            onChange={checked => handleToggleMute(checked)}
            checkedChildren={tAny?.guard?.muteDisable ?? 'Unmute'}
            unCheckedChildren={tAny?.guard?.muteEnable ?? 'Mute alerts'}
          />
        </span>
      )}
    </div>
  );
});

GuardEntitlementBar.displayName = 'GuardEntitlementBar';

export default GuardEntitlementBar;
