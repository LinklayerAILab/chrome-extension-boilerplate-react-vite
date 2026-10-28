/**
 * 把后端渲染的消息正文解析成结构化数据，供详情页用卡片样式渲染。
 *
 * 后端的 content 是纯文本（guard_alert_render.go 的排版）：
 *
 *   本轮 2 个币种触发风险：
 *
 *   🟡 PHA · 中等风险
 *    · DEX 流动性存在风险
 *      深度 约 9046 美元
 *    · CEX 盘口深度近 5m 下降 3%
 *      约 32.31 万美元(5m -0.64%)
 *    · 价格 $0.06 · 24小时 0.00% · 风险占比 81%
 *
 *   🔴 XPL · 高风险
 *    ⚠️ 双侧同步恶化（15m）
 *    · DEX 流动性存在风险
 *      ...
 *
 *    ℹ️ 本产品仅提供链上与市场数据信号，不构成任何投资建议。
 *
 * 版式约定（与后端一致，改动需同步）：
 * - 币种块首行：`{色点} {SYMBOL} · {风险等级}`
 * - 次行前缀一个空格：` 风险变化：A → B` / ` ⚠️ 双侧同步恶化（15m）`
 * - 结论行前缀 ` · `（space + middot + space）
 * - 数据行前缀三个空格
 * - 免责声明以 ℹ️ 开头
 *
 * 解析失败时退回纯文本展示，不丢内容。
 */

import { buildMessageSummary } from '@extension/shared';

export interface ParsedReason {
  /** 结论行文本，如「DEX 流动性存在风险」 */
  text: string;
  /** 该结论下的数据行（可能为空），如「深度 约 9046 美元」 */
  detail?: string;
}

export interface ParsedCoin {
  /** 色点 emoji：🟢 / 🟡 / 🔴 / ⚪ */
  dot: string;
  symbol: string;
  /** 风险等级，如「中等风险」 */
  level: string;
  /** 风险等级对应的色值（左边条与文字色） */
  tone: 'green' | 'yellow' | 'red' | 'unknown';
  /** 风险变化行，如「风险变化：低风险 → 中等风险」 */
  change?: string;
  /** 双侧同步恶化行，如「⚠️ 双侧同步恶化（15m）」 */
  sync?: string;
  /** 结论行 + 数据行 */
  reasons: ParsedReason[];
}

export interface ParsedMessage {
  /** 摘要行，如「本轮 2 个币种触发风险：」 */
  summary?: string;
  coins: ParsedCoin[];
  /** 免责声明 */
  disclaimer?: string;
  /** 无币种块时保留原文，由 UI 直接展示 */
  rawFallback?: string;
}

const DOT_TONE: Record<string, ParsedCoin['tone']> = {
  '🟢': 'green',
  '🟡': 'yellow',
  '🔴': 'red',
  '⚪': 'unknown',
};

const BULLET_PREFIX = ' · ';
const DATA_PREFIX = '   ';
const SUB_PREFIX = ' ';

/**
 * 币种块首行判定。
 * 必须带 u 标志：emoji 是 UTF-16 代理对，不加 u 时字符类会按单个码元匹配而失败。
 * ⚪ 是 U+26AA 单码元，与三个代理对 emoji 混在同一字符类里更需要 u。
 */
const isCoinHeader = (line: string): boolean => /^[🟢🟡🔴⚪]\s+\S/u.test(line);

const parseCoinHeader = (line: string): { dot: string; symbol: string; level: string; tone: ParsedCoin['tone'] } => {
  // 码点而非码元：🟢 等占两个 UTF-16 单元
  const [dot] = Array.from(line);
  const rest = line.slice(dot.length).trim();
  // 形如 `PHA · 中等风险`；symbol 本身可能含空格，以最后一个 ` · ` 分割更稳
  const idx = rest.lastIndexOf(' · ');
  const symbol = idx > 0 ? rest.slice(0, idx).trim() : rest;
  const level = idx > 0 ? rest.slice(idx + 3).trim() : '';
  return { dot, symbol, level, tone: DOT_TONE[dot] ?? 'unknown' };
};

/**
 * 解析消息正文。
 * 不含币种块（例如全绿无明细、或格式变更）时返回 rawFallback，由 UI 原样展示。
 */
export const parseMessageContent = (content: string): ParsedMessage => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');

  let summary: string | undefined;
  let disclaimer: string | undefined;
  const coins: ParsedCoin[] = [];

  let current: ParsedCoin | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim()) continue;

    // 免责声明：ℹ️ 开头，通常在最末
    if (line.trimStart().startsWith('ℹ️')) {
      disclaimer = line.trimStart().replace(/^ℹ️\s*/, '');
      continue;
    }

    if (isCoinHeader(line)) {
      const header = parseCoinHeader(line);
      current = { ...header, reasons: [] };
      coins.push(current);
      continue;
    }

    // 首个币种块之前的第一段文字视为摘要（通常只有一行）
    if (!current) {
      if (!summary) {
        summary = line.trim();
      } else {
        summary = `${summary}\n${line.trim()}`;
      }
      continue;
    }

    // 次行：风险变化 / 双侧同步恶化（单空格前缀）
    if (line.startsWith(SUB_PREFIX) && !line.startsWith(BULLET_PREFIX) && !line.startsWith(DATA_PREFIX)) {
      const text = line.slice(SUB_PREFIX.length).trim();
      if (text.startsWith('⚠️')) current.sync = text;
      else current.change = text;
      continue;
    }

    // 结论行
    if (line.startsWith(BULLET_PREFIX)) {
      current.reasons.push({ text: line.slice(BULLET_PREFIX.length).trim() });
      continue;
    }

    // 数据行：挂到上一条结论下
    if (line.startsWith(DATA_PREFIX)) {
      const detail = line.slice(DATA_PREFIX.length).trim();
      const last = current.reasons[current.reasons.length - 1];
      if (last) {
        last.detail = last.detail ? `${last.detail} · ${detail}` : detail;
      } else {
        // 没有结论却先出现数据行：当作独立结论
        current.reasons.push({ text: detail });
      }
      continue;
    }

    // 其他（语言差异导致的缩进不一致）：并入最后一条结论
    const last = current.reasons[current.reasons.length - 1];
    if (last) {
      last.detail = last.detail ? `${last.detail}\n${line.trim()}` : line.trim();
    } else {
      current.reasons.push({ text: line.trim() });
    }
  }

  if (coins.length === 0) {
    return { summary, disclaimer, coins: [], rawFallback: content };
  }

  return { summary, coins, disclaimer };
};

/** 列表行摘要最大正文长度（按码点计，emoji 记 1 个） */
export const ROW_SUMMARY_BODY_LIMIT = 30;

/**
 * 列表行副标题：正文首行（如「本轮 2 个币种触发风险：」）+ 其余行拍平后的前 30 字。
 *
 * 实现放在 @extension/shared，与 background 的系统通知共用同一个截断逻辑，
 * 避免两处对「拍平/跳免责声明/码点截断」的规则各写一份而漂移。
 */
export const buildRowSummary = (content: string, limit = ROW_SUMMARY_BODY_LIMIT): string =>
  buildMessageSummary(content, limit);
