/**
 * 图标 URL 生成工具
 * Content Script 需要使用 chrome.runtime.getURL() 来访问扩展资源
 */

export const getIconUrl = (iconName: string): string => chrome.runtime.getURL(`content-ui/${iconName}`);

// 预定义的图标名称
export const ICONS = {
  ALPHA: 'alpha.svg',
  ALPHA_SELECT: 'alpha-select.svg',
  API: 'api.svg',
  API_SELECT: 'api-select.svg',
  MINT: 'mint.svg',
  MINT_SELECT: 'mint-select.svg',
  PERPS: 'perps.svg',
  PERPS_SELECT: 'perps-select.svg',
  POLIET: 'poliet.svg',
  POLIET_SELECT: 'poliet-select.svg',
  POINTS: 'points.svg',
  POINTS_SELECT: 'points-select.svg',
  INVITE_ICON: 'invite.svg',
  X_ICON: 'x.svg',
  TELEGRAM_ICON: 'telegram.svg',
  SETTING_ICON: 'setting.svg',
  TOKEN: 'token.svg',
  TOKEN_SELECT: 'token-select.svg',
} as const;
