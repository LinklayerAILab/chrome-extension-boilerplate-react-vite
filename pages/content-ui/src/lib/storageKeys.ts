export const STORAGE_PREFIX = '@Linklayerai/';

const withPrefix = (key: string) => `${STORAGE_PREFIX}${key}`;

export const ACCESS_TOKEN_KEY = withPrefix('access_token');
export const ADDRESS_KEY = withPrefix('address');
export const INVITE_CODE_KEY = withPrefix('invite_code');
export const OTHER_INFO_KEY = withPrefix('otherInfo');
export const WALLET_STATE_KEY = withPrefix('wallet_state');
// 最后使用的钱包 provider 标识，跨断开/锁定存活，用于重连时定位原钱包
export const LAST_PROVIDER_KEY = withPrefix('last_provider_id');
export const STRIPE_PENDING_ORDER_KEY = withPrefix('stripe_pending_order');
export const LOCALE_KEY = withPrefix('content-ui-locale');
export const WEB_APP_DATA_KEY = withPrefix('webAppData');
// 用户点击「稍后」跳过推送授权引导；仅在下次试用激活时再次弹出
export const GUARD_PUSH_PROMPT_SKIPPED_KEY = withPrefix('guard-push-prompt-skipped');
// 注意：推送开关不再存 localStorage —— 它按站点 origin 隔离，会被单站的会话清理
// 误删导致轮询永久停死。真相源改为 chrome.storage.local 的 guardPushState
// （由 background 维护），详见 lib/guardPush.ts 的说明。
