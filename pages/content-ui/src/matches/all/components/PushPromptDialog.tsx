import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '@src/store';
import { useI18n } from '@src/lib/i18n';
import { Button, message } from '@src/ui';
import { GUARD_PUSH_PROMPT_SKIPPED_KEY } from '@src/lib/storageKeys';
import { enableGuardPush } from '@src/lib/guardPush';
import { refreshGuardEntitlement, selectEntitlement } from '@src/store/slices/guardSlice';
import Dialog from './Dialog';

/** RFC3339 → 本地时间字符串；解析失败时原样返回 */
const formatDateTime = (value: string, locale: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
};

interface PushPromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 关注币种后的告警通知引导。
 * 「开启通知」把登录态交给 background，由它定时轮询 /guard/alerts 并用
 * chrome.notifications 弹系统通知（扩展通知权限随安装授予，无需浏览器授权弹窗）。
 */
export const PushPromptDialog = ({ isOpen, onClose }: PushPromptDialogProps) => {
  const { t, locale } = useI18n();
  const tAny = t as unknown as Record<string, any>;
  const dispatch = useDispatch<AppDispatch>();
  const entitlement = useSelector(selectEntitlement);
  const [checking, setChecking] = useState(false);

  // 回调存 ref，避免父组件每次渲染产生的新函数身份触发重复探测
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // 打开时同步一次权益（仅用于弹窗内的关注位/到期展示，不参与是否授权的判断）
  useEffect(() => {
    if (!isOpen) return;
    dispatch(refreshGuardEntitlement());
  }, [isOpen, dispatch]);

  /** 「稍后」：本机记录跳过，之后添加关注不再重复引导 */
  const handleLater = useCallback(() => {
    window.localStorage.setItem(GUARD_PUSH_PROMPT_SKIPPED_KEY, String(Date.now()));
    onClose();
  }, [onClose]);

  const handleEnable = useCallback(async () => {
    setChecking(true);
    try {
      const result = await enableGuardPush();

      if (result.ok) {
        message.success(tAny?.guard?.pushPromptEnabled ?? 'Notifications enabled');
        // 同步一次权益，让横幅上的静音开关等状态立即生效
        dispatch(refreshGuardEntitlement());
        onClose();
        return;
      }

      message.error(result.message || tAny?.common?.requestFailed || 'Request failed');
    } finally {
      setChecking(false);
    }
  }, [dispatch, onClose, tAny]);

  const quotaMax = entitlement?.watchlist_max_tokens;

  return (
    <Dialog isOpen={isOpen} onClose={handleLater}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-black">{tAny?.guard?.pushPromptTitle ?? 'Turn on risk alerts'}</h3>
          <button
            type="button"
            className="cursor-pointer text-[20px] leading-none text-gray-400 hover:text-gray-600"
            onClick={handleLater}>
            &times;
          </button>
        </div>

        <p className="text-[13px] leading-5 text-black/70">
          {tAny?.guard?.pushPromptDesc ??
            'Get notified the moment a watched token shows liquidity risk, even when the side panel is closed.'}
        </p>

        <div className="rounded-[8px] bg-[#F4FFC8] p-3 text-[12px] text-black/80">
          <div className="flex justify-between gap-2">
            <span>{tAny?.guard?.watchlistQuota ?? 'Watch slots'}</span>
            <span className="font-bold">
              {entitlement?.watchlist_current ?? 0} / {quotaMax ?? '-'}
            </span>
          </div>
          {entitlement?.expires_at && (
            <div className="mt-1 flex justify-between gap-2">
              <span>{tAny?.guard?.entitlementExpiresAt ?? 'Valid until'}</span>
              <span className="font-bold">{formatDateTime(entitlement.expires_at, locale)}</span>
            </div>
          )}
        </div>

        <p className="text-[11px] leading-4 text-black/45">
          {tAny?.guard?.pushPromptWebOptInHint ??
            'Notifications are authorized in the browser so alerts can reach you in the background.'}
        </p>

        <div className="flex gap-2">
          <Button type="default" block onClick={handleLater}>
            {tAny?.guard?.pushPromptLater ?? 'Later'}
          </Button>
          <Button type="primary" block loading={checking} onClick={handleEnable}>
            {tAny?.guard?.pushPromptEnable ?? 'Enable notifications'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

PushPromptDialog.displayName = 'PushPromptDialog';

export default PushPromptDialog;
