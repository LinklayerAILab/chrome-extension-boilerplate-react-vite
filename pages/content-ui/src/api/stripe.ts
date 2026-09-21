import { service } from './service';
import { API_BASE_URL } from './config';
import { STRIPE_PENDING_ORDER_KEY } from '@src/lib/storageKeys';

export type StripePackageType = 'basic' | 'standard' | 'professional';

export type StripeOrderStatus = 'pending' | 'paid' | 'expired' | 'failed';

export const STRIPE_ERROR_CODES = {
  NOT_ENABLED: 6001,
  INVALID_PACKAGE: 6002,
  UPSTREAM_ERROR: 6003,
  PENDING_LIMIT: 6006,
} as const;

export interface StripePackage {
  /** 对应 Points 页套餐列表项的 value（1/2/3） */
  listValue: number;
  /** 展示价格，与套餐列表项 money 一致 */
  money: string;
  amountCents: number;
  points: number;
  llax: number;
}

/** 静态套餐表，与后端 stripe prices 配置保持同步 */
export const STRIPE_PACKAGES: Record<StripePackageType, StripePackage> = {
  basic: { listValue: 1, money: '9.9', amountCents: 990, points: 990, llax: 10000 },
  standard: { listValue: 2, money: '29.9', amountCents: 2990, points: 3400, llax: 36000 },
  professional: { listValue: 3, money: '99.9', amountCents: 9990, points: 12500, llax: 130000 },
};

/** Points 页套餐列表 value（1/2/3）→ Stripe 套餐类型 */
export const PACKAGE_BY_LIST_VALUE = Object.fromEntries(
  Object.entries(STRIPE_PACKAGES).map(([type, pkg]) => [pkg.listValue, type as StripePackageType]),
) as Record<number, StripePackageType>;

export interface StripeCheckoutData {
  order_no: string;
  checkout_url: string;
  amount_cents: number;
  currency: string;
  points: number;
  llax_amount: number;
}

export interface StripeCheckoutResponse {
  code: number;
  message: string;
  data: StripeCheckoutData;
}

/**
 * 创建 Stripe 托管 Checkout 会话。
 * 业务错误以 HTTP 500 + JSON 体 {code, message, data?} 返回，
 * service.ts 会把 code/data 附加到抛出的 Error 上（见 ApiError）。
 * code 6006（PENDING_LIMIT）且 data 非空时，data 为同套餐已有挂单的
 * StripeCheckoutData（快照字段齐全）——用它的 checkout_url 恢复支付。
 */
export const stripe_checkout = (package_type: StripePackageType): Promise<StripeCheckoutResponse> => {
  return service.post(`${API_BASE_URL}/v1/stripe/checkout`, { package_type });
};

export interface StripeOrderItem {
  order_no: string;
  package_type: StripePackageType;
  amount_cents: number;
  currency: string;
  points: number;
  llax_amount: number;
  status: StripeOrderStatus;
  /** unix 秒 */
  created_at: number;
  paid_at: number | null;
}

export interface StripeOrdersResponse {
  code: number;
  message: string;
  data: {
    total: number;
    orders: StripeOrderItem[];
  };
}

export const stripe_orders = (params: {
  limit: number;
  offset: number;
  status?: StripeOrderStatus;
}): Promise<StripeOrdersResponse> => {
  return service.get(`${API_BASE_URL}/v1/stripe/orders`, { params });
};

// ---------------------------------------------------------------------------
// 挂单提示：chrome.storage.local 持久化（web 版用 sessionStorage，但 content
// script 的 sessionStorage 属于宿主页面且随标签页死亡；storage.local 让侧边
// 窗口关闭重开、跨站点都能恢复支付结果视图）
// ---------------------------------------------------------------------------

export interface StripePendingOrderHint {
  order_no: string;
  package_type: StripePackageType;
  /** unix 秒 */
  created_at: number;
}

export function savePendingOrder(hint: StripePendingOrderHint): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STRIPE_PENDING_ORDER_KEY]: hint }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

export function readPendingOrder(): Promise<StripePendingOrderHint | null> {
  return new Promise(resolve => {
    chrome.storage.local.get([STRIPE_PENDING_ORDER_KEY], result => {
      const parsed = result[STRIPE_PENDING_ORDER_KEY] as StripePendingOrderHint | undefined;
      resolve(parsed && parsed.order_no ? parsed : null);
    });
  });
}

export function clearPendingOrder(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove([STRIPE_PENDING_ORDER_KEY], () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}
