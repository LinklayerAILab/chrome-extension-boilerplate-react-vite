/**
 * 消息正文 → 单行摘要。
 *
 * 后端渲染的 content 是多行纯文本（guard_alert_render.go 排版）：
 *
 *   本轮 2 个币种触发风险：
 *
 *   🟡 PHA · 中等风险
 *    · DEX 流动性存在风险
 *
 * 各处只需要「首行 + 其余内容拍平后的一小段」，但截断长度不同：
 * 系统通知约 15 字（系统通知栏空间小），options 列表行 30 字。
 */

/**
 * 按码点截断。emoji（🟡 等）是 UTF-16 代理对，直接用 slice 会切成孤立代理，
 * 渲染出乱码，因此必须走 Array.from 按码点切分。
 */
const clipByCodepoint = (text: string, limit: number): string => {
  const chars = Array.from(text);
  if (chars.length <= limit) return text;
  return `${chars.slice(0, limit).join('')}...`;
};

/**
 * 把消息正文压成一行：首行（如「本轮 2 个币种触发风险：」）+ 其余行拍平后的前 limit 字。
 *
 * - 跳过空行与免责声明（ℹ️ 开头）
 * - 首行以冒号结尾时直接相接（中英文冒号都识别），否则用空格分隔
 * - 逐行 trim 后用单空格连接，保留 🟡 色点与 ` · ` 分隔符
 * - 正文不足 limit 字时不加省略号
 */
export const buildMessageSummary = (content: string, limit: number): string => {
  const lines = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('ℹ️'));

  const [header, ...rest] = lines;
  if (!header) return '';

  const body = clipByCodepoint(rest.join(' '), limit);
  if (!body) return header;

  const glue = /[:：]$/.test(header) ? '' : ' ';
  return `${header}${glue}${body}`;
};
