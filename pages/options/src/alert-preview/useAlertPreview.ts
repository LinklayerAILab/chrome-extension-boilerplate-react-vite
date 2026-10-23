/**
 * 预览取数：优先用 background 已开启推送时持久化的登录态拉真实告警，
 * 失败或未开启则回落到示例数据。
 *
 * 为什么从 chrome.storage.local 读 token：content-ui 把登录态写在各站点自己的
 * localStorage 里，options 页面跨源读不到；background 的 guardPushState 是
 * 同一扩展 origin 下唯一能拿到 accessToken 的地方。
 */
import type { AlertHealth, ReasonEntry, RenderContext, TriggeredAlert } from './render';

const GUARD_PUSH_STATE_KEY = 'guardPushState';
/** 与 chrome-extension/src/background/guard-push.ts 的 GuardPushState 对齐 */
interface GuardPushState {
  enabled?: boolean;
  accessToken?: string;
  address?: string;
  apiBaseUrl?: string;
}

export interface AuthInfo {
  accessToken: string;
  address: string;
  apiBaseUrl: string;
}

export interface LoadResult {
  ok: boolean;
  /** 真实数据 / 示例数据 */
  source: 'live' | 'sample';
  alerts: TriggeredAlert[];
  context: RenderContext;
  /** 真实数据加载失败时的原因，供 UI 提示 */
  error?: string;
}

export const readAuth = async (): Promise<AuthInfo | null> => {
  try {
    const raw = await chrome.storage.local.get(GUARD_PUSH_STATE_KEY);
    const state = raw?.[GUARD_PUSH_STATE_KEY] as GuardPushState | undefined;
    const accessToken = String(state?.accessToken ?? '').trim();
    const address = String(state?.address ?? '').trim();
    const apiBaseUrl = String(state?.apiBaseUrl ?? '').trim();
    if (!accessToken || !address || !apiBaseUrl) return null;
    return { accessToken, address, apiBaseUrl };
  } catch {
    return null;
  }
};

/** 与后端 StrictAuth 对齐：Source: 5 表示扩展来源，Address 必须保持 checksummed 形式 */
const authHeaders = (auth: AuthInfo): HeadersInit => ({
  Authorization: `Bearer ${auth.accessToken}`,
  Address: auth.address,
  Source: '5',
  'Content-Type': 'application/json',
});

interface AlertsResponseItem {
  id: number;
  token_id: string;
  symbol: string;
  level: string;
  color: string;
  is_double_sided_drain: boolean;
  reasons?: ReasonEntry[];
  computed_at?: string;
  created_at?: string;
}

const fetchAlerts = async (auth: AuthInfo): Promise<AlertsResponseItem[]> => {
  const url = `${auth.apiBaseUrl}/v1/guard/alerts?limit=20`;
  const res = await fetch(url, { headers: authHeaders(auth) });
  if (!res.ok) throw new Error(`alerts HTTP ${res.status}`);
  const body = (await res.json()) as { code?: number; data?: { items?: AlertsResponseItem[] } };
  if (body?.code !== 0) throw new Error(`alerts code ${body?.code}`);
  return body.data?.items ?? [];
};

interface WatchlistHealth {
  token: { token_id: string; symbol?: string; cex_symbol?: string };
  color?: string;
  level?: string;
  previous_color?: string;
  previous_level?: string;
  is_double_sided?: boolean;
  reasons?: ReasonEntry[];
  dex_risk?: AlertHealth['dex_risk'];
  cex_risk?: AlertHealth['cex_risk'];
  cross_risk?: AlertHealth['cross_risk'];
  computed_at?: string | null;
}

const fetchWatchlistHealth = async (auth: AuthInfo): Promise<Record<string, WatchlistHealth>> => {
  try {
    const res = await fetch(`${auth.apiBaseUrl}/v1/guard/watchlist`, { headers: authHeaders(auth) });
    if (!res.ok) return {};
    const body = (await res.json()) as { code?: number; data?: { items?: { health?: WatchlistHealth }[] } };
    if (body?.code !== 0) return {};
    const map: Record<string, WatchlistHealth> = {};
    for (const item of body.data?.items ?? []) {
      const h = item.health;
      if (h?.token?.token_id) map[h.token.token_id] = h;
    }
    return map;
  } catch {
    // 增强数据缺失不阻塞预览：对应渲染行会自然省略
    return {};
  }
};

const fetchPrices = async (
  auth: AuthInfo,
  symbols: string[],
): Promise<Record<string, { price: number; gain: number }>> => {
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  if (unique.length === 0) return {};
  try {
    const res = await fetch(`${auth.apiBaseUrl}/v1/guard/prices`, {
      method: 'POST',
      headers: authHeaders(auth),
      body: JSON.stringify({ cex_symbols: unique }),
    });
    if (!res.ok) return {};
    const body = (await res.json()) as {
      code?: number;
      data?: { items?: { cex_symbol: string; price: number; gain: number }[] };
    };
    if (body?.code !== 0) return {};
    const map: Record<string, { price: number; gain: number }> = {};
    for (const p of body.data?.items ?? []) {
      if (p?.cex_symbol) map[p.cex_symbol] = { price: p.price, gain: p.gain };
    }
    return map;
  } catch {
    return {};
  }
};

const fetchLiquidity = async (auth: AuthInfo, tokenIds: string[]): Promise<RenderContext['liquidityChange']> => {
  const unique = Array.from(new Set(tokenIds.filter(Boolean)));
  if (unique.length === 0) return {};
  try {
    const res = await fetch(`${auth.apiBaseUrl}/v1/guard/liquidity_change`, {
      method: 'POST',
      headers: authHeaders(auth),
      body: JSON.stringify({ token_ids: unique }),
    });
    if (!res.ok) return {};
    const body = (await res.json()) as {
      code?: number;
      data?: Record<
        string,
        { cex?: { current_usd?: number; depth_change_pct?: number; window?: string }; dex?: { depth_usd?: number } }
      >;
    };
    if (body?.code !== 0) return {};
    return body.data ?? {};
  } catch {
    return {};
  }
};

/** 用 /alerts 的扁平字段 + /watchlist 的 health 拼出渲染所需结构 */
const toTriggeredAlert = (item: AlertsResponseItem, healthById: Record<string, WatchlistHealth>): TriggeredAlert => {
  const live = healthById[item.token_id];
  return {
    eventId: item.id,
    health: {
      token: {
        token_id: item.token_id,
        symbol: item.symbol || live?.token?.symbol,
        cex_symbol: live?.token?.cex_symbol,
      },
      color: item.color || live?.color || 'green',
      level: item.level || live?.level || 'Low',
      previous_color: live?.previous_color,
      previous_level: live?.previous_level,
      is_double_sided: item.is_double_sided_drain ?? live?.is_double_sided,
      reasons: item.reasons ?? live?.reasons,
      dex_risk: live?.dex_risk,
      cex_risk: live?.cex_risk,
      cross_risk: live?.cross_risk,
      computed_at: item.computed_at ?? live?.computed_at,
    },
  };
};

/** 拉真实数据；任一关键请求失败即抛错，由调用方回落示例 */
export const loadLiveAlerts = async (auth: AuthInfo): Promise<{ alerts: TriggeredAlert[]; context: RenderContext }> => {
  const items = await fetchAlerts(auth);
  if (items.length === 0) {
    return { alerts: [], context: { liquidityChange: {}, prices: {}, dailyByToken: {} } };
  }

  const tokenIds = items.map(i => i.token_id);

  // watchlist 既提供 health 补全，也提供 prices 需要的 cex_symbol，先取一次再并行其余两项
  const healthById = await fetchWatchlistHealth(auth);
  const symbols = Object.values(healthById)
    .map(h => h.token?.cex_symbol ?? '')
    .filter(Boolean);

  const [prices, liquidityChange] = await Promise.all([fetchPrices(auth, symbols), fetchLiquidity(auth, tokenIds)]);

  return {
    alerts: items.map(i => toTriggeredAlert(i, healthById)),
    context: { liquidityChange, prices, dailyByToken: {} },
  };
};
