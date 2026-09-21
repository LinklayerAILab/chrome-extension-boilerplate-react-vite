import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Button } from '@src/ui';
import { useI18n } from '@src/lib/i18n';
import { syncPoints } from '@src/store/slices/userSlice';
import type { AppDispatch } from '@src/store';
import { clearPendingOrder, readPendingOrder, stripe_orders, STRIPE_PACKAGES } from '@src/api/stripe';
import type { StripeOrderItem, StripePendingOrderHint } from '@src/api/stripe';

type Phase = 'polling' | 'paid' | 'cancelled' | 'timeout' | 'notFound';

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 24; // ~60 秒

// 扩展 i18n 无插值支持，{{points}}/{{llax}} 手动替换
const fillTemplate = (template: string, vars: Record<string, string>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{{${k}}}`).join(v), template);

interface StripeResultProps {
  /** 返回套餐选择视图 */
  onBack: () => void;
}

// 内联图标（替代 web 版的 antd icons）
const CheckCircleIcon = () => (
  <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden>
    <circle cx="26" cy="26" r="24" fill="#7A9900" />
    <path d="M15 26.5L22.5 34L37 19.5" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CloseCircleIcon = () => (
  <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden>
    <circle cx="26" cy="26" r="24" fill="#666666" />
    <path d="M19 19L33 33M33 19L19 33" stroke="white" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

const ClockIcon = () => (
  <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden>
    <circle cx="26" cy="26" r="23" stroke="#7A9900" strokeWidth="4" />
    <path d="M26 14V27L34 32" stroke="#7A9900" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const QuestionIcon = () => (
  <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden>
    <circle cx="26" cy="26" r="23" stroke="#666666" strokeWidth="4" />
    <path
      d="M20 20.5C20.3 17.5 22.6 15.5 26 15.5C29.4 15.5 31.8 17.7 31.8 20.7C31.8 23 30.5 24.3 28.2 25.8C26.4 27 25.8 27.9 25.8 29.5V30.5"
      stroke="#666666"
      strokeWidth="3.5"
      strokeLinecap="round"
    />
    <circle cx="25.9" cy="36.5" r="2.2" fill="#666666" />
  </svg>
);

/**
 * Stripe 支付结果视图（web 端 StripeResultContent 的移植）。
 * 轮询 GET /v1/stripe/orders 直到订单 paid；超窗后仍 pending 不算失败
 * （延迟支付方式靠 webhook / 对账任务后续结算），停留在"确认中"并可手动刷新。
 * 目标订单：chrome.storage 挂单提示的 order_no → 最新订单兜底（侧边窗无 URL 参数）。
 */
export const StripeResult = ({ onBack }: StripeResultProps) => {
  const { t } = useI18n();
  const dispatch = useDispatch<AppDispatch>();

  const [phase, setPhase] = useState<Phase>('polling');
  const [order, setOrder] = useState<StripeOrderItem | null>(null);
  // 触发变化以重启轮询 effect（"刷新状态"按钮）
  const [pollRound, setPollRound] = useState(0);
  // undefined = 尚未从 storage 读取完成（用于 effect 门控）
  const [hint, setHint] = useState<StripePendingOrderHint | null | undefined>(undefined);

  const paidGuardRef = useRef(false);

  useEffect(() => {
    readPendingOrder()
      .then(setHint)
      .catch(() => setHint(null));
  }, []);

  useEffect(() => {
    if (hint === undefined) return; // 等待 storage 读取

    paidGuardRef.current = false;
    setPhase('polling');

    const targetOrderNo = hint?.order_no || '';

    const onPaid = (target: StripeOrderItem) => {
      if (paidGuardRef.current) return;
      paidGuardRef.current = true;
      clearPendingOrder().catch(() => undefined);
      setOrder(target);
      setPhase('paid');
      dispatch(syncPoints());
    };

    // 返回 true 表示继续轮询
    const poll = async (): Promise<boolean> => {
      try {
        const res = await stripe_orders({ limit: 20, offset: 0 });
        const list = res.data?.orders ?? [];
        if (!list.length) {
          setPhase('notFound');
          return false;
        }
        const target = list.find(o => o.order_no === targetOrderNo) ?? list[0];
        setOrder(target);
        if (target.status === 'paid') {
          onPaid(target);
          return false;
        }
        if (target.status === 'expired' || target.status === 'failed') {
          clearPendingOrder().catch(() => undefined);
          setPhase('cancelled');
          return false;
        }
        // pending - 延迟支付方式（如银行转账）会停留更久
        return true;
      } catch (err) {
        const e = err as { code?: number };
        if (e.code === 401) {
          // service.ts 已触发全局登出弹窗
          return false;
        }
        // 瞬时失败 - 继续轮询
        return true;
      }
    };

    let inFlight = false;
    let attempts = 0;
    let stopTimer: (() => void) | null = null;

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      attempts += 1;
      let keepGoing = false;
      try {
        keepGoing = attempts < POLL_MAX_ATTEMPTS ? await poll() : false;
      } finally {
        inFlight = false;
      }
      if (!keepGoing) {
        setPhase(prev => (prev === 'polling' ? 'timeout' : prev));
        stopTimer?.();
      }
    };

    const timer = setInterval(tick, POLL_INTERVAL_MS);
    stopTimer = () => clearInterval(timer);

    // 立即先查一次
    tick();

    return () => clearInterval(timer);
  }, [hint, pollRound, dispatch]);

  const displayOrder = useMemo(() => {
    if (order) {
      return order;
    }
    if (hint) {
      const pkg = STRIPE_PACKAGES[hint.package_type];
      return {
        order_no: hint.order_no,
        package_type: hint.package_type,
        amount_cents: pkg.amountCents,
        points: pkg.points,
        llax_amount: pkg.llax,
      } as StripeOrderItem;
    }
    return null;
  }, [order, hint]);

  const orderCard = displayOrder ? (
    <div className="flex w-full flex-col gap-[4px] rounded-[8px] border-[1px] border-solid border-black bg-[#F9FFE2] px-[14px] py-[10px] text-[12px] font-bold">
      <div className="flex justify-between gap-[10px]">
        <span className="text-[#666666]">Order</span>
        <span className="truncate font-mono" title={displayOrder.order_no}>
          {displayOrder.order_no}
        </span>
      </div>
      <div className="flex justify-between gap-[10px]">
        <span className="capitalize">{displayOrder.package_type}</span>
        <span>${(displayOrder.amount_cents / 100).toFixed(2)}</span>
      </div>
    </div>
  ) : null;

  const primaryBtnClass = 'font-bold';

  return (
    <div className="flex w-full flex-col items-center gap-[16px] rounded-[12px] border-2 border-solid border-black bg-white px-[24px] py-[32px] text-black">
      {phase === 'polling' && (
        <>
          <div className="h-[48px] w-[48px] animate-spin rounded-full border-[4px] border-black border-t-transparent" />
          <div className="text-center text-[20px] font-bold">
            {t.stripeResult?.confirming ?? 'Payment confirming...'}
          </div>
          <div className="text-center text-[13px] text-[#666666]">
            {t.stripeResult?.confirmingDesc ?? 'Your payment is being processed.'}
          </div>
          {orderCard}
          <Button size="small" className={primaryBtnClass} block style={{ background: '#cf0' }} onClick={onBack}>
            {t.stripeResult?.backToPoints ?? 'Back to My Points'}
          </Button>
        </>
      )}

      {phase === 'paid' && (
        <>
          <CheckCircleIcon />
          <div className="text-center text-[20px] font-bold">{t.stripeResult?.success ?? 'Payment successful!'}</div>
          <div className="text-center text-[13px] text-[#666666]">
            {fillTemplate(t.stripeResult?.successDesc ?? '', {
              points: (displayOrder?.points ?? 0).toLocaleString('en-US'),
              llax: (displayOrder?.llax_amount ?? 0).toLocaleString('en-US'),
            })}
          </div>
          {orderCard}
          <Button size="small" className={primaryBtnClass} block style={{ background: '#cf0' }} onClick={onBack}>
            {t.stripeResult?.backToPoints ?? 'Back to My Points'}
          </Button>
        </>
      )}

      {phase === 'cancelled' && (
        <>
          <CloseCircleIcon />
          <div className="text-center text-[20px] font-bold">
            {t.stripeResult?.cancelled ?? 'Payment not completed'}
          </div>
          <div className="text-center text-[13px] text-[#666666]">
            {t.stripeResult?.cancelledDesc ?? 'The payment was not completed.'}
          </div>
          {orderCard}
          <Button size="small" className={primaryBtnClass} block style={{ background: '#cf0' }} onClick={onBack}>
            {t.stripeResult?.retry ?? 'Try Again'}
          </Button>
        </>
      )}

      {phase === 'timeout' && (
        <>
          <ClockIcon />
          <div className="text-center text-[20px] font-bold">{t.stripeResult?.timeout ?? 'Still confirming'}</div>
          <div className="text-center text-[13px] text-[#666666]">
            {t.stripeResult?.timeoutDesc ?? 'Your payment is taking longer than expected.'}
          </div>
          {orderCard}
          <div className="mt-[8px] flex w-full flex-col gap-[10px]">
            <Button
              size="small"
              className={primaryBtnClass}
              block
              style={{ background: '#cf0' }}
              onClick={() => setPollRound(r => r + 1)}>
              {t.stripeResult?.refresh ?? 'Refresh Status'}
            </Button>
            <Button size="small" className={primaryBtnClass} block onClick={onBack}>
              {t.stripeResult?.backToPoints ?? 'Back to My Points'}
            </Button>
          </div>
        </>
      )}

      {phase === 'notFound' && (
        <>
          <QuestionIcon />
          <div className="text-center text-[20px] font-bold">{t.stripeResult?.notFound ?? 'Order not found'}</div>
          <div className="text-center text-[13px] text-[#666666]">
            {t.stripeResult?.notFoundDesc ?? 'No recent card payment order was found for your account.'}
          </div>
          <Button size="small" className={primaryBtnClass} block style={{ background: '#cf0' }} onClick={onBack}>
            {t.stripeResult?.backToPoints ?? 'Back to My Points'}
          </Button>
        </>
      )}
    </div>
  );
};
