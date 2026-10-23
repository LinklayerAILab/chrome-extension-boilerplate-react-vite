/**
 * 预览用示例数据：未开启推送（guardPushState 缺失）时兜底，
 * 也用于覆盖真实数据不一定同时出现的渲染分支。
 *
 * 三组场景对应后端最容易出问题的排版路径：
 *   1. 单币红色告警（风险变化行 + 双侧同步恶化 + DEX 结论/数据行）
 *   2. 多币合并（触发按 3500 bytes 拆段）
 *   3. 全绿无明细（验证"没有可展示数据"时的降级排版）
 */
import type { RenderContext, TriggeredAlert } from './render';

/** 固定时间戳，避免每次刷新预览时间都在变 */
const BASE_TIME = '2026-10-22T17:40:00+08:00';

const singleRed: TriggeredAlert[] = [
  {
    eventId: 1760,
    health: {
      token: { token_id: 'bg_xrp', symbol: 'XRP', cex_symbol: 'XRPUSDT' },
      color: 'red',
      level: 'High',
      previous_color: 'yellow',
      previous_level: 'Medium',
      is_double_sided: true,
      computed_at: BASE_TIME,
      reasons: [
        { code: 'CROSS_SYNC_DETERIORATION' },
        { code: 'LP_CONCENTRATION_HIGH', params: { top_holder_pct: 100 } },
        { code: 'CEX_DEPTH_IMBALANCE', params: { imbalance_pct: 22 } },
      ],
      dex_risk: {
        level: 'High',
        evidence: {
          lp_concentration: { top1_ratio: 1, locked_ratio: 0 },
          fake_support: { abnormal_burn_count: 0 },
        },
      },
      cex_risk: {
        level: 'High',
        depth: { imbalance: 0.22 },
        trade_impact: { max_impact_bps: 0 },
      },
      cross_risk: { window: '15m', synced: true },
    },
  },
];

const multiCoin: TriggeredAlert[] = [
  {
    eventId: 1772,
    health: {
      token: { token_id: 'bg_comp', symbol: 'COMP', cex_symbol: 'COMPUSDT' },
      color: 'green',
      level: 'Low',
      computed_at: BASE_TIME,
      reasons: [{ code: 'DEX_LIQUIDITY_RISK' }],
      dex_risk: { level: 'Low', evidence: {} },
      cex_risk: { level: 'Low', depth: { imbalance: 0 }, trade_impact: { max_impact_bps: 0 } },
      cross_risk: { window: '15m', synced: false },
    },
  },
  {
    eventId: 1769,
    health: {
      token: { token_id: 'bg_xrp', symbol: 'XRP', cex_symbol: 'XRPUSDT' },
      color: 'yellow',
      level: 'Mild',
      previous_color: 'green',
      previous_level: 'Low',
      computed_at: BASE_TIME,
      reasons: [{ code: 'LP_CONCENTRATION_HIGH', params: { top_holder_pct: 100 } }],
      dex_risk: {
        level: 'Mild',
        evidence: { lp_concentration: { top1_ratio: 1, locked_ratio: 0.35 } },
      },
      cex_risk: { level: 'Low', depth: { imbalance: 0.04 }, trade_impact: { max_impact_bps: 0 } },
      cross_risk: { window: '15m', synced: false },
    },
  },
  {
    eventId: 1764,
    health: {
      token: { token_id: 'bg_comp', symbol: 'COMP', cex_symbol: 'COMPUSDT' },
      color: 'yellow',
      level: 'Mild',
      computed_at: BASE_TIME,
      reasons: [{ code: 'DEX_LIQUIDITY_RISK' }, { code: 'CEX_TRADE_IMPACT', params: { impact_bps: 26 } }],
      dex_risk: { level: 'Mild', evidence: { fake_support: { abnormal_burn_count: 2 } } },
      cex_risk: {
        level: 'Mild',
        depth: { imbalance: -0.08 },
        trade_impact: { max_impact_bps: 26 },
      },
      cross_risk: { window: '15m', synced: false },
    },
  },
  {
    eventId: 1744,
    health: {
      token: { token_id: 'bg_zkc', symbol: 'ZKC', cex_symbol: 'ZKCUSDT' },
      color: 'yellow',
      level: 'Medium',
      computed_at: BASE_TIME,
      reasons: [{ code: 'CEX_DEPTH_IMBALANCE', params: { imbalance_pct: 17 } }],
      dex_risk: { level: 'Low', evidence: {} },
      cex_risk: {
        level: 'Medium',
        depth: { imbalance: 0.17 },
        trade_impact: { max_impact_bps: 0 },
      },
      cross_risk: { window: '15m', synced: false },
    },
  },
  {
    eventId: 1735,
    health: {
      token: { token_id: 'bg_tslab', symbol: 'TSLAB', cex_symbol: '' },
      color: 'yellow',
      level: 'Mild',
      computed_at: BASE_TIME,
      reasons: [{ code: 'CROSS_SYNC_DETERIORATION' }, { code: 'DEX_LIQUIDITY_RISK' }],
      dex_risk: { level: 'Mild', evidence: {} },
      cex_risk: { level: 'Low', depth: { imbalance: 0 }, trade_impact: { max_impact_bps: 0 } },
      cross_risk: { window: '15m', synced: true },
    },
  },
];

/**
 * 大批量场景：程序化生成 N 个币种块，用于验证拆段。
 * 手写 20+ 个币太啰嗦且容易改坏，这里按固定规则生成，保证每次结果一致。
 * 每个块含风险变化行、双侧恶化行、DEX/CEX 结论与数据行、价格行，
 * 单块约 350~450 字节，12 个即可稳定越过 3500 字节预算。
 */
const LARGE_BATCH_SYMBOLS = [
  'BTC',
  'ETH',
  'SOL',
  'BNB',
  'XRP',
  'DOGE',
  'ADA',
  'AVAX',
  'LINK',
  'DOT',
  'MATIC',
  'UNI',
  'ATOM',
  'LTC',
  'NEAR',
  'APT',
];

const largeBatch: TriggeredAlert[] = LARGE_BATCH_SYMBOLS.map((symbol, index) => {
  const isDoubleSided = index % 3 === 0;
  const tokenId = `bg_${symbol.toLowerCase()}`;
  return {
    eventId: 1800 - index,
    health: {
      token: { token_id: tokenId, symbol, cex_symbol: `${symbol}USDT` },
      color: index % 4 === 0 ? 'red' : index % 2 === 0 ? 'yellow' : 'green',
      level: index % 4 === 0 ? 'High' : index % 2 === 0 ? 'Medium' : 'Low',
      previous_color: index % 2 === 0 ? 'green' : undefined,
      previous_level: index % 2 === 0 ? 'Low' : undefined,
      computed_at: BASE_TIME,
      reasons: isDoubleSided
        ? [
            { code: 'CROSS_SYNC_DETERIORATION' },
            { code: 'DEX_LIQUIDITY_RISK' },
            { code: 'CEX_DEPTH_IMBALANCE', params: { imbalance_pct: 18 + index } },
          ]
        : [{ code: 'LP_CONCENTRATION_HIGH', params: { top_holder_pct: 62 + index } }],
      dex_risk: {
        level: isDoubleSided ? 'High' : 'Mild',
        evidence: {
          lp_concentration: { top1_ratio: 0.62 + index * 0.01, locked_ratio: 0.2 },
          fake_support: { abnormal_burn_count: index % 5 === 0 ? 3 : 0 },
        },
      },
      cex_risk: {
        level: isDoubleSided ? 'Medium' : 'Low',
        depth: { imbalance: (18 + index) / 100 },
        trade_impact: { max_impact_bps: index % 3 === 0 ? 40 + index : 0 },
      },
      cross_risk: { window: '15m', synced: isDoubleSided },
    },
  };
});

const largeBatchContext: RenderContext = LARGE_BATCH_SYMBOLS.reduce<RenderContext>(
  (acc, symbol, index) => {
    const tokenId = `bg_${symbol.toLowerCase()}`;
    acc.liquidityChange[tokenId] = {
      cex: { current_usd: 500_000 + index * 250_000, depth_change_pct: -0.2 - index * 0.05, window: '5m' },
      dex: { depth_usd: 300_000 + index * 180_000 },
    };
    acc.prices[`${symbol}USDT`] = { price: 1.23 + index * 0.5, gain: index % 2 === 0 ? 0.012 : -0.008 };
    acc.dailyByToken[tokenId] = { risk_exposure_pct: 30 + index * 4 };
    return acc;
  },
  { liquidityChange: {}, prices: {}, dailyByToken: {} },
);

const allGreen: TriggeredAlert[] = [
  {
    eventId: 9999,
    health: {
      token: { token_id: 'bg_eth', symbol: 'ETH', cex_symbol: 'ETHUSDT' },
      color: 'green',
      level: 'Low',
      computed_at: BASE_TIME,
      reasons: [{ code: 'LIQUIDITY_NORMAL' }],
      dex_risk: { level: 'Low', evidence: {} },
      cex_risk: { level: 'Low', depth: { imbalance: 0 }, trade_impact: { max_impact_bps: 0 } },
      cross_risk: { window: '15m', synced: false },
    },
  },
];

const demoContext: RenderContext = {
  liquidityChange: {
    bg_xrp: {
      cex: { current_usd: 8_420_000, depth_change_pct: -0.64, window: '5m' },
      dex: { depth_usd: 4_590_600 },
    },
    bg_comp: {
      cex: { current_usd: 1_240_000, depth_change_pct: 1.12, window: '5m' },
      dex: { depth_usd: 890_000 },
    },
    bg_zkc: {
      cex: { current_usd: 640_000, depth_change_pct: -0.21, window: '5m' },
      dex: { depth_usd: 310_000 },
    },
    bg_tslab: {
      cex: { current_usd: 210_000, depth_change_pct: 0.94, window: '5m' },
      dex: { depth_usd: 88_000 },
    },
    bg_eth: {
      cex: { current_usd: 42_100_000, depth_change_pct: 0.03, window: '5m' },
      dex: { depth_usd: 31_500_000 },
    },
  },
  prices: {
    XRPUSDT: { price: 2.4137, gain: 0.0086 },
    COMPUSDT: { price: 103.76, gain: 0.0023 },
    ZKCUSDT: { price: 0.4871, gain: -0.0142 },
    ETHUSDT: { price: 3_842.15, gain: 0.0124 },
  },
  dailyByToken: {
    bg_xrp: { risk_exposure_pct: 80 },
    bg_comp: { risk_exposure_pct: 42 },
  },
};

export interface SampleScenario {
  id: string;
  title: string;
  description: string;
  alerts: TriggeredAlert[];
  context: RenderContext;
}

export const SAMPLE_SCENARIOS: SampleScenario[] = [
  {
    id: 'single-red',
    title: '单币红色告警',
    description: '风险变化行、⚠️ 双侧同步恶化、DEX 结论行 + 数据行、价格与风险占比',
    alerts: singleRed,
    context: demoContext,
  },
  {
    id: 'multi-coin',
    title: '多币合并（触发拆段）',
    description: '16 个币同轮触发，超过 3500 字节预算，验证续段头与 footer 只进末段',
    alerts: largeBatch,
    context: largeBatchContext,
  },
  {
    id: 'all-green',
    title: '全绿无明细',
    description: '只有币种行没有明细，验证降级排版不出现空行或孤立分隔符',
    alerts: allGreen,
    context: demoContext,
  },
];
