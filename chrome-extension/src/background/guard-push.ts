/**
 * Guard 站内消息通知（background 轮询版）
 *
 * 后端自 2026-10-23 起把告警改为「拉取式消息中心」：评估 cron 每轮把该用户全部触发币
 * 合并成一条消息写入 guard_messages，前端 GET /v1/guard/messages 分页拉取。
 * 本文件负责用 chrome.alarms 定时轮询未读消息并弹系统通知。
 *
 * 关于「查询即已读」：后端对返回页内的未读行会自动置读（type=unread/all 均生效）。
 * 这里有意接受这个副作用 —— 系统通知弹出即代表用户已被提醒，未读角标随之清零是
 * 合理语义；因为不再需要前端逐条调用 /alerts/:id/read。
 *
 * 限制（与 Web Push 的差异，需知悉）：
 * - 仅在浏览器运行时有效（关闭浏览器收不到）；
 * - chrome.alarms 的最小周期是 1 分钟；实际间隔见 POLL_INTERVAL_MINUTES（生产 10 / 非生产 5）；
 * - 靠本地 lastSeenMessageId 去重，换账号/登出会重置。
 */

import { buildMessageSummary } from '@extension/shared';

const STORAGE_KEY = 'guardPushState';
const ALARM_NAME = 'guard-push-poll';
/**
 * 轮询间隔（分钟）。
 *
 * 生产环境放宽到 10 分钟：告警本身由后端 cron 评估，10 分钟延迟可接受，
 * 而每分钟一轮 = 每用户每天 1440 次请求，对后端是纯空转成本。
 * 非生产（dev / test 预设）保留 5 分钟，便于联调时快速看到通知。
 *
 * 判据用 CEB_ENV 而非 CLI_CEB_DEV：build:test 是生产形态构建但连测试后端，
 * 与 pages/content-ui/src/matches/all/config/payment.ts 的取舍保持一致。
 */
const IS_PRODUCTION_ENV = (process.env.CEB_ENV ?? 'prod') === 'prod';
const POLL_INTERVAL_MINUTES = IS_PRODUCTION_ENV ? 10 : 5;
const NOTIFICATION_PREFIX = 'guard-msg:';
/**
 * 每轮拉取的未读消息条数。
 *
 * 后端每轮评估会把该用户全部触发币合并成一条消息，但「查询即已读」+ 积压场景下
 * 一轮仍可能返回多条（实测 5 条，total 达 700）。因此通知侧只推最新一条，
 * 避免重启后瞬间刷出一串系统通知。
 */
const POLL_LIMIT = 10;

export interface GuardPushState {
  /** 是否开启（用户在授权弹窗里点过「开启通知」） */
  enabled: boolean;
  accessToken: string;
  /** 登录地址（checksummed），StrictAuth 校验用 */
  address: string;
  /** 接口根地址（由 content-ui 带入，避免 background 侧重复注入 env） */
  apiBaseUrl: string;
  /**
   * 已通知过的最大「消息」id，用于去重。
   *
   * 注意：这是 guard_messages.id，与告警事件 guard_signal_event.id 是两个独立的
   * 自增序列。旧版本轮询 /guard/alerts 时把 lastSeenId 写成了事件 id（可达数千），
   * 而消息 id 才两位数，直接复用会让 `id > lastSeenId` 永远为假、通知永久静默。
   * 因此改用独立字段名，旧字段视为遗留、不再读取。
   */
  lastSeenMessageId: number;
  /** 首次开启时置 true，用于跳过存量消息 */
  initialized: boolean;
}

/** GET /v1/guard/messages 的消息项 */
interface GuardMessageItem {
  id: number;
  /** 消息头，如「🚨 流动性保镖 · 2026-10-23 10:00」 */
  title: string;
  /** 合并正文：触发数行 + 逐币种块 + 免责声明 */
  content: string;
  /** 生成时渲染语言 */
  locale: string;
  /** 本轮触发币数 */
  token_count: number;
  read_at: string | null;
  created_at: string;
}

const DEFAULT_STATE: GuardPushState = {
  enabled: false,
  accessToken: '',
  address: '',
  apiBaseUrl: '',
  lastSeenMessageId: 0,
  initialized: false,
};

const readState = async (): Promise<GuardPushState> => {
  const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as
    | (Partial<GuardPushState> & { lastSeenId?: number })
    | undefined;
  if (!stored) return { ...DEFAULT_STATE };

  // 一次性迁移：旧版把告警事件 id 写进 lastSeenId（可达数千），与消息 id 空间不兼容，
  // 直接复用会让 `id > lastSeenId` 永远为假、通知永久静默。
  // 检测到只有旧字段时丢弃游标并重置 initialized，同时立即写回，
  // 避免存储里残留旧值导致状态显示与实际行为不一致。
  if (stored.lastSeenMessageId === undefined) {
    const migrated: GuardPushState = {
      ...DEFAULT_STATE,
      ...stored,
      lastSeenMessageId: 0,
      initialized: false,
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: migrated });
    return migrated;
  }
  return { ...DEFAULT_STATE, ...stored };
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
 *
 * 周期也要校准：alarm 一旦创建就会带着当时的周期一直活下去，旧版本建的
 * 1 分钟 alarm 不会因为改了常量而自动变短。这里比对 periodInMinutes，
 * 不一致就按当前环境重建。
 */
const ensureAlarm = async (): Promise<void> => {
  try {
    const state = await readState();
    const existing = await chrome.alarms.get(ALARM_NAME);
    const shouldPoll = state.enabled && Boolean(state.accessToken) && Boolean(state.apiBaseUrl);

    if (shouldPoll) {
      if (!existing || existing.periodInMinutes !== POLL_INTERVAL_MINUTES) {
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
    // 换账号时重置去重游标，避免把上一个账号的消息当成「已通知」
    lastSeenMessageId: accountChanged ? 0 : prev.lastSeenMessageId,
    initialized: accountChanged ? false : prev.initialized,
  });

  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_INTERVAL_MINUTES });
  // 立即跑一轮，用户点完「开启通知」就能看到反馈
  void pollGuardMessages();
};

/**
 * 系统通知正文里，冒号后追加的风险明细最多展示的字符数。
 * 系统通知栏空间有限，比 options 列表行（30 字）更短。
 */
const NOTIFICATION_SUMMARY_LIMIT = 15;

/**
 * 通知标题：直接复用后端渲染的消息头（已含 🚨 与时间）。
 * Chrome 通知标题过长会被截断，超限时回退到「N 个币种触发风险」。
 */
const buildNotification = (message: GuardMessageItem) => {
  const title = message.title?.trim() || 'Guard Alert';
  const summary = message.content ? buildMessageSummary(message.content, NOTIFICATION_SUMMARY_LIMIT) : '';
  return {
    type: 'basic' as const,
    iconUrl: chrome.runtime.getURL('icon-128.png'),
    title,
    message: summary || `${message.token_count} 个币种触发风险`,
    contextMessage: 'LinkLayer AI Guard',
    priority: 2,
  };
};

/** 轮询未读消息并推送系统通知 */
export const pollGuardMessages = async (): Promise<void> => {
  const state = await readState();
  if (!state.enabled || !state.accessToken || !state.apiBaseUrl) return;

  const url = `${state.apiBaseUrl}/v1/guard/messages?type=unread&limit=${POLL_LIMIT}`;
  let items: GuardMessageItem[] = [];
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        Address: state.address,
        Source: '5',
      },
    });

    if (res.status === 401) {
      /**
       * 会话失效。但不能无条件停掉轮询：
       *
       * 账号切换时 enableGuardPush() 会写入新 token，而切换过程中旧 token 的
       * 下一次轮询可能先返回 401。若此时直接 disableGuardPushPolling()，会把
       * 刚建立的新账号轮询一并删除，表现为「切换账号后再也不轮询」。
       *
       * 因此只在 401 属于「当前正在使用的 token」时才停止。state 是本轮轮询
       * 开始时的快照，若存储里的 token 已变说明账号已切换，交由新轮询接管。
       */
      const current = await readState();
      if (current.accessToken === state.accessToken) {
        await disableGuardPushPolling();
      }
      return;
    }
    if (!res.ok) return;

    const body = (await res.json()) as { code?: number; data?: { items?: GuardMessageItem[] } };
    if (body?.code !== 0) return;
    items = body.data?.items || [];
  } catch {
    // 网络抖动：下一轮重试
    return;
  }

  if (items.length === 0) return;

  const maxId = items.reduce((max, item) => Math.max(max, item.id ?? 0), 0);

  // 首次开启：只弹最新一条作为「链路已通」的反馈，不把历史消息全部弹一遍。
  // 消息是每轮合并成一条，历史通常只有几条，全弹会刷屏；但一条都不弹会让用户
  // 以为功能没生效（旧版就是完全静默，开启后长时间收不到任何东西）。
  if (!state.initialized) {
    const latest = [...items].sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
    if (latest) {
      chrome.notifications.create(`${NOTIFICATION_PREFIX}${latest.id}`, buildNotification(latest));
    }
    await writeState({ lastSeenMessageId: maxId, initialized: true });
    return;
  }

  const fresh = items.filter(item => (item.id ?? 0) > state.lastSeenMessageId);

  if (fresh.length === 0) return;

  /**
   * 一轮只推最新一条。
   *
   * 开关机 / 长时间离线后积压的未读会在同一轮里被一起拉回（实测一次 5 条），
   * 逐条 create 会在通知栏刷出一串同质告警。这里只取 id 最大的一条作为本次提醒，
   * 其余消息不弹通知——它们仍可在消息中心看到，且后端「查询即已读」语义下
   * 本次返回页本就会被置读。
   *
   * 游标仍推进到整页 maxId（而非 latestFresh.id）：否则本页内其它消息下一轮
   * 会被当成「新的」再弹一次。
   */
  const latestFresh = fresh.reduce((latest, item) => ((item.id ?? 0) > (latest.id ?? 0) ? item : latest));
  chrome.notifications.create(`${NOTIFICATION_PREFIX}${latestFresh.id}`, buildNotification(latestFresh));

  await writeState({ lastSeenMessageId: maxId });
};

/**
 * 点击通知：打开 options 消息中心并定位到该条消息。
 *
 * 消息中心同时承担「单条详情」与「全部消息列表」两种形态：
 * 带 messageId 进入即为详情视图，用户可在页面内切换回全部消息。
 * 只传 id 不传正文——正文从 /messages 拉取，避免 URL 过长且保证内容与后端一致。
 */
export const handleGuardNotificationClick = async (notificationId: string): Promise<void> => {
  if (!notificationId.startsWith(NOTIFICATION_PREFIX)) return;
  chrome.notifications.clear(notificationId);

  const messageId = notificationId.slice(NOTIFICATION_PREFIX.length);
  const url = chrome.runtime.getURL(`options/index.html?messageId=${encodeURIComponent(messageId)}`);
  chrome.tabs.create({ url, active: true });
};

/** 注册 alarm / notification 监听（background 启动时调用一次） */
export const registerGuardPushListeners = (): void => {
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === ALARM_NAME) void pollGuardMessages();
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
