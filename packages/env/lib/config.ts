import { config } from '@dotenvx/dotenvx';
import { resolve } from 'node:path';

// import.meta.dirname = packages/env/dist/lib
// Go up 4 levels: lib -> dist -> env -> packages -> project root
const rootEnvPath = resolve(import.meta.dirname, '../../../../.env');

// Read root .env to determine the environment preset.
// CLI_CEB_ENV 是环境预设开关，与构建形态（CLI_CEB_DEV）解耦：
//   - dev  → .env.development（测试后端 + 测试网合约）
//   - test → .env.development（生产形态构建，但连测试后端；见 build:test）
//   - prod → .env.production
// 未显式设置时按 CLI_CEB_DEV 推导，保持向下兼容。
const rootEnv = config({ path: rootEnvPath }).parsed ?? {};
const preset = rootEnv.CLI_CEB_ENV || (rootEnv.CLI_CEB_DEV === 'true' ? 'dev' : 'prod');
const mode = preset === 'prod' ? 'production' : 'development';

// Try loading mode-specific config first, fallback to root .env
const modeEnvPath = rootEnvPath.replace(/\.env$/, `.env.${mode}`);
const modeEnv = config({ path: modeEnvPath }).parsed;

export const baseEnv = modeEnv ?? rootEnv;

/**
 * 根 .env 里的 CLI 段（由 `pnpm set-global-env` 写入）。
 * 构建形态必须以它为准：模式文件（.env.development）里的 CLI_CEB_DEV 是历史遗留值，
 * 若继续从那里读，`build:test`（读 development 配置但不 watch）就无法生效。
 */
export const cliEnv = {
  CLI_CEB_DEV: rootEnv.CLI_CEB_DEV ?? 'false',
  CLI_CEB_FIREFOX: rootEnv.CLI_CEB_FIREFOX ?? 'false',
  CLI_CEB_ENV: rootEnv.CLI_CEB_ENV,
} as const;

/** 环境预设：dev（开发调试）/ test（测试环境生产构建）/ prod（生产） */
export const ENV_PRESET = preset;

export const dynamicEnvValues = {
  CEB_NODE_ENV: mode === 'development' ? 'development' : 'production',
  /** 注入到浏览器代码：环境预设，供合约地址 / SIWE 域名等按环境分流 */
  CEB_ENV: preset,
} as const;
