import type { MessageLocale } from './i18n';

/**
 * 紧凑数字单位表（按从大到小排列，命中第一个 <= 绝对值的阈值）。
 *
 * 中文/日文/韩文的进位单位是「万」，1 千 ~ 1 万之间没有原生缩写单位，
 * Intl.NumberFormat 的 compact 在这三种语言下会把 1145 原样输出，
 * 所以这里显式补一档「千」，到万再切换到「万」。
 *
 * 英俄没有「万」单位，一万及以上继续用 K / тыс.（10K / 10 тыс.）。
 */
interface UnitTier {
  /** 阈值：绝对值达到该值时使用此单位 */
  value: number;
  unit: string;
}

const UNIT_TIERS: Record<MessageLocale, UnitTier[]> = {
  en: [{ value: 1000, unit: 'K' }],
  ru: [{ value: 1000, unit: ' тыс.' }],
  zh: [
    { value: 10000, unit: '万' },
    { value: 1000, unit: '千' },
  ],
  ja: [
    { value: 10000, unit: '万' },
    { value: 1000, unit: '千' },
  ],
  ko: [
    { value: 10000, unit: '만' },
    { value: 1000, unit: '천' },
  ],
};

/** 小数分隔符：俄语用逗号，其余用点 */
const DECIMAL_SEPARATOR: Record<MessageLocale, string> = {
  en: '.',
  zh: '.',
  ja: '.',
  ko: '.',
  ru: ',',
};

/**
 * 把消息数压成紧凑写法：999 → 「999」、1145 → 「1.1K」、123456 → 「12.3万」。
 *
 * - 小于 1000 原样输出
 * - 保留 1 位小数，整数时省略小数部分（10000 → 「1万」而非「1.0万」）
 * - 单位与数字之间不留空格（俄语单位自带前导空格）
 */
export const formatCompactNumber = (value: number, locale: MessageLocale): string => {
  if (!Number.isFinite(value)) return '0';

  const abs = Math.abs(value);
  const tiers = UNIT_TIERS[locale] ?? UNIT_TIERS.en;
  const tier = tiers.find(item => abs >= item.value);
  if (!tier) return String(value);

  // 先按 1 位小数四舍五入，再判断是否为整数，避免 9.999 → "10.0"
  const rounded = Math.round((value / tier.value) * 10) / 10;
  if (Number.isInteger(rounded)) return `${rounded}${tier.unit}`;

  const decimals = Math.abs(rounded)
    .toFixed(1)
    .replace('.', DECIMAL_SEPARATOR[locale] ?? '.');
  return `${rounded < 0 ? '-' : ''}${decimals}${tier.unit}`;
};
