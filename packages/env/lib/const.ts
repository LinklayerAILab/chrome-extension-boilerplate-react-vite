import { baseEnv, cliEnv, ENV_PRESET } from './config.js';

/**
 * 构建形态标志 —— 只决定「怎么构建」（watch / minify / sourcemap / HMR），
 * 不决定「用哪份环境配置」。环境分流请看 CURRENT_ENV / IS_TEST_ENV。
 *
 * 读取来源是根 .env 的 CLI 段，而不是 .env.<mode> 文件：
 * `build:test` 会加载 .env.development 但 CLI_CEB_DEV=false。
 */
export const IS_DEV = cliEnv.CLI_CEB_DEV === 'true';
export const IS_PROD = !IS_DEV;
export const IS_FIREFOX = cliEnv.CLI_CEB_FIREFOX === 'true';
export const IS_CI = baseEnv.CEB_CI === 'true';

/** 当前环境预设：'dev' | 'test' | 'prod'（由 CLI_CEB_ENV 指定，缺省按构建形态推导） */
export const CURRENT_ENV = ENV_PRESET;

/** 测试环境（测试后端 + 测试网合约）：dev 与 test 预设都属于测试环境 */
export const IS_TEST_ENV = CURRENT_ENV !== 'prod';

/** 严格生产环境（连接主网） */
export const IS_PRODUCTION_ENV = CURRENT_ENV === 'prod';

/**
 * Content UI 白名单域名
 * 只有这些域名才会注入 Content Script UI
 *
 * 优先使用 process.env（构建时注入），回退到 baseEnv（运行时读取）
 */
const whitelistEnv = process.env.CEB_CONTENT_UI_WHITELIST || baseEnv.CEB_CONTENT_UI_WHITELIST;

export const CONTENT_UI_WHITELIST = whitelistEnv ? whitelistEnv.split(',').map(domain => domain.trim()) : [];
