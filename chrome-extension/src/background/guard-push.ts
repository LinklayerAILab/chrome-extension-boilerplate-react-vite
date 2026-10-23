/**
 * Guard 告警通知（background 轮询版）
 *
 * 背景：MV3 扩展无法自行创建 Web Push 订阅（拿不到 web 域的 Service Worker 注册），
 * 而 web 域的 opt-in 页 / sw.js 尚未交付。因此这里用 chrome.alarms 定时轮询
 * `GET /v1/guard/alerts?unread_only=1`，发现新告警就调用 chrome.notifications 弹出系统通知。
 *
 * 限制（与 Web Push 的差异，需知悉）：
 * - 仅在浏览器运行时有效（关闭浏览器收不到）；
 * - 最小轮询粒度 1 分钟（chrome.alarms 限制）；
 * - 靠本地 lastSeenId 去重，换账号/登出会重置。
 */

const STORAGE_KEY = 'guardPushState';
const ALARM_NAME = 'guard-push-poll';
const POLL_INTERVAL_MINUTES = 1;
const NOTIFICATION_PREFIX = 'guard-alert:';

export interface GuardPushState {
  /** 是否开启（用户在授权弹窗里点过「开启通知」） */
  enabled: boolean;
  accessToken: string;
  /** 登录地址（checksummed），StrictAuth 校验用 */
  address: string;
  /** 接口根地址（由 content-ui 带入，避免 background 侧重复注入 env） */
  apiBaseUrl: string;
  /** 已通知过的最大告警 id，用于去重 */
  lastSeenId: number;
  /** 首次开启时置 true，用于跳过存量告警 */
  initialized: boolean;
}

interface GuardAlertItem {
  id: number;
  token_id: string;
  symbol: string;
  level: string;
  color: string;
  reasons?: unknown[];
  created_at: string;
}

const DEFAULT_STATE: GuardPushState = {
  enabled: false,
  accessToken: '',
  address: '',
  apiBaseUrl: '',
  lastSeenId: 0,
  initialized: false,
};

const readState = async (): Promise<GuardPushState> => {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_STATE, ...(result[STORAGE_KEY] as Partial<GuardPushState> | undefined) };
};

const writeState = async (patch: Partial<GuardPushState>): Promise<GuardPushState> => {
  const next = { ...(await readState()), ...patch };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
};

/** 停止轮询并清空登录态（登出时调用） */
export const disableGuardPushPolling = async (): Promise<void> => {
  await chrome.storage.local.remove(STORAGE_KEY);
  await chrome.alarms.clear(ALARM_NAME);
};

/**
 * 确保轮询 alarm 与已持久化的开关状态一致（自愈）。
 *
 * 为什么需要：chrome.alarms 在扩展重载 / 浏览器重启后会被清空，而
 * guardPushState.enabled 仍保存在 chrome.storage.local 里。若不在启动时重建，
 * UI 看起来「已开启」，实际永远不会轮询，告警静默失效。
 */
const ensureAlarm = async (): Promise<void> => {
  try {
    const state = await readState();
    const existing = await chrome.alarms.get(ALARM_NAME);
    const shouldPoll = state.enabled && Boolean(state.accessToken) && Boolean(state.apiBaseUrl);

    if (shouldPoll) {
      if (!existing) {
        await chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_INTERVAL_MINUTES });
      }
      return;
    }

    // 已关闭却残留 alarm（异常退出等）：一并清掉，避免无谓唤醒
    if (existing) await chrome.alarms.clear(ALARM_NAME);
  } catch {
    // 自愈失败不影响 service worker 其他逻辑，下次唤醒会再试
  }
};

/** 开启/更新轮询（内容脚本登录态变化时调用） */
export const enableGuardPushPolling = async (payload: {
  accessToken: string;
  address: string;
  apiBaseUrl: string;
}): Promise<void> => {
  const prev = await readState();
  const accountChanged = prev.address !== payload.address || prev.accessToken !== payload.accessToken;

  await writeState({
    enabled: true,
    accessToken: payload.accessToken,
    address: payload.address,
    apiBaseUrl: payload.apiBaseUrl,
    // 换账号时重置去重游标，避免把上一个账号的告警当成「已通知」
    lastSeenId: accountChanged ? 0 : prev.lastSeenId,
    initialized: accountChanged ? false : prev.initialized,
  });

  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_INTERVAL_MINUTES });
  // 立即跑一轮，用户点完「开启通知」就能看到反馈
  void pollGuardAlerts();
};

const levelIcon = (color?: string): string => {
  const value = String(color ?? '').toLowerCase();
  if (value === 'red') return '🔴';
  if (value === 'yellow') return '🟡';
  return '🟢';
};

const buildNotification = (alert: GuardAlertItem) => {
  const symbol = alert.symbol || alert.token_id;
  const level = alert.level || 'Unknown';
  return {
    type: 'basic' as const,
    iconUrl: chrome.runtime.getURL('icon-128.png'),
    title: `${levelIcon(alert.color)} ${symbol} · ${level}`,
    message: 'Liquidity risk detected. Click to open Piloter.',
    contextMessage: 'LinkLayer AI Guard',
    priority: 2,
  };
};

/**
 * 把本轮拉到的告警标记为已读。
 *
 * 为什么必须做：轮询用 unread_only=1 取数，若不回写 read_at，未读集合只增不减
 * （线上曾达 1099 条），列表很快触顶 limit=20，更新更旧的告警会被永久跳过。
 * 标记已读后 unread_only 退化为「尚未处理过的」。
 *
 * 单条失败不影响其余：下一轮还会重新取到它，再由 lastSeenId 去重兜底。
 */
const markAlertsRead = async (state: GuardPushState, items: GuardAlertItem[]): Promise<void> => {
  await Promise.all(
    items.map(async item => {
      if (item.id === undefined || item.id === null) return;
      try {
        await fetch(`${state.apiBaseUrl}/v1/guard/alerts/${item.id}/read`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${state.accessToken}`,
            Address: state.address,
            Source: '5',
          },
        });
      } catch {
        // 网络抖动：忽略，下一轮会再次拉到并重试
      }
    }),
  );
};

/** 轮询未读告警并推送系统通知 */
export const pollGuardAlerts = async (): Promise<void> => {
  const state = await readState();
  if (!state.enabled || !state.accessToken || !state.apiBaseUrl) return;

  const url = `${state.apiBaseUrl}/v1/guard/alerts?unread_only=1&limit=20`;
  let items: GuardAlertItem[] = [];
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        Address: state.address,
        Source: '5',
      },
    });

    if (res.status === 401) {
      // 会话失效：停止轮询，等用户重新登录后再同步
      await disableGuardPushPolling();
      return;
    }
    if (!res.ok) return;

    const body = (await res.json()) as { code?: number; data?: { items?: GuardAlertItem[] } };
    if (body?.code !== 0) return;
    items = body.data?.items || [];
  } catch {
    // 网络抖动：下一轮重试
    return;
  }

  if (items.length === 0) return;

  const maxId = items.reduce((max, item) => Math.max(max, item.id ?? 0), 0);

  // 首次开启：只记录游标，不把历史告警全部弹一遍
  if (!state.initialized) {
    await writeState({ lastSeenId: maxId, initialized: true });
    void markAlertsRead(state, items);
    return;
  }

  const fresh = items.filter(item => (item.id ?? 0) > state.lastSeenId).sort((a, b) => a.id - b.id);

  if (fresh.length > 0) {
    for (const alert of fresh) {
      chrome.notifications.create(`${NOTIFICATION_PREFIX}${alert.id}`, buildNotification(alert));
    }
    await writeState({ lastSeenId: maxId });
  }

  // 无论是否推送都标记已读：游标之前的存量数据也要清空，否则未读集合会持续膨胀
  void markAlertsRead(state, items);
};

/** 点击通知：在当前标签页打开侧边栏，没有可用标签页时打开 web 域 */
export const handleGuardNotificationClick = async (notificationId: string): Promise<void> => {
  if (!notificationId.startsWith(NOTIFICATION_PREFIX)) return;
  chrome.notifications.clear(notificationId);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && tab.url && !/^(chrome|edge|about):/.test(tab.url)) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_SIDEPANEL' });
      return;
    } catch {
      // 未注入内容脚本：注入后重试
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['/content-ui/all.iife.js'] });
        await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_SIDEPANEL' });
        return;
      } catch {
        // 落到下面的兜底
      }
    }
  }

  const fallbackUrl = chrome.runtime.getURL('options/index.html');
  chrome.tabs.create({ url: fallbackUrl, active: true });
};

/** 注册 alarm / notification 监听（background 启动时调用一次） */
export const registerGuardPushListeners = (): void => {
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === ALARM_NAME) void pollGuardAlerts();
  });

  chrome.notifications.onClicked.addListener(notificationId => {
    void handleGuardNotificationClick(notificationId);
  });

  // 浏览器启动 / 扩展安装或更新后 alarm 会被清空，需按已持久化的开关状态重建
  chrome.runtime.onStartup.addListener(() => void ensureAlarm());
  chrome.runtime.onInstalled.addListener(() => void ensureAlarm());

  // service worker 任何一次唤醒都顺带校准一次，覆盖「浏览器崩溃后重启」等未触发上述事件的场景
  void ensureAlarm();
};
