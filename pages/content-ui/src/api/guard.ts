/**
 * Guard（bodyguard）服务 API 封装
 *
 * 接口契约参考 bodyguard-app（D:\Job\Companys\linkLayer\bodyguard-app），
 * 后端将在 cagent 服务上扩展这些接口（路径前缀 /v1/guard），
 * 因此直接复用现有 service 实例（同认证头、同 {code,msg,data} 响应信封处理）。
 */
import { ACCESS_TOKEN_KEY, ADDRESS_KEY, LOCALE_KEY } from '@src/lib/storageKeys';
import { handleUnauthorizedSession } from '@src/lib/sessionCleanup';
import { API_BASE_URL } from './config';
import { service } from './service';

// ============ 类型契约（按 bodyguard-app src/types/api.ts，仅保留消费端所需子集） ============

export type GuardColor = 'green' | 'yellow' | 'red' | 'stale' | 'GREEN' | 'YELLOW' | 'RED' | 'STALE';
export type GuardLevel = 'None' | 'Low' | 'Mild' | 'Medium' | 'High' | 'Extreme' | 'Stale' | 'Unknown';

export interface GuardToken {
  token_id: string;
  symbol: string;
  name?: string;
  chain_id: number;
  contract_address: string;
  cex_symbol: string;
  main_pool?: string;
  main_pool_type?: string;
  image_url?: string;
  decimals: number;
  status?: string;
  is_watched?: boolean;
  watchlist_id?: number | null;
}

/** 健康检查：UI 消费 color/level/stale，完整契约见 bodyguard-app types/api.ts HealthResponse */
export interface GuardHealth {
  token: GuardToken;
  color: GuardColor;
  level: GuardLevel;
  previous_color?: GuardColor;
  previous_level?: GuardLevel;
  reasons?: unknown[];
  computed_at: string | null;
  stale: boolean;
  is_double_sided?: boolean;
}

export interface GuardWatchlistItem {
  id: number;
  token: GuardToken;
  added_at: string;
  health: GuardHealth;
  trial_activated?: boolean;
}

export interface GuardWatchlistSummary {
  watchlist_total: number;
  red_count: number;
  yellow_count: number;
  green_count: number;
  stale_count: number;
  double_sided_drain_count: number;
}

export interface GuardWatchlistResponse {
  items: GuardWatchlistItem[];
  summary: GuardWatchlistSummary;
}

/** 看板聚合视图；后端返回 user 字段，当前 UI 未消费 */
export interface GuardDashboardResponse {
  user?: unknown;
  summary: GuardWatchlistSummary;
  items: GuardWatchlistItem[];
  last_updated_at?: string;
}

export interface GuardListTokensResponse {
  total: number;
  limit: number;
  offset: number;
  items: GuardToken[];
}

export interface GuardPriceItem {
  cex_symbol: string;
  price: number;
  gain: number;
}

export interface GuardPricesResponse {
  items: GuardPriceItem[];
}

export interface GuardLiquidityChangeCex {
  depth_change_pct: number;
  anchor_usd: number;
  current_usd: number;
  window: string;
}

export interface GuardLiquidityChangeDex {
  depth_change_pct: number;
  slope: number;
  depth_usd: number;
  window: string;
}

export interface GuardLiquidityChangeItem {
  cex: GuardLiquidityChangeCex;
  dex: GuardLiquidityChangeDex;
}

export type GuardLiquidityChangeResponse = Record<string, GuardLiquidityChangeItem>;

export interface GuardApiResponse<T = unknown> {
  code: number;
  message?: string;
  data: T;
}

// ============ 接口函数（挂载到 cagent 服务的 /v1/guard 前缀） ============

export interface SearchTokensParams {
  keyword?: string;
  limit?: number;
  offset?: number;
  status?: string;
  has_pool?: boolean;
}

/** 搜索代币列表（支持 keyword 过滤 + offset 分页） */
export const searchTokens = (params: SearchTokensParams): Promise<GuardApiResponse<GuardListTokensResponse>> => {
  return service.get('/v1/guard/tokens', { params });
};

export interface AddToWatchlistParams {
  token_id?: string;
  chain_id?: number;
  contract_address?: string;
  cex_symbol?: string;
}

/** 添加关注 */
export const addToWatchlist = (params: AddToWatchlistParams): Promise<GuardApiResponse<GuardWatchlistItem>> => {
  return service.post('/v1/guard/watchlist', params);
};

/** 取消关注 */
export const removeFromWatchlist = (id: number): Promise<GuardApiResponse<unknown>> => {
  return service.delete(`/v1/guard/watchlist/${id}`);
};

/** 关注列表 */
export const getWatchlist = (): Promise<GuardApiResponse<GuardWatchlistResponse>> => {
  return service.get('/v1/guard/watchlist');
};

/** 看板聚合视图（关注列表 + 汇总） */
export const getDashboard = (): Promise<GuardApiResponse<GuardDashboardResponse>> => {
  return service.get('/v1/guard/dashboard');
};

/** 批量获取 CEX 价格（轮询用） */
export const getPrices = (cexSymbols: string[]): Promise<GuardApiResponse<GuardPricesResponse>> => {
  return service.post('/v1/guard/prices', { cex_symbols: cexSymbols });
};

/** 批量获取流动性变化（CEX 深度 + DEX 深度） */
export const getLiquidityChange = (tokenIds: string[]): Promise<GuardApiResponse<GuardLiquidityChangeResponse>> => {
  return service.post('/v1/guard/liquidity_change', { token_ids: tokenIds });
};

// ============ 权益与浏览器推送 ============

export type GuardEntitlementStatus = 'new' | 'trial_active' | 'trial_expired' | 'paid_active' | 'paid_expired';

/** 权益信息，状态由后端按时间戳推导 */
export interface GuardEntitlement {
  status: GuardEntitlementStatus;
  /** 当前权益到期时刻（RFC3339），无权益时为 null */
  expires_at?: string | null;
  remaining_seconds?: number | null;
  trial_started_at?: string | null;
  trial_expires_at?: string | null;
  paid_until?: string | null;
  /** 非空且晚于当前时刻 = 静音中 */
  muted_until?: string | null;
  /** 当前关注数（不含软删） */
  watchlist_current: number;
  /** 关注位上限，以前端不得硬编码 */
  watchlist_max_tokens: number;
}

export interface GuardPushKeys {
  p256dh: string;
  auth: string;
}

export interface GuardPushSubscribeParams {
  endpoint: string;
  keys: GuardPushKeys;
  locale: string;
  timezone: string;
  user_agent: string;
}

/** 获取 VAPID 公钥（Base64URL），推送未启用时后端返回 6130 */
export const getVapidPublicKey = (): Promise<GuardApiResponse<{ public_key: string }>> => {
  return service.get('/v1/guard/push/vapid-public-key');
};

/** 订阅推送（同 endpoint 重复提交 = 刷新设备偏好） */
export const subscribePush = (params: GuardPushSubscribeParams): Promise<GuardApiResponse<unknown>> => {
  return service.post('/v1/guard/push/subscribe', params);
};

/** 退订推送（按 endpoint 删除，幂等） */
export const unsubscribePush = (endpoint: string): Promise<GuardApiResponse<unknown>> => {
  return service.delete('/v1/guard/push/subscribe', { data: { endpoint } });
};

/** 静音推送：until 为 RFC3339 时刻；传 null 或过去时刻 = 取消静音 */
export const mutePush = (until: string | null): Promise<GuardApiResponse<unknown>> => {
  return service.post('/v1/guard/push/mute', { until });
};

/** 权益信息（状态 / 到期 / 关注位上限 / 静音） */
export const getEntitlement = (): Promise<GuardApiResponse<GuardEntitlement>> => {
  return service.get('/v1/guard/entitlement');
};

// ============ 日报 SSE 流 ============

/**
 * Dify SSE 专用解析：event 行指定类型（done/error/message/not_ready），data 行为 JSON 字符串或对象。
 * 移植自 bodyguard-app src/lib/api/agent.ts parseDifySSE。
 */
async function* parseGuardSSE(response: Response, signal: AbortSignal): AsyncGenerator<string> {
  if (!response.body) throw new Error('No response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal.aborted) return;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 事件以 \n\n 分隔
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        let eventType = '';
        const dataLines: string[] = [];
        for (const line of event.split('\n')) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            // 不去掉 data: 后的空格 —— token 可能带前导空格（如列表项的 " -"），
            // 去掉会破坏 markdown 渲染；空格 token 也不能丢
            dataLines.push(line.slice(5));
          }
        }
        const dataStr = dataLines.join('\n');

        if (eventType === 'done') return;
        if (eventType === 'error') {
          throw new Error(dataStr || 'Agent stream error');
        }
        if (eventType !== 'message' && eventType !== 'not_ready') continue;

        // 多/空 data 行 join 后可能是 '\n' 或 '\n\n' —— 是 markdown 段落分隔信号，必须保留
        if (!dataStr) {
          yield '\n';
          continue;
        }

        // data 可能是 JSON 字符串 / JSON 对象 / 裸文本 / 裸数字（数字须转回 string，否则 token 丢失）
        try {
          const parsed = JSON.parse(dataStr);
          if (typeof parsed === 'string') {
            yield parsed;
          } else if (typeof parsed === 'number' || typeof parsed === 'boolean') {
            yield String(parsed);
          } else if (typeof parsed === 'object' && parsed !== null) {
            const text = (parsed as Record<string, unknown>).text ?? (parsed as Record<string, unknown>).content ?? '';
            if (text) yield String(text);
          }
        } catch {
          // 非 JSON，直接 yield 原文
          yield dataStr;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** 读取当前 locale（与 request.ts 的 accept-language 注入一致），默认 en */
const getGuardLocale = (): string => window.localStorage.getItem(LOCALE_KEY) || 'en';

/**
 * SSE 鉴权头：必须与 axios 实例（service.ts 拦截器）完全一致。
 * c_agent `middleware.StrictAuth` 对 Web3 登录（LoginMethod 0/1/2）会额外校验
 * `Address == claims.UserId`，缺这个头或大小写不匹配都会直接 401 —— 这正是
 * coin-analysis / daily-report 曾经报 401 的原因（watchlist 走 axios 所以正常）。
 * Address 必须保持登录返回的 checksummed 形式，不能转小写。
 *
 * @param address 调用方显式传入的用户地址（优先）；缺省时回退到 localStorage 中的登录地址
 */
const getGuardAuthHeaders = (address?: string): Record<string, string> => {
  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const resolvedAddress = address || window.localStorage.getItem(ADDRESS_KEY);
  return {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(resolvedAddress ? { Address: resolvedAddress } : {}),
    Source: '5',
  };
};

/** Guard SSE 流错误：保留后端业务错误码，供调用方映射本地化文案 */
export class GuardStreamError extends Error {
  code?: number;

  constructor(message: string, code?: number) {
    super(message);
    this.name = 'GuardStreamError';
    this.code = code;
  }
}

/** 流开始前的业务错误码（c_agent swagger `/guard/dify/*`） */
export const GUARD_ANALYSIS_DISABLED = 6110; // 未启用（503）
export const GUARD_TRIAL_EXPIRED = 6120;
export const GUARD_SUBSCRIPTION_EXPIRED = 6121;

/** 非 2xx 响应：401 走统一会话清理，其余解析 {code,message} 后抛出带错误码的异常 */
async function throwGuardStreamError(response: Response): Promise<never> {
  let message = `HTTP ${response.status}`;
  let code: number | undefined;
  // 401 时无论响应体是否为 JSON 都先走统一会话清理（与 service.ts 的 status 检查一致）
  if (response.status === 401) {
    handleUnauthorizedSession();
  }
  try {
    const body = (await response.json()) as { code?: number; message?: string };
    if (body?.message) message = body.message;
    if (typeof body?.code === 'number') code = body.code;
  } catch {
    // 响应体非 JSON，保留 HTTP 状态码信息
  }
  throw new GuardStreamError(message, code);
}

/**
 * 单币 AI 分析 SSE 流：POST /v1/guard/dify/coin-analysis，body {token_id}。
 * 契约见 c_agent docs/swagger.yaml：#/guard/dify/coin-analysis
 * （按 token_id 或身份键三元组取单币健康度，事件序列 start → message* → done）。
 * 错误码：6103 参数 / 6110 未启用(503) / 6120 试用过期 / 6121 订阅过期 / 6150 数据服务故障(502)。
 *
 * @param address 登录地址（checksummed），作为 `Address` 头传给 StrictAuth 校验
 */
export async function* coinAnalysisStream(
  tokenId: string,
  signal: AbortSignal,
  address?: string,
): AsyncGenerator<string> {
  const locale = getGuardLocale();

  const response = await fetch(`${API_BASE_URL}/v1/guard/dify/coin-analysis`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      // locale 走 Accept-Language（swagger 的解析链之一），不加自定义头避免触发预检
      'accept-language': locale,
      ...getGuardAuthHeaders(address),
    },
    body: JSON.stringify({ token_id: tokenId }),
  });

  if (!response.ok) {
    await throwGuardStreamError(response);
  }

  yield* parseGuardSSE(response, signal);
}

/**
 * AI 日报 SSE 流：GET /v1/guard/dify/daily-report?bg_locale=<locale>
 * 逐 chunk yield 文本，供打字机组件消费；signal 中止时静默结束。
 *
 * @param address 登录地址（checksummed），作为 `Address` 头传给 StrictAuth 校验
 */
export async function* dailyReportStream(signal: AbortSignal, address?: string): AsyncGenerator<string> {
  const locale = getGuardLocale();
  const url = `${API_BASE_URL}/v1/guard/dify/daily-report?bg_locale=${encodeURIComponent(locale)}`;

  const response = await fetch(url, {
    method: 'GET',
    signal,
    headers: {
      Accept: 'text/event-stream',
      'accept-language': locale,
      ...getGuardAuthHeaders(address),
    },
  });

  if (!response.ok) {
    await throwGuardStreamError(response);
  }

  yield* parseGuardSSE(response, signal);
}
