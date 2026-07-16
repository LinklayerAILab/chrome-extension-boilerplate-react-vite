/**
 * API base URL configuration
 */
export const API_BASE_URL = process.env.CEB_AGENT_C_API ?? '';

console.warn('API_BASE_URL', API_BASE_URL);
