/**
 * Guard 推送语言同步（用户级设置）。
 *
 * 后端 GET/PUT /v1/guard/me/lang：
 *   GET  → { locale: "zh"|"en"|"ja"|"ru"|"ko"|"auto", manual: boolean }
 *   PUT  → 请求体 { locale }，'auto' 表示恢复跟随设备语言
 *
 * 语义：用户级 override 对全部设备生效；auto 时按订阅时上报的设备语言渲染。
 * 客户端首次进入需 GET 拉取并覆盖本地语言；用户手动切换后 PUT 同步。
 */
import { API_BASE_URL } from '@src/api/config';
import { ACCESS_TOKEN_KEY, ADDRESS_KEY, LOCALE_KEY } from '@src/lib/storageKeys';
import type { Locale } from '@src/lib/i18n';

/** 与 I18nProvider 使用同一个存储键（@Linklayerai/content-ui-locale） */
const LOCALE_STORAGE_KEY = LOCALE_KEY;

/** 后端返回的语言值；auto 表示未设置、跟随设备 */
export type ServerLocale = Locale | 'auto';

export interface UserLangState {
  locale: ServerLocale;
  /** 是否手动设置（服务端推导字段，auto 时为 false） */
  manual: boolean;
}

const SERVICE_LOCALES = new Set(['zh', 'en', 'ja', 'ru', 'ko']);

/** 后端约定：Source: 5 表示扩展来源，Address 必须保持 checksummed 形式 */
const authHeaders = (): Record<string, string> | null => {
  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const address = window.localStorage.getItem(ADDRESS_KEY);
  if (!accessToken || !address) return null;
  return {
    Authorization: `Bearer ${accessToken}`,
    Address: address,
    Source: '5',
    'Content-Type': 'application/json',
  };
};

/**
 * 规范化服务端返回的 locale。
 * 后端接受 zh-CN 这类区域后缀并会归一化，这里再兜一层：
 * 未知值一律视为 auto，避免把非法值写进本地语言状态。
 */
const normalizeLocale = (value: unknown): ServerLocale => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'auto') return 'auto';
  const base = raw.split(/[-_]/)[0];
  return SERVICE_LOCALES.has(base) ? (base as Locale) : 'auto';
};

/** 读取用户推送语言设置；未登录或请求失败返回 null（调用方保持本地值） */
export const getGuardPushLang = async (): Promise<UserLangState | null> => {
  if (!API_BASE_URL) return null;
  const headers = authHeaders();
  if (!headers) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/v1/guard/me/lang`, { headers });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      code?: number;
      data?: { locale?: string; manual?: boolean };
    };
    if (body?.code !== 0) return null;
    return {
      locale: normalizeLocale(body.data?.locale),
      manual: Boolean(body.data?.manual),
    };
  } catch {
    // 网络抖动：保持本地语言，不阻断 UI
    return null;
  }
};

/**
 * 同步用户推送语言到服务端。
 * auto 恢复跟随设备语言；具体语言则对全部设备生效。
 * 失败静默（本地语言已生效，下次切换时再试）。
 */
export const putGuardPushLang = async (locale: ServerLocale): Promise<boolean> => {
  if (!API_BASE_URL) return false;
  const headers = authHeaders();
  if (!headers) return false;

  try {
    const res = await fetch(`${API_BASE_URL}/v1/guard/me/lang`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ locale }),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { code?: number };
    return body?.code === 0;
  } catch {
    return false;
  }
};

/** 读取本地已生效的语言（chrome.storage → localStorage → 浏览器语言），返回 null 表示无可用值 */
const readLocalLocale = async (): Promise<Locale | null> => {
  try {
    const stored = await chrome.storage.local.get([LOCALE_STORAGE_KEY]);
    const value = stored[LOCALE_STORAGE_KEY];
    if (typeof value === 'string' && SERVICE_LOCALES.has(value)) return value as Locale;
  } catch {
    // 存储不可用：继续尝试 localStorage
  }

  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw && SERVICE_LOCALES.has(raw)) return raw as Locale;
  } catch {
    // ignore
  }

  const fromBrowser = (navigator.language || '').split(/[-_]/)[0].toLowerCase();
  return SERVICE_LOCALES.has(fromBrowser) ? (fromBrowser as Locale) : null;
};

/**
 * 账号切换/登录后立刻把本地语言同步到新账号。
 *
 * 为什么需要：推送语言是用户级设置，新账号在服务端通常是 auto（跟随订阅时的
 * 设备语言）。本地明明有明确语言，若不同步，新账号的告警推送会用默认英语渲染，
 * 与界面语言不一致。这里在拿到新 token 后立即 PUT，不等下一次打开侧边栏。
 *
 * 不读服务端当前值：切号场景下服务端一定属于新账号（要么 auto，要么该账号
 * 自己设过）。若是后者，用本地语言覆盖也符合「界面即所见」的直觉。
 */
export const syncPushLangForCurrentUser = async (): Promise<boolean> => {
  const locale = await readLocalLocale();
  if (!locale) return false;
  return putGuardPushLang(locale);
};
