import { API_BASE_URL } from '@src/api/config';
import { ACCESS_TOKEN_KEY, ADDRESS_KEY, GUARD_PUSH_PROMPT_SKIPPED_KEY } from './storageKeys';

/**
 * Guard 告警通知（扩展 background 轮询版）
 *
 * 为什么不用 Web Push：MV3 扩展无法创建 push 订阅（拿不到 web 域的 SW 注册）。
 * 改为 background 用 chrome.alarms 轮询 GET /v1/guard/messages，命中新消息
 * 就调用 chrome.notifications 弹系统通知。
 *
 * 关于「是否开启」的存储位置 —— 这是本模块最关键的设计约束：
 *
 * 原实现把开关存在 window.localStorage，但它是**按站点 origin 隔离**的。
 * 在 x.com 开启推送后，切到 binance.com 读到的是 null；更糟的是任何站点的
 * 401 会话清理都会删掉当前站点那一份，导致 isGuardPushEnabled() 永久为 false，
 * enableGuardPush() 再也不会被调用，background 的轮询就此停死且无自愈路径。
 *
 * 现在唯一真相源改为 chrome.storage.local 的 guardPushState（background 维护），
 * 即「background 是否持有有效登录态并在轮询」。跨站点、跨页面共享，不受站点
 * 会话清理影响。本地只保留一个内存缓存用于同步读取。
 */

/** 与 background 的 STORAGE_KEY 保持一致 */
const GUARD_PUSH_STATE_KEY = 'guardPushState';

interface GuardPushStateLike {
  enabled?: boolean;
  accessToken?: string;
  address?: string;
}

/** 内存缓存：让 isGuardPushEnabled() 可同步调用 */
let cachedEnabled = false;
let cachedAddress = '';

/** 首次水合；重复调用复用同一个 Promise */
let hydration: Promise<void> | null = null;

const hydrate = (): Promise<void> => {
  if (hydration) return hydration;

  hydration = (async () => {
    try {
      const stored = await chrome.storage.local.get(GUARD_PUSH_STATE_KEY);
      const state = stored[GUARD_PUSH_STATE_KEY] as GuardPushStateLike | undefined;
      cachedEnabled = Boolean(state?.enabled);
      cachedAddress = String(state?.address ?? '');
    } catch {
      cachedEnabled = false;
    }
  })();

  return hydration;
};

// 模块加载即水合；跨页面/跨站点共享同一份 chrome.storage
void hydrate();

// background 写入状态后同步缓存（enable/disable/换号都会触发）
try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(GUARD_PUSH_STATE_KEY in changes)) return;
    const next = changes[GUARD_PUSH_STATE_KEY].newValue as GuardPushStateLike | undefined;
    cachedEnabled = Boolean(next?.enabled);
    cachedAddress = String(next?.address ?? '');
  });
} catch {
  // 非扩展环境（如单测）忽略
}

/** 清理本地「稍后」引导标记 */
const clearSkippedMark = (): void => {
  try {
    window.localStorage.removeItem(GUARD_PUSH_PROMPT_SKIPPED_KEY);
  } catch {
    // ignore
  }
};

/**
 * 清空推送状态并让 background 停止轮询（登出时调用）。
 * 注意：这会在所有站点/页面上同时生效，因为真相源是扩展级存储。
 */
export const clearGuardPushAuth = (): void => {
  cachedEnabled = false;
  cachedAddress = '';
  chrome.runtime.sendMessage({ type: 'GUARD_PUSH_DISABLE' }, () => {
    // background 未响应（刚重载等）时忽略
    void chrome.runtime.lastError;
  });
};

/** 用户是否已在本机开启告警通知（不含「稍后」标记判断） */
export const isGuardPushEnabled = (): boolean => cachedEnabled;

/** 当前轮询使用的地址；用于判断是否需要换号重同步 */
export const getGuardPushAddress = (): string => cachedAddress;

/**
 * 是否需要引导用户开启告警通知。
 * 只看本地开关与「稍后」标记，不查后端权益。
 */
export const shouldPromptGuardPush = (): boolean => {
  if (isGuardPushEnabled()) return false;

  try {
    if (window.localStorage.getItem(GUARD_PUSH_PROMPT_SKIPPED_KEY)) return false;
  } catch {
    // localStorage 不可用时按未跳过处理
  }

  return true;
};

export interface EnablePushResult {
  ok: boolean;
  message?: string;
}

/**
 * 开启告警通知：
 * 把登录态交给 background（chrome.storage.local 持久化），由它建立 1 分钟一次的通知轮询。
 */
export const enableGuardPush = (): Promise<EnablePushResult> =>
  new Promise(resolve => {
    const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY) || '';
    const address = window.localStorage.getItem(ADDRESS_KEY) || '';

    if (!accessToken || !address) {
      resolve({ ok: false, message: 'Please login first' });
      return;
    }
    if (!API_BASE_URL) {
      resolve({ ok: false, message: 'API base url is not configured' });
      return;
    }

    chrome.runtime.sendMessage(
      { type: 'GUARD_PUSH_ENABLE', accessToken, address, apiBaseUrl: API_BASE_URL },
      response => {
        if (chrome.runtime.lastError || !response?.success) {
          resolve({ ok: false, message: chrome.runtime.lastError?.message || response?.error });
          return;
        }
        // 乐观更新缓存；background 落盘后 storage.onChanged 会再校准一次
        cachedEnabled = true;
        cachedAddress = address;
        clearSkippedMark();
        resolve({ ok: true });
      },
    );
  });

/** 供设置面板手动触发一次立即检查（可选） */
export const pollGuardPushNow = (): void => {
  chrome.runtime.sendMessage({ type: 'GUARD_PUSH_POLL_NOW' }, () => {
    void chrome.runtime.lastError;
  });
};

/**
 * 自愈：确保 background 的轮询状态与本地登录态一致。
 *
 * 两个场景会留下不一致：
 *   1. 扩展重载 / background 崩溃后 guardPushState 丢失，但用户确实开过推送；
 *   2. 换了站点或换了账号，background 里的 token/address 与当前不一致。
 *
 * 因此不再依赖「本地开关存在」这个前提，而是直接比对：
 *   - background 从未有过状态且用户没开过 → 不做任何事（不擅自开启）
 *   - 曾经开过（cachedEnabled）但状态丢了 → 重新同步
 *   - 状态存在但地址与当前登录不符 → 用新登录态覆盖
 */
export const ensureGuardPushSync = (): void => {
  void (async () => {
    await hydrate();

    const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY) || '';
    const address = window.localStorage.getItem(ADDRESS_KEY) || '';
    // 未登录：无事可做（保持现状，等登录后 handleSiweLogin 会同步）
    if (!accessToken || !address) return;

    const needsSync = cachedEnabled || cachedAddress !== address;
    if (!needsSync) return;

    try {
      await enableGuardPush();
    } catch (error) {
      console.warn('[guardPush] self-heal failed:', error);
    }
  })();
};
