import env, { IS_DEV } from '@extension/env';

const envValues = (process.env as Record<string, string | undefined>) ?? {};

/**
 * API 基础 URL 配置
 * - 开发环境: CEB_AGENT_C_API_DEV
 * - 生产环境: CEB_AGENT_C_API_PROD
 */
export const API_BASE_URL =
  (IS_DEV ? envValues.CEB_AGENT_C_API_DEV : envValues.CEB_AGENT_C_API_PROD) ||
  (IS_DEV ? env.CEB_AGENT_C_API_DEV : env.CEB_AGENT_C_API_PROD);
console.warn('API_BASE_URL', API_BASE_URL);
