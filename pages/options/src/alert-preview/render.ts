/**
 * 告警推送文案渲染 —— 后端 guard_alert_render.go 的逐函数移植。
 *
 * 用途：options 预览页用同一套排版规则还原「推送会是什么样」，
 * 改文案/改阈值时不必真的等一小时告警。
 *
 * 移植对应关系（c_agent/internal/service/webapp/）：
 *   guardAlertText                 → alertText
 *   guardAlertColorDot             → colorDot
 *   guardBuildCoinBlockLines       → buildCoinBlockLines
 *   guardBuildMergedAlertParts     → buildMergedAlertParts
 *   guardBuildMergedAlertSegments  → buildMergedAlertSegments
 *   guardFormatReasonEntryLocale   → formatReasonEntryLocale
 *   guardFormatUSDLocale           → formatUSDLocale
 *   guardFormatImpactPct           → formatImpactPct
 *
 * 阈值同样是 guardAlertMaxPayloadBytes = 3500（按 UTF-8 字节计）。
 */

export type GuardLocale = 'zh' | 'en' | 'ja' | 'ru' | 'ko';

export const GUARD_LOCALES: GuardLocale[] = ['zh', 'en', 'ja', 'ru', 'ko'];

/** 拆分后的一条推送段（后端 guardAlertSegment 对应物） */
export interface AlertSegment {
  text: string;
  /** 该段覆盖的 alerts 下标，供 UI 标注「这段含哪几个币」 */
  alertIndices: number[];
  /** UTF-8 字节数 */
  bytes: number;
}

export interface ReasonEntry {
  code: string;
  params?: Record<string, unknown>;
}

/** 单条告警的健康快照（/watchlist 的 health 子集 + /alerts 的扁平字段） */
export interface AlertHealth {
  token: {
    token_id: string;
    symbol?: string;
    cex_symbol?: string;
  };
  color: string;
  level: string;
  previous_color?: string;
  previous_level?: string;
  is_double_sided?: boolean;
  reasons?: ReasonEntry[];
  dex_risk?: {
    level?: string;
    evidence?: {
      lp_concentration?: { top1_ratio?: number; locked_ratio?: number };
      fake_support?: { abnormal_burn_count?: number };
    };
  };
  cex_risk?: {
    level?: string;
    depth?: { imbalance?: number };
    trade_impact?: { max_impact_bps?: number };
  };
  cross_risk?: { window?: string; synced?: boolean };
  computed_at?: string | null;
}

/** 一条待渲染的告警：Event 字段来自 /alerts，Health 来自 /watchlist */
export interface TriggeredAlert {
  health: AlertHealth;
  /** 该告警在 /alerts 里的 id，仅用于 UI 展示与选中 */
  eventId?: number;
}

/** 三路增强数据（后端 guardAlertRenderContext 对应物） */
export interface RenderContext {
  liquidityChange: Record<
    string,
    {
      cex?: { current_usd?: number; depth_change_pct?: number; window?: string };
      dex?: { depth_usd?: number };
    }
  >;
  /** 按 cex_symbol 索引 */
  prices: Record<string, { price?: number; gain?: number }>;
  /** 按 token_id 索引 */
  dailyByToken: Record<string, { risk_exposure_pct?: number }>;
}

/** 排版常量，与后端 guard_alert_render.go:41-51 一致 */
const BULLET_PREFIX = ' · ';
const DATA_PREFIX = '   ';
const SUB_LINE_PREFIX = ' ';

/** 后端 guardAlertMaxPayloadBytes */
export const ALERT_MAX_PAYLOAD_BYTES = 3500;

/** 后端 webpush 发送硬上限，预览里一并展示余量 */
export const PUSH_PAYLOAD_HARD_LIMIT = 4096;

export const utf8Bytes = (s: string): number => new TextEncoder().encode(s).length;

// ============ 文案表（guardAlertText 逐字） ============

interface AlertTextT {
  TitleFmt: string;
  TitleContFmt: string;
  CountFmt: string;
  RiskExtreme: string;
  RiskHigh: string;
  RiskMedium: string;
  RiskLow: string;
  RiskUnknown: string;
  DEXLabel: string;
  CEXLabel: string;
  SyncDeterioration: string;
  MetricLpTop1: string;
  MetricLocked: string;
  MetricFakeLP: string;
  MetricFakeLPUnit: string;
  MetricDexDepth: string;
  MetricImbalance: string;
  MetricLargeTrade: string;
  MetricPrice: string;
  Metric1d: string;
  MetricDailyExposure: string;
  Disclaimer: string;
}

const ALERT_TEXT: Record<GuardLocale, AlertTextT> = {
  en: {
    TitleFmt: 'Alert · %s',
    TitleContFmt: 'Alert (cont.) · %s',
    CountFmt: '%d coins triggered this round:',
    RiskExtreme: 'Extreme Risk',
    RiskHigh: 'High Risk',
    RiskMedium: 'Medium Risk',
    RiskLow: 'Low Risk',
    RiskUnknown: 'Status Available',
    DEXLabel: 'DEX',
    CEXLabel: 'CEX',
    SyncDeterioration: 'DEX+CEX Sync Deterioration',
    MetricLpTop1: 'LP top1',
    MetricLocked: 'lock',
    MetricFakeLP: 'fake LP',
    MetricFakeLPUnit: '',
    MetricDexDepth: 'depth',
    MetricImbalance: 'order imbalance',
    MetricLargeTrade: 'large-trade impact',
    MetricPrice: 'Price',
    Metric1d: '24h',
    MetricDailyExposure: 'risk exposure',
    Disclaimer: 'This product provides data signals only and is not investment advice.',
  },
  ja: {
    TitleFmt: 'アラート · %s',
    TitleContFmt: 'アラート（続き）· %s',
    CountFmt: '今回 %d 銘柄がリスクをトリガーしました：',
    RiskExtreme: '極めて高いリスク',
    RiskHigh: '高いリスク',
    RiskMedium: '中程度リスク',
    RiskLow: '低リスク',
    RiskUnknown: 'ステータス確認可',
    DEXLabel: 'DEX',
    CEXLabel: 'CEX',
    SyncDeterioration: 'DEX+CEX 同期悪化',
    MetricLpTop1: 'LP top1',
    MetricLocked: 'ロック',
    MetricFakeLP: '偽LP',
    MetricFakeLPUnit: '件',
    MetricDexDepth: '深度',
    MetricImbalance: '板不均衡',
    MetricLargeTrade: '大口取引の衝撃',
    MetricPrice: '価格',
    Metric1d: '24時間',
    MetricDailyExposure: 'リスク比率',
    Disclaimer: '本製品はデータシグナルのみを提供し、投資アドバイスではありません。',
  },
  ru: {
    TitleFmt: 'Оповещение · %s',
    TitleContFmt: 'Оповещение (прод.) · %s',
    CountFmt: 'В этом раунде сработало %d монет:',
    RiskExtreme: 'Экстремальный риск',
    RiskHigh: 'Высокий риск',
    RiskMedium: 'Средний риск',
    RiskLow: 'Низкий риск',
    RiskUnknown: 'Статус доступен',
    DEXLabel: 'DEX',
    CEXLabel: 'CEX',
    SyncDeterioration: 'DEX+CEX синхр. ухудшение',
    MetricLpTop1: 'LP top1',
    MetricLocked: 'блок',
    MetricFakeLP: 'фейк LP',
    MetricFakeLPUnit: '',
    MetricDexDepth: 'глубина',
    MetricImbalance: 'дисбаланс заявок',
    MetricLargeTrade: 'влияние крупной сделки',
    MetricPrice: 'цена',
    Metric1d: '24ч',
    MetricDailyExposure: 'риск-экспозиция',
    Disclaimer: 'Этот продукт предоставляет только сигналы данных и не является инвестиционной рекомендацией.',
  },
  ko: {
    TitleFmt: '경고 · %s',
    TitleContFmt: '경고(계속) · %s',
    CountFmt: '이번 라운드 %d개 코인 위험 발생:',
    RiskExtreme: '극도 위험',
    RiskHigh: '높은 위험',
    RiskMedium: '중간 위험',
    RiskLow: '낮은 위험',
    RiskUnknown: '상태 확인 가능',
    DEXLabel: 'DEX',
    CEXLabel: 'CEX',
    SyncDeterioration: 'DEX+CEX 동시 악화',
    MetricLpTop1: 'LP top1',
    MetricLocked: '잠금',
    MetricFakeLP: '가짜 LP',
    MetricFakeLPUnit: '건',
    MetricDexDepth: '깊이',
    MetricImbalance: '호가 불균형',
    MetricLargeTrade: '대형 거래 충격',
    MetricPrice: '가격',
    Metric1d: '24시간',
    MetricDailyExposure: '리스크 비율',
    Disclaimer: '본 제품은 데이터 신호만 제공하며 투자 자문이 아닙니다.',
  },
  zh: {
    TitleFmt: '🚨 流动性保镖 · %s',
    TitleContFmt: '🚨 流动性保镖（续）· %s',
    CountFmt: '本轮 %d 个币种触发风险：',
    RiskExtreme: '极高风险',
    RiskHigh: '高风险',
    RiskMedium: '中等风险',
    RiskLow: '低风险',
    RiskUnknown: '状态可查看',
    DEXLabel: 'DEX',
    CEXLabel: 'CEX',
    SyncDeterioration: '双侧同步恶化',
    MetricLpTop1: 'LP top1',
    MetricLocked: '锁',
    MetricFakeLP: '假LP',
    MetricFakeLPUnit: '次',
    MetricDexDepth: '深度',
    MetricImbalance: '买卖盘失衡',
    MetricLargeTrade: '大单冲击',
    MetricPrice: '价格',
    Metric1d: '24小时',
    MetricDailyExposure: '风险占比',
    Disclaimer: '本产品仅提供链上与市场数据信号，不构成任何投资建议。',
  },
};

export const alertText = (locale: GuardLocale): AlertTextT => ALERT_TEXT[locale] ?? ALERT_TEXT.zh;

// ============ 格式化工具 ============

/** 后端 guardAlertColorDot */
export const colorDot = (color?: string): string => {
  switch (
    String(color ?? '')
      .toLowerCase()
      .trim()
  ) {
    case 'red':
      return '🔴';
    case 'yellow':
      return '🟡';
    case 'green':
      return '🟢';
    default:
      return '⚪';
  }
};

/** 后端 guardAlertRiskText */
export const riskText = (color: string | undefined, locale: GuardLocale): string => {
  const t = alertText(locale);
  switch (
    String(color ?? '')
      .toLowerCase()
      .trim()
  ) {
    case 'red':
      return t.RiskHigh;
    case 'yellow':
      return t.RiskMedium;
    case 'green':
      return t.RiskLow;
    default:
      return t.RiskUnknown;
  }
};

/** 后端 guardAlertSyncDeterioration（注意是全角括号） */
export const syncDeteriorationText = (window: string | undefined, locale: GuardLocale): string =>
  `${alertText(locale).SyncDeterioration}（${window ?? ''}）`;

/** 后端 guardTrimUSDNumber：去掉尾随零与孤立小数点 */
const trimUsdNumber = (s: string): string => {
  if (!s.includes('.')) return s;
  return s.replace(/0+$/, '').replace(/\.$/, '');
};

/** 后端 guardFormatUSD：≥1e9 → B，≥1e6 → M，≥1e3 → K，其余 $X.XX */
const formatUsd = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${trimUsdNumber((v / 1e9).toFixed(2))}B`;
  if (abs >= 1e6) return `$${trimUsdNumber((v / 1e6).toFixed(2))}M`;
  if (abs >= 1e3) return `$${trimUsdNumber((v / 1e3).toFixed(2))}K`;
  return `$${v.toFixed(2)}`;
};

/** 后端 guardFormatUSDZH：亿 / 万 / 美元 三级，近似值带「约」 */
const formatUsdZh = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1e8) return `约 ${trimUsdNumber((v / 1e8).toFixed(2))}亿美元`;
  if (abs >= 1e4) return `约 ${trimUsdNumber((v / 1e4).toFixed(2))}万美元`;
  if (abs >= 1e3) return `约 ${trimUsdNumber(v.toFixed(0))} 美元`;
  return formatUsd(v);
};

/** 后端 guardFormatUSDLocale */
export const formatUsdLocale = (v: number, locale: GuardLocale): string =>
  locale === 'zh' ? formatUsdZh(v) : formatUsd(v);

/** 后端 guardFormatPct0：非方向性百分比，0 位小数 */
const formatPct0 = (v: number): string => `${v.toFixed(0)}%`;

/** 后端 guardFormatSignedPct0：方向性百分比，0 位小数带符号 */
const formatSignedPct0 = (v: number): string => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`;

/** 后端 guardFormatSignedPct：百分比 2 位小数带符号 */
const formatSignedPct = (v: number): string => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;

/** 后端 guardFormatImpactPct：bps → 百分比文案（bps/100，去尾零） */
export const formatImpactPct = (bps: number): string => `${trimUsdNumber((bps / 100).toFixed(2))}%`;

// ============ reason 本地化（guardFormatReasonEntryLocale 逐字） ============

/** 后端 guardReasonParamString：数值整型去小数点，非整型保留 2 位 */
const reasonParamString = (params: Record<string, unknown> | undefined, key: string): string => {
  if (!params) return '';
  const value = params[key];
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(Math.trunc(value)) : value.toFixed(2);
  }
  return String(value).trim();
};

const REASON_TEXT_ZH: Record<string, string> = {
  DATA_UNAVAILABLE: '数据暂不可用',
  LIQUIDITY_NORMAL: '整体流动性正常',
  LIQUIDITY_RISK: '整体存在流动性风险',
  CROSS_SYNC_DETERIORATION: 'DEX 与 CEX 同步恶化',
  DOUBLE_SIDED_DRAIN: 'DEX 与 CEX 同步恶化',
  DEX_LIQUIDITY_NORMAL: 'DEX 流动性正常',
  LP_CONCENTRATION_HIGH: 'LP 集中度过高',
  LP_FAKE_SUPPORT_DETECTED: '检测到虚假 LP 支撑',
  DEX_LIQUIDITY_RISK: 'DEX 流动性存在风险',
  CEX_DEPTH_NORMAL: 'CEX 盘口深度正常',
  CEX_DEPTH_IMBALANCE: 'CEX 盘口失衡',
  CEX_DEPTH_RISK: 'CEX 盘口存在风险',
  DATA_STALE: '数据已过期',
  DATA_TEMPORARILY_UNAVAILABLE: '数据暂不可用',
  NOT_IN_UNIVERSE: '代币不在监控范围内',
};

const REASON_TEXT_EN: Record<string, string> = {
  DATA_UNAVAILABLE: 'Data is unavailable',
  LIQUIDITY_NORMAL: 'Overall liquidity is normal',
  LIQUIDITY_RISK: 'Overall liquidity risk detected',
  CROSS_SYNC_DETERIORATION: 'DEX and CEX deteriorated together',
  DOUBLE_SIDED_DRAIN: 'DEX and CEX deteriorated together',
  DEX_LIQUIDITY_NORMAL: 'DEX liquidity is normal',
  LP_CONCENTRATION_HIGH: 'LP concentration is high',
  LP_FAKE_SUPPORT_DETECTED: 'Fake LP support detected',
  DEX_LIQUIDITY_RISK: 'DEX liquidity risk detected',
  CEX_DEPTH_NORMAL: 'CEX order book depth is normal',
  CEX_DEPTH_IMBALANCE: 'CEX order book is imbalanced',
  CEX_DEPTH_RISK: 'CEX order book risk detected',
  DATA_STALE: 'Data is stale',
  DATA_TEMPORARILY_UNAVAILABLE: 'Data is temporarily unavailable',
  NOT_IN_UNIVERSE: 'Token is not in the monitored universe',
};

const REASON_TEXT_JA: Record<string, string> = {
  DATA_UNAVAILABLE: 'データは利用できません',
  LIQUIDITY_NORMAL: '全体の流動性は正常',
  LIQUIDITY_RISK: '全体の流動性リスクを検知',
  CROSS_SYNC_DETERIORATION: 'DEXとCEXが同時に悪化',
  DOUBLE_SIDED_DRAIN: 'DEXとCEXが同時に悪化',
  DEX_LIQUIDITY_NORMAL: 'DEX流動性は正常',
  LP_CONCENTRATION_HIGH: 'LP集中度が高い',
  LP_FAKE_SUPPORT_DETECTED: '偽のLPサポートを検知',
  DEX_LIQUIDITY_RISK: 'DEX流動性リスクを検知',
  CEX_DEPTH_NORMAL: 'CEX板の厚みは正常',
  CEX_DEPTH_IMBALANCE: 'CEX板が不均衡',
  CEX_DEPTH_RISK: 'CEX板リスクを検知',
  DATA_STALE: 'データが古くなっています',
  DATA_TEMPORARILY_UNAVAILABLE: 'データは一時的に利用できません',
  NOT_IN_UNIVERSE: 'トークンは監視範囲外です',
};

const REASON_TEXT_RU: Record<string, string> = {
  DATA_UNAVAILABLE: 'Данные недоступны',
  LIQUIDITY_NORMAL: 'Общая ликвидность в норме',
  LIQUIDITY_RISK: 'Обнаружен общий риск ликвидности',
  CROSS_SYNC_DETERIORATION: 'DEX и CEX ухудшились одновременно',
  DOUBLE_SIDED_DRAIN: 'DEX и CEX ухудшились одновременно',
  DEX_LIQUIDITY_NORMAL: 'Ликвидность DEX в норме',
  LP_CONCENTRATION_HIGH: 'Высокая концентрация LP',
  LP_FAKE_SUPPORT_DETECTED: 'Обнаружена фиктивная поддержка LP',
  DEX_LIQUIDITY_RISK: 'Обнаружен риск ликвидности DEX',
  CEX_DEPTH_NORMAL: 'Глубина стакана CEX в норме',
  CEX_DEPTH_IMBALANCE: 'Стакан CEX несбалансирован',
  CEX_DEPTH_RISK: 'Обнаружен риск стакана CEX',
  DATA_STALE: 'Данные устарели',
  DATA_TEMPORARILY_UNAVAILABLE: 'Данные временно недоступны',
  NOT_IN_UNIVERSE: 'Токен вне области мониторинга',
};

const REASON_TEXT_KO: Record<string, string> = {
  DATA_UNAVAILABLE: '데이터를 사용할 수 없습니다',
  LIQUIDITY_NORMAL: '전체 유동성 정상',
  LIQUIDITY_RISK: '전체 유동성 위험 감지',
  CROSS_SYNC_DETERIORATION: 'DEX와 CEX가 동시에 악화됨',
  DOUBLE_SIDED_DRAIN: 'DEX와 CEX가 동시에 악화됨',
  DEX_LIQUIDITY_NORMAL: 'DEX 유동성 정상',
  LP_CONCENTRATION_HIGH: 'LP 집중도가 높음',
  LP_FAKE_SUPPORT_DETECTED: '가짜 LP 지지 감지',
  DEX_LIQUIDITY_RISK: 'DEX 유동성 위험 감지',
  CEX_DEPTH_NORMAL: 'CEX 오더북 깊이 정상',
  CEX_DEPTH_IMBALANCE: 'CEX 오더북 불균형',
  CEX_DEPTH_RISK: 'CEX 오더북 위험 감지',
  DATA_STALE: '데이터가 오래되었습니다',
  DATA_TEMPORARILY_UNAVAILABLE: '데이터를 일시적으로 사용할 수 없습니다',
  NOT_IN_UNIVERSE: '토큰이 모니터링 범위에 없습니다',
};

const REASON_TEXT: Record<GuardLocale, Record<string, string>> = {
  zh: REASON_TEXT_ZH,
  en: REASON_TEXT_EN,
  ja: REASON_TEXT_JA,
  ru: REASON_TEXT_RU,
  ko: REASON_TEXT_KO,
};

/** 后端 guardLocalizedReasonText：带参数插值的 code 单独处理 */
const localizedReasonText = (
  code: string,
  params: Record<string, unknown> | undefined,
  locale: GuardLocale,
): string => {
  const stats = REASON_TEXT[locale] ?? REASON_TEXT.zh;
  const plain = stats[code];
  if (plain) return plain;

  const window = reasonParamString(params, 'window');
  const dropPct = reasonParamString(params, 'drop_pct');
  const topHolderPct = reasonParamString(params, 'top_holder_pct');
  const burnRatioPct = reasonParamString(params, 'burn_ratio_pct');
  const imbalancePct = reasonParamString(params, 'imbalance_pct');
  const impactBps = reasonParamString(params, 'impact_bps');

  switch (code) {
    case 'DEX_LIQUIDITY_DROP':
      if (window && dropPct) {
        return {
          zh: `DEX 流动性近 ${window} 下降 ${dropPct}%`,
          en: `DEX liquidity dropped ${dropPct}% over ${window}`,
          ja: `DEX流動性が${window}で${dropPct}%低下`,
          ru: `Ликвидность DEX снизилась на ${dropPct}% за ${window}`,
          ko: `DEX 유동성이 ${window} 동안 ${dropPct}% 감소`,
        }[locale];
      }
      return {
        zh: 'DEX 流动性下降',
        en: 'DEX liquidity dropped',
        ja: 'DEX流動性が低下',
        ru: 'Ликвидность DEX снизилась',
        ko: 'DEX 유동성 감소',
      }[locale];

    case 'LP_CONCENTRATION_HIGH':
      if (topHolderPct) {
        return {
          zh: `LP 集中度过高，头部持仓占比 ${topHolderPct}%`,
          en: `LP concentration is high, top holders own ${topHolderPct}%`,
          ja: `LP集中度が高く、上位保有者比率は${topHolderPct}%`,
          ru: `Высокая концентрация LP, доля крупнейших держателей ${topHolderPct}%`,
          ko: `LP 집중도가 높음, 상위 보유자 비율 ${topHolderPct}%`,
        }[locale];
      }
      return stats.LP_CONCENTRATION_HIGH;

    case 'LP_FAKE_SUPPORT_DETECTED':
      if (burnRatioPct) {
        return {
          zh: `检测到虚假 LP 支撑，异常 Burn 比例 ${burnRatioPct}%`,
          en: `Fake LP support detected, abnormal burn ratio ${burnRatioPct}%`,
          ja: `偽のLPサポートを検知、異常Burn比率は${burnRatioPct}%`,
          ru: `Обнаружена фиктивная поддержка LP, аномальный burn ratio ${burnRatioPct}%`,
          ko: `가짜 LP 지지 감지, 비정상 Burn 비율 ${burnRatioPct}%`,
        }[locale];
      }
      return stats.LP_FAKE_SUPPORT_DETECTED;

    case 'CEX_DEPTH_DROP':
      if (window && dropPct) {
        return {
          zh: `CEX 盘口深度近 ${window} 下降 ${dropPct}%`,
          en: `CEX order book depth dropped ${dropPct}% over ${window}`,
          ja: `CEX板の厚みが${window}で${dropPct}%低下`,
          ru: `Глубина стакана CEX снизилась на ${dropPct}% за ${window}`,
          ko: `CEX 오더북 깊이가 ${window} 동안 ${dropPct}% 감소`,
        }[locale];
      }
      return {
        zh: 'CEX 盘口深度下降',
        en: 'CEX order book depth dropped',
        ja: 'CEX板の厚みが低下',
        ru: 'Глубина стакана CEX снизилась',
        ko: 'CEX 오더북 깊이 감소',
      }[locale];

    case 'CEX_DEPTH_IMBALANCE':
      if (imbalancePct) {
        return {
          zh: `CEX 买卖盘失衡 ${imbalancePct}%`,
          en: `CEX order book is imbalanced by ${imbalancePct}%`,
          ja: `CEX板が${imbalancePct}%不均衡`,
          ru: `Стакан CEX несбалансирован на ${imbalancePct}%`,
          ko: `CEX 오더북이 ${imbalancePct}% 불균형`,
        }[locale];
      }
      return stats.CEX_DEPTH_IMBALANCE;

    case 'CEX_TRADE_IMPACT': {
      const bps = impactBps ? Number.parseFloat(impactBps) : Number.NaN;
      const amount = Number.isNaN(bps) ? (impactBps ? `${impactBps} bps` : '') : formatImpactPct(bps);
      if (!amount) {
        return {
          zh: 'CEX 大单冲击',
          en: 'CEX large trade impact detected',
          ja: 'CEX大口取引インパクトを検知',
          ru: 'Обнаружено влияние крупной сделки CEX',
          ko: 'CEX 대량 거래 충격 감지',
        }[locale];
      }
      return {
        zh: `CEX 大单冲击，最大 ${amount}`,
        en: `CEX large trade impact detected, max impact ${amount}`,
        ja: `CEX大口取引インパクトを検知、最大${amount}`,
        ru: `Обнаружено влияние крупной сделки CEX, максимум ${amount}`,
        ko: `CEX 대량 거래 충격 감지, 최대 ${amount}`,
      }[locale];
    }

    default:
      return '';
  }
};

/** 后端 guardFormatReasonEntryLocale：本地化失败时回退 `CODE (k=v, ...)` */
export const formatReasonEntryLocale = (reason: ReasonEntry, locale: GuardLocale): string => {
  const code = String(reason.code ?? '').trim();
  if (!code) return '';

  const text = localizedReasonText(code, reason.params, locale);
  if (text) return text;

  if (!reason.params || Object.keys(reason.params).length === 0) return code;
  const parts = Object.keys(reason.params)
    .sort()
    .map(key => `${key}=${String(reason.params?.[key])}`);
  return `${code} (${parts.join(', ')})`;
};

// ============ 币种块渲染（guardBuildCoinBlockLines） ============

const isSyncReasonCode = (code: string): boolean => {
  const c = String(code ?? '')
    .toUpperCase()
    .trim();
  return c === 'CROSS_SYNC_DETERIORATION' || c === 'DOUBLE_SIDED_DRAIN';
};

const reasonVenue = (code: string): 'dex' | 'cex' | 'general' => {
  const c = String(code ?? '')
    .toUpperCase()
    .trim();
  if (c.startsWith('DEX_') || c.startsWith('LP_')) return 'dex';
  if (c.startsWith('CEX_')) return 'cex';
  return 'general';
};

/** 后端 guardGroupedReasonEntries：DATA_UNAVAILABLE 过滤 + 双侧同步时跳过同步 code */
const groupedReasonEntries = (
  reasons: ReasonEntry[] | undefined,
  locale: GuardLocale,
  doubleSided: boolean,
): { dex: string[]; cex: string[]; general: string[] } => {
  const out = { dex: [] as string[], cex: [] as string[], general: [] as string[] };
  for (const reason of reasons ?? []) {
    const code = String(reason.code ?? '');
    if (code.toUpperCase().trim() === 'DATA_UNAVAILABLE') continue;
    if (doubleSided && isSyncReasonCode(code)) continue;
    const text = formatReasonEntryLocale(reason, locale);
    if (!text) continue;
    out[reasonVenue(code)].push(text);
  }
  return out;
};

/** 后端 guardIsMeaningfulLevel：None / Low 不展示 */
const isMeaningfulLevel = (level?: string): boolean => {
  const v = String(level ?? '')
    .toLowerCase()
    .trim();
  return v !== '' && v !== 'none' && v !== 'low';
};

/** 后端 guardHasReasonCode */
const hasReasonCode = (h: AlertHealth, code: string): boolean =>
  (h.reasons ?? []).some(r => String(r.code ?? '') === code);

/** 后端 guardVenueLines */
const venueLines = (venueLabel: string, reasons: string[], metrics: string): string[] => {
  if (reasons.length === 0) {
    if (!metrics.trim()) return [];
    return [`${BULLET_PREFIX}${venueLabel} · ${metrics}`];
  }
  let joined = reasons.join(' · ');
  if (!reasons[0].trim().startsWith(venueLabel)) {
    joined = `${venueLabel} · ${joined}`;
  }
  const lines = [`${BULLET_PREFIX}${joined}`];
  if (metrics.trim()) lines.push(`${DATA_PREFIX}${metrics}`);
  return lines;
};

/** 后端 guardDexDataLine：深度 · LP top1(锁) · 假 LP 次数 */
const dexDataLine = (h: AlertHealth, rctx: RenderContext, locale: GuardLocale): string => {
  const t = alertText(locale);
  const parts: string[] = [];
  const tokenId = h.token.token_id;
  const dex = rctx.liquidityChange[tokenId]?.dex;
  if (dex && (dex.depth_usd ?? 0) > 0) {
    parts.push(`${t.MetricDexDepth} ${formatUsdLocale(dex.depth_usd as number, locale)}`);
  }
  const lp = h.dex_risk?.evidence?.lp_concentration;
  if (lp && (lp.top1_ratio ?? 0) > 0 && !hasReasonCode(h, 'LP_CONCENTRATION_HIGH')) {
    let s = `${t.MetricLpTop1} ${formatPct0((lp.top1_ratio as number) * 100)}`;
    if ((lp.locked_ratio ?? 0) > 0) {
      s += `(${t.MetricLocked}${formatPct0((lp.locked_ratio as number) * 100)})`;
    }
    parts.push(s);
  }
  const fakeCount = h.dex_risk?.evidence?.fake_support?.abnormal_burn_count ?? 0;
  if (fakeCount > 0) {
    parts.push(`${t.MetricFakeLP} ${fakeCount}${t.MetricFakeLPUnit}`);
  }
  return parts.join(' · ');
};

/** 后端 guardCexDataLine：深度(窗口变化) · 失衡 · 大单冲击 */
const cexDataLine = (h: AlertHealth, rctx: RenderContext, locale: GuardLocale): string => {
  const t = alertText(locale);
  const parts: string[] = [];
  const tokenId = h.token.token_id;
  const cex = rctx.liquidityChange[tokenId]?.cex;
  if (cex && (cex.current_usd ?? 0) > 0) {
    let amt = formatUsdLocale(cex.current_usd as number, locale);
    if (!hasReasonCode(h, 'CEX_DEPTH_DROP')) {
      const window = cex.window || '5m';
      amt = `${amt}(${window} ${formatSignedPct(cex.depth_change_pct ?? 0)})`;
    }
    parts.push(amt);
  }
  const imbalance = h.cex_risk?.depth?.imbalance ?? 0;
  if (imbalance !== 0 && !hasReasonCode(h, 'CEX_DEPTH_IMBALANCE')) {
    parts.push(`${t.MetricImbalance} ${formatSignedPct0(imbalance * 100)}`);
  }
  const impact = h.cex_risk?.trade_impact?.max_impact_bps ?? 0;
  if (impact > 0 && !hasReasonCode(h, 'CEX_TRADE_IMPACT')) {
    parts.push(`${t.MetricLargeTrade} ${formatImpactPct(impact)}`);
  }
  return parts.join(' · ');
};

/** 后端 guardPriceDailyLine：价格 · 24h · 风险占比 */
const priceDailyLine = (h: AlertHealth, rctx: RenderContext, locale: GuardLocale): string => {
  const t = alertText(locale);
  const parts: string[] = [];
  const cexSymbol = h.token.cex_symbol;
  if (cexSymbol) {
    const p = rctx.prices[cexSymbol];
    if (p && (p.price ?? 0) > 0) {
      parts.push(
        `${t.MetricPrice} ${formatUsdLocale(p.price as number, locale)} · ${t.Metric1d} ${formatSignedPct(
          (p.gain ?? 0) * 100,
        )}`,
      );
    }
  }
  const exposure = rctx.dailyByToken[h.token.token_id]?.risk_exposure_pct ?? 0;
  if (exposure > 0) {
    parts.push(`${t.MetricDailyExposure} ${formatPct0(exposure)}`);
  }
  return parts.join(' · ');
};

/** 后端 guardAlertChangeText：风险变化行，颜色相同或缺失则不渲染 */
const changeText = (prevColor: string | undefined, curColor: string, locale: GuardLocale): string => {
  const prev = String(prevColor ?? '').trim();
  if (!prev || prev === curColor) return '';
  return {
    zh: `风险变化：${riskText(prev, locale)} → ${riskText(curColor, locale)}`,
    en: `Change: ${riskText(prev, locale)} → ${riskText(curColor, locale)}`,
    ja: `変化: ${riskText(prev, locale)} → ${riskText(curColor, locale)}`,
    ru: `Изменение: ${riskText(prev, locale)} → ${riskText(curColor, locale)}`,
    ko: `변화: ${riskText(prev, locale)} → ${riskText(curColor, locale)}`,
  }[locale];
};

/** 后端 guardIsDoubleSidedDrain */
const isDoubleSidedDrain = (h: AlertHealth): boolean => Boolean(h.cross_risk?.synced);

/** 后端 guardBuildCoinBlockLines */
export const buildCoinBlockLines = (
  alert: TriggeredAlert,
  rctx: RenderContext,
  locale: GuardLocale,
  symbolFallback?: Record<string, string>,
): string[] => {
  const h = alert.health;
  const t = alertText(locale);
  const symbol = symbolFallback?.[h.token.token_id] || h.token.symbol || h.token.token_id || '';

  const lines: string[] = [`${colorDot(h.color)} ${symbol} · ${riskText(h.color, locale)}`];

  const change = changeText(h.previous_color, h.color, locale);
  if (change) lines.push(`${SUB_LINE_PREFIX}${change}`);

  if (isDoubleSidedDrain(h)) {
    lines.push(`${SUB_LINE_PREFIX}⚠️ ${syncDeteriorationText(h.cross_risk?.window, locale)}`);
  }

  const groups = groupedReasonEntries(h.reasons, locale, isDoubleSidedDrain(h));

  if (groups.dex.length > 0 || isMeaningfulLevel(h.dex_risk?.level)) {
    lines.push(...venueLines(t.DEXLabel, groups.dex, dexDataLine(h, rctx, locale)));
  }
  if (groups.cex.length > 0 || isMeaningfulLevel(h.cex_risk?.level)) {
    lines.push(...venueLines(t.CEXLabel, groups.cex, cexDataLine(h, rctx, locale)));
  }
  for (const g of groups.general) {
    lines.push(`${BULLET_PREFIX}${g}`);
  }

  const pl = priceDailyLine(h, rctx, locale);
  if (pl.trim()) lines.push(`${BULLET_PREFIX}${pl}`);

  return lines;
};

// ============ 时间与拆段 ============

/** locale 回退时区（后端 guardLocaleTimezone） */
const localeTimeZone = (locale: GuardLocale): string => {
  switch (locale) {
    case 'zh':
      return 'Asia/Shanghai';
    case 'ja':
      return 'Asia/Tokyo';
    case 'ko':
      return 'Asia/Seoul';
    case 'ru':
      return 'Europe/Moscow';
    default:
      return 'UTC';
  }
};

/** 用户 IANA → locale 回退 → UTC（后端 guardAlertTimezone） */
const resolveTimeZone = (tz: string | undefined, locale: GuardLocale): string => {
  const candidate = String(tz ?? '').trim();
  if (candidate) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
      return candidate;
    } catch {
      // 无效 IANA 名，落回 locale 时区
    }
  }
  return localeTimeZone(locale);
};

/** 按后端 "2006-01-02 15:04" 格式输出并判断是否 UTC 零偏移 */
const formatAlertTime = (date: Date, timeZone: string): { text: string; isUtc: boolean } => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const pick = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  // en-CA 的 hour 在 24 点制下可能给出 "24"，归一为 "00"
  const hour = pick('hour') === '24' ? '00' : pick('hour');
  const text = `${pick('year')}-${pick('month')}-${pick('day')} ${hour}:${pick('minute')}`;

  const offset =
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(date)
      .find(p => p.type === 'timeZoneName')?.value ?? '';
  const isUtc = offset === 'GMT' || offset === 'UTC' || offset === 'GMT+00:00';

  return { text, isUtc };
};

/** 后端 guardAlertMessageTime：首条 health 的 computed_at，缺失取当前时间 */
const messageTime = (alerts: TriggeredAlert[]): Date => {
  const raw = alerts[0]?.health?.computed_at;
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
};

interface MergedParts {
  header: string[];
  blocks: string[];
  footerLine: string;
  contHeader: string;
}

/** 后端 guardBuildMergedAlertParts */
const buildMergedAlertParts = (
  alerts: TriggeredAlert[],
  rctx: RenderContext,
  locale: GuardLocale,
  timeZone: string,
  symbolFallback?: Record<string, string>,
): MergedParts => {
  const t = alertText(locale);
  const { text: timeStr, isUtc } = formatAlertTime(messageTime(alerts), timeZone);
  // 后端行为：仅 EN 在零偏移时显式标注 UTC
  const timeLabel = locale === 'en' && isUtc ? `${timeStr} UTC` : timeStr;

  return {
    header: [t.TitleFmt.replace('%s', timeLabel), '', t.CountFmt.replace('%d', String(alerts.length))],
    blocks: alerts.map(a => buildCoinBlockLines(a, rctx, locale, symbolFallback).join('\n')),
    footerLine: `ℹ️ ${t.Disclaimer}`,
    contHeader: t.TitleContFmt.replace('%s', timeLabel),
  };
};

/** 后端 guardBuildMergedAlertSegments：贪婪装填，币种块不可分割 */
export const buildMergedAlertSegments = (
  alerts: TriggeredAlert[],
  rctx: RenderContext,
  locale: GuardLocale,
  timeZone?: string,
  symbolFallback?: Record<string, string>,
): AlertSegment[] => {
  if (alerts.length === 0) return [];

  const tz = resolveTimeZone(timeZone, locale);
  const parts = buildMergedAlertParts(alerts, rctx, locale, tz, symbolFallback);
  const footerReserve = utf8Bytes(`\n\n${parts.footerLine}`) + 2;

  const segments: AlertSegment[] = [];
  let cur = '';
  let curIndices: number[] = [];
  let curHasBlock = false;

  const flush = () => {
    segments.push({ text: cur, alertIndices: curIndices, bytes: utf8Bytes(cur) });
    cur = '';
    curIndices = [];
    curHasBlock = false;
  };

  cur = parts.header.join('\n');
  for (let i = 0; i < parts.blocks.length; i++) {
    const block = parts.blocks[i];
    if (curHasBlock && utf8Bytes(cur) + utf8Bytes(block) + footerReserve > ALERT_MAX_PAYLOAD_BYTES) {
      flush();
      cur = parts.contHeader;
    }
    cur += `\n\n${block}`;
    curIndices.push(i);
    curHasBlock = true;
  }
  cur += `\n\n${parts.footerLine}`;
  flush();

  return segments;
};

/** 后端 guardBuildMergedAlertMessage：不拆段的完整文本（便于对照"没超限时长什么样"） */
export const buildMergedAlertMessage = (
  alerts: TriggeredAlert[],
  rctx: RenderContext,
  locale: GuardLocale,
  timeZone?: string,
  symbolFallback?: Record<string, string>,
): string => {
  if (alerts.length === 0) return '';
  const tz = resolveTimeZone(timeZone, locale);
  const parts = buildMergedAlertParts(alerts, rctx, locale, tz, symbolFallback);
  return [parts.header.join('\n'), ...parts.blocks, parts.footerLine].join('\n\n');
};

/** 组装 Web Push payload（后端 webpush.Payload 对应物） */
export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  data?: { url?: string };
}

/** 后端 guardPushTitleAndBody：首行作标题，其余作正文 */
export const toPushPayload = (segmentText: string, userId = 'preview'): PushPayload => {
  const idx = segmentText.indexOf('\n');
  const title = (idx < 0 ? segmentText : segmentText.slice(0, idx)).trim();
  const body = idx < 0 ? '' : segmentText.slice(idx + 1);
  return {
    title: title || 'Guard Alert',
    body,
    tag: `guard:${userId}`,
    data: { url: '/alerts' },
  };
};
