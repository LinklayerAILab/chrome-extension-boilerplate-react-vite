/**
 * Guard 消息中心数据层。
 *
 * 对接后端 GET /v1/guard/messages?type=unread|read|all&limit=&offset=
 * 响应：{ items: [{ id, title, content, locale, token_count, created_at }],
 *        total, limit, offset }
 *
 * 页面不区分已读/未读，统一按「全部」拉取；read_at 字段有意不解析。
 * 后端「查询即已读」对这里无影响——本页只做展示，不消费未读态的业务线索。
 */

export type MessageFilter = 'unread' | 'read' | 'all';

export interface GuardMessage {
  id: number;
  /** 消息头，如「🚨 流动性保镖 · 2026-10-23 10:00」 */
  title: string;
  /** 合并正文：触发数行 + 逐币种块 + 免责声明 */
  content: string;
  /** 生成时渲染语言 */
  locale: string;
  /** 本轮触发币数 */
  token_count: number;
  created_at: string;
}

export interface MessagesPage {
  items: GuardMessage[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuthInfo {
  accessToken: string;
  address: string;
  apiBaseUrl: string;
}

const GUARD_PUSH_STATE_KEY = 'guardPushState';

/** 与 chrome-extension/src/background/guard-push.ts 的 GuardPushState 对齐 */
interface GuardPushState {
  enabled?: boolean;
  accessToken?: string;
  address?: string;
  apiBaseUrl?: string;
}

/**
 * 读取登录态。
 * content-ui 把 token 写在各站点自己的 localStorage，options 跨源读不到；
 * background 的 guardPushState 是同一扩展 origin 下唯一能拿到 accessToken 的地方。
 */
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
});

/** 消息加载失败：只带错误类型，文案由 UI 层按当前语言渲染 */
export class MessageLoadError extends Error {
  readonly kind: 'unauthorized' | 'http' | 'business';
  readonly status?: number;
  readonly code?: number;

  constructor(kind: 'unauthorized' | 'http' | 'business', detail?: { status?: number; code?: number; message?: string }) {
    super(detail?.message ?? kind);
    this.name = 'MessageLoadError';
    this.kind = kind;
    this.status = detail?.status;
    this.code = detail?.code;
  }
}

/** 分页拉取消息。limit 上限 100（后端钳制），offset >= 0 */
export const fetchMessages = async (
  auth: AuthInfo,
  filter: MessageFilter,
  limit: number,
  offset: number,
): Promise<MessagesPage> => {
  const params = new URLSearchParams({
    type: filter,
    limit: String(limit),
    offset: String(offset),
  });
  const res = await fetch(`${auth.apiBaseUrl}/v1/guard/messages?${params.toString()}`, {
    headers: authHeaders(auth),
  });
  if (res.status === 401) throw new MessageLoadError('unauthorized');
  if (!res.ok) throw new MessageLoadError('http', { status: res.status });

  const body = (await res.json()) as { code?: number; message?: string; data?: MessagesPage };
  if (body?.code !== 0) {
    throw new MessageLoadError('business', { code: body?.code, message: body?.message });
  }
  return {
    items: body.data?.items ?? [],
    total: body.data?.total ?? 0,
    limit: body.data?.limit ?? limit,
    offset: body.data?.offset ?? offset,
  };
};

/** 渲染消息日期，格式：2026-10-23 10:00 */
export const formatMessageDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
