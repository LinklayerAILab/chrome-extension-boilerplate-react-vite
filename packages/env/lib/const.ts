import { baseEnv } from './config.js';

export const IS_DEV = process.env['CLI_CEB_DEV'] === 'true';
export const IS_PROD = !IS_DEV;
export const IS_FIREFOX = process.env['CLI_CEB_FIREFOX'] === 'true';
export const IS_CI = process.env['CEB_CI'] === 'true';

/**
 * Content UI 白名单域名
 * 只有这些域名才会注入 Content Script UI
 *
 * 优先使用 process.env（构建时注入），回退到 baseEnv（运行时读取）
 */
const whitelistEnv = process.env.CEB_CONTENT_UI_WHITELIST || baseEnv.CEB_CONTENT_UI_WHITELIST;

export const CONTENT_UI_WHITELIST = whitelistEnv ? whitelistEnv.split(',').map(domain => domain.trim()) : [];
