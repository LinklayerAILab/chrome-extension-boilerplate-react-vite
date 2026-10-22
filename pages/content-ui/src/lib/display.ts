import { getLocaleTag, type Locale } from '@src/lib/i18n';
import type { GuardColor } from '@src/api/guard';

/**
 * 展示层格式化工具。
 * 移植自 bodyguard-app `src/lib/display.ts` + `src/lib/api/normalize.ts`，
 * 保持价格、涨跌色、红绿灯色与参考项目一致。
 */

export type TrafficColor = 'green' | 'yellow' | 'red' | 'stale';

/** 健康灯颜色归一化：red / yellow / stale 精确匹配，其余（含缺失）一律视为 green */
export const normalizeColor = (color?: GuardColor | string | null): TrafficColor => {
  const value = String(color ?? '').toLowerCase();
  return value === 'red' || value === 'yellow' || value === 'stale' ? value : 'green';
};

/** 红绿灯色值，与 bodyguard trafficLightColor / tailwind brand 配色对齐 */
export const trafficLightColor = (color: TrafficColor): string => {
  switch (color) {
    case 'red':
      return '#F44A40';
    case 'yellow':
      return '#B19F00';
    case 'green':
      return '#2EC94C';
    case 'stale':
      return '#9CA3AF';
  }
};

/** 价格涨跌颜色：gain > 0 涨绿 #8AA90B，< 0 跌红 #FF1616，缺失/0 用 zeroColor（默认黑） */
export const gainColor = (gain?: number | null, zeroColor = '#000000'): string => {
  if (gain === undefined || gain === null || gain === 0) return zeroColor;
  return gain > 0 ? '#8AA90B' : '#FF1616';
};

/** 价格小数位：≥1 两位、≥0.01 四位、>0 六位 */
const priceDigits = (price: number): { min: number; max: number } | null => {
  if (price >= 1) return { min: 2, max: 2 };
  if (price >= 0.01) return { min: 4, max: 4 };
  if (price > 0) return { min: 6, max: 6 };
  return null;
};

/** 格式化 CEX 中间价：符号固定 $（不随 locale 变 US$），按量级取小数位 */
export const formatPrice = (price?: number | null, locale: Locale = 'en'): string => {
  if (price === undefined || price === null || Number.isNaN(price)) return '—';
  const digits = priceDigits(price);
  if (!digits) return '$0';
  try {
    const numStr = new Intl.NumberFormat(getLocaleTag(locale), {
      minimumFractionDigits: digits.min,
      maximumFractionDigits: digits.max,
    }).format(price);
    return `$${numStr}`;
  } catch {
    return `$${price.toFixed(digits.max)}`;
  }
};

/** 价格字符串（用于 title 悬浮提示）：符号固定 $，2 位小数 */
export const formatPriceFull = (price?: number | null, locale: Locale = 'en'): string => {
  if (price === undefined || price === null || Number.isNaN(price)) return '—';
  try {
    return `$${new Intl.NumberFormat(getLocaleTag(locale), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)}`;
  } catch {
    return `$${price.toFixed(2)}`;
  }
};

/** 流动性涨跌幅（已乘 100 的百分数）：正数带 +，负数带 -，缺失显示 — */
export const formatChangePct = (pct?: number | null, locale: Locale = 'en'): string => {
  if (pct === undefined || pct === null || Number.isNaN(pct)) return '—';
  try {
    return new Intl.NumberFormat(getLocaleTag(locale), {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: 'exceptZero',
    }).format(pct / 100);
  } catch {
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
  }
};
