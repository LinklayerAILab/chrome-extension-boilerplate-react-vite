import { API_BASE_URL } from '@src/api/config';
import { ACCESS_TOKEN_KEY, ADDRESS_KEY, GUARD_PUSH_AUTH_KEY, GUARD_PUSH_PROMPT_SKIPPED_KEY } from './storageKeys';

/**
 * Guard 告警通知（扩展 background 轮询版）
 *
 * 为什么不用 Web Push：MV3 扩展无法创建 push 订阅（拿不到 web 域的 SW 注册），
 * 且后台 guard.push.enabled 尚未开启。这里改为由 background 定时轮询
 * GET /v1/guard/alerts?unread_only=1，命中新告警就调用 chrome.notifications 弹系统通知。
 *
 * 关于「授权」：chrome.notifications 依赖 manifest 里的 notifications 权限（安装时已授予），
 * 不需要 Notification.requestPermission()——内容脚本里调用它请求的是宿主网站的权限，
 * 与扩展通知无关。因此这里用弹窗本身作为用户的确认动作。
 */

/** 本地推送状态：记录用户是否已开启告警通知 */
export interface GuardPushAuthState {
  /** 用户已在引导弹窗中确认开启 */
  enabled: boolean;
  /** 最近一次更新时间戳 */
  updatedAt: number;
}

const readState = (): GuardPushAuthState | null => {
  try {
    const raw = window.localStorage.getItem(GUARD_PUSH_AUTH_KEY);
    return raw ? (JSON.parse(raw) as GuardPushAuthState) : null;
  } catch {
    return null;
  }
};

const writeState = (state: GuardPushAuthState): void => {
  try {
    window.localStorage.setItem(GUARD_PUSH_AUTH_KEY, JSON.stringify(state));
  } catch {
    // localStorage 不可用（隐私模式等）时静默，不影响主流程
  }
};

/** 清空本地状态并让 background 停止轮询（登出时调用） */
export const clearGuardPushAuth = (): void => {
  try {
    window.localStorage.removeItem(GUARD_PUSH_AUTH_KEY);
  } catch {
    // ignore
  }
  chrome.runtime.sendMessage({ type: 'GUARD_PUSH_DISABLE' }, () => {
    // background 未响应（刚重载等）时忽略
    void chrome.runtime.lastError;
  });
};

/** 用户是否已在本机开启告警通知（不含「稍后」标记判断） */
export const isGuardPushEnabled = (): boolean => Boolean(readState()?.enabled);

/**
 * 是否需要引导用户开启告警通知。
 * 只看本地状态与「稍后」标记，不查后端权益。
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
        writeState({ enabled: true, updatedAt: Date.now() });
        try {
          window.localStorage.removeItem(GUARD_PUSH_PROMPT_SKIPPED_KEY);
        } catch {
          // ignore
        }
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
