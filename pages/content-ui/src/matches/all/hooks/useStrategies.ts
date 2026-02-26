import { useMemo } from 'react';
import { useI18n } from '@src/lib/i18n';

export interface Strategy {
  label: string;
  value: string;
}

export interface StrategyCategory {
  trendTracking: Strategy[];
  momentum: Strategy[];
  overboughtOversold: Strategy[];
  volumePrice: Strategy[];
  pattern: Strategy[];
  volatility: Strategy[];
}

/**
 * Hook to get all trading strategies organized by 6 major categories
 * Each category contains an array of strategies with internationalized labels and values
 *
 * @returns StrategyCategory object containing 6 categories of strategies
 *
 * @example
 * const strategies = useStrategies();
 * console.log(strategies.trendTracking); // [{ label: "MA Short-term crosses Long-term", value: "ma_cross" }, ...]
 */
export function useStrategies(): StrategyCategory {
  const { t } = useI18n();

  const strategies = useMemo<StrategyCategory>(() => {
    // 安全检查：如果 t 或 t.strategy 不存在，返回空数组
    if (!t || !t.strategy) {
      return {
        trendTracking: [],
        momentum: [],
        overboughtOversold: [],
        volumePrice: [],
        pattern: [],
        volatility: [],
      };
    }

    return {
      // 1. 趋势跟踪策略 (Trend Tracking Strategies)
      trendTracking: [
        {
          label: t.strategy.trendTracking.ma_cross || 'MA Short-term crosses Long-term',
          value: 'ma_cross',
        },
        {
          label: t.strategy.trendTracking.ma_bull_bear || 'MA Bullish/Bearish Arrangement',
          value: 'ma_bull_bear',
        },
        {
          label: t.strategy.trendTracking.ma_overbought_oversold || 'MA Price Deviation Overbought/Oversold',
          value: 'ma_overbought_oversold',
        },
        {
          label: t.strategy.trendTracking.ma_price_breakthrough || 'MA Price Breakthrough',
          value: 'ma_price_breakthrough',
        },
        {
          label: t.strategy.trendTracking.ma_twist || 'MA Convergence',
          value: 'ma_twist',
        },
        {
          label: t.strategy.trendTracking.sar_trend || 'SAR Trend Direction',
          value: 'sar_trend',
        },
        {
          label: t.strategy.trendTracking.sar_reversal || 'SAR Reversal Signal',
          value: 'sar_reversal',
        },
        {
          label: t.strategy.trendTracking.dma_through_ama || 'DMA crosses AMA',
          value: 'dma_through_ama',
        },
        {
          label: t.strategy.trendTracking.dma_ama_trend || 'DMA/AMA Trend Direction',
          value: 'dma_ama_trend',
        },
        {
          label: t.strategy.trendTracking.dma_top_low || 'DMA Top/Bottom',
          value: 'dma_top_low',
        },
        {
          label: t.strategy.trendTracking.adx_di_trough || 'ADX +DI/-DI Cross',
          value: 'adx_di_trough',
        },
        {
          label: t.strategy.trendTracking.adx_trend || 'ADX Trend Strength',
          value: 'adx_trend',
        },
        {
          label: t.strategy.trendTracking.vwap_above_strong || 'Price Above VWAP Strong',
          value: 'vwap_above_strong',
        },
        {
          label: t.strategy.trendTracking.vwap_below_weak || 'Price Below VWAP Weak',
          value: 'vwap_below_weak',
        },
        {
          label: t.strategy.trendTracking.vwap_breakout || 'Breakout Above VWAP',
          value: 'vwap_breakout',
        },
        {
          label: t.strategy.trendTracking.vwap_breakdown || 'Breakdown Below VWAP',
          value: 'vwap_breakdown',
        },
        {
          label: t.strategy.trendTracking.vwap_support || 'VWAP as Support',
          value: 'vwap_support',
        },
        {
          label: t.strategy.trendTracking.vwap_resistance || 'VWAP as Resistance',
          value: 'vwap_resistance',
        },
      ],

      // 2. 动量指标策略 (Momentum Strategies)
      momentum: [
        {
          label: t.strategy.momentum.macd_golden_cross || 'MACD DIF crosses DEA',
          value: 'macd_golden_cross',
        },
        {
          label: t.strategy.momentum.macd_zero_cross || 'MACD Zero Line Cross',
          value: 'macd_zero_cross',
        },
        {
          label: t.strategy.momentum.macd_pos_neg || 'MACD Histogram Positive/Negative',
          value: 'macd_pos_neg',
        },
        {
          label: t.strategy.momentum.macd_histogram_grow || 'MACD Histogram Growing',
          value: 'macd_histogram_grow',
        },
        {
          label: t.strategy.momentum.macd_histogram_shrink || 'MACD Histogram Shrinking',
          value: 'macd_histogram_shrink',
        },
        {
          label: t.strategy.momentum.macd_divergence || 'MACD Divergence',
          value: 'macd_divergence',
        },
        {
          label: t.strategy.momentum.rsi_overbought_oversold || 'RSI Overbought/Oversold',
          value: 'rsi_overbought_oversold',
        },
        {
          label: t.strategy.momentum.rsi_midline_cross || 'RSI Crosses 50 Midline',
          value: 'rsi_midline_cross',
        },
        {
          label: t.strategy.momentum.rsi_divergence || 'RSI Divergence',
          value: 'rsi_divergence',
        },
        {
          label: t.strategy.momentum.kdj_cross || 'KDJ Golden/Death Cross',
          value: 'kdj_cross',
        },
        {
          label: t.strategy.momentum.kdj_overbought_oversold || 'KDJ-K Value Range',
          value: 'kdj_overbought_oversold',
        },
        {
          label: t.strategy.momentum.kdj_compare_d || 'KDJ-D Value Range',
          value: 'kdj_compare_d',
        },
        {
          label: t.strategy.momentum.kdj_compare_j || 'KDJ-J Value Range',
          value: 'kdj_compare_j',
        },
        {
          label: t.strategy.momentum.roc_compare_value || 'ROC Value Comparison',
          value: 'roc_compare_value',
        },
        {
          label: t.strategy.momentum.roc_through_zero || 'ROC Zero Line Cross',
          value: 'roc_through_zero',
        },
        {
          label: t.strategy.momentum.roc_extreme_value || 'ROC Extreme Value',
          value: 'roc_extreme_value',
        },
        {
          label: t.strategy.momentum.roc_divergence || 'ROC Divergence',
          value: 'roc_divergence',
        },
        {
          label: t.strategy.momentum.cci_compare_value || 'CCI Value Comparison',
          value: 'cci_compare_value',
        },
        {
          label: t.strategy.momentum.cci_through || 'CCI Threshold Cross',
          value: 'cci_through',
        },
        {
          label: t.strategy.momentum.wr_compare_value || 'WR Value Comparison',
          value: 'wr_compare_value',
        },
        {
          label: t.strategy.momentum.wr_through || 'WR Threshold Cross',
          value: 'wr_through',
        },
        {
          label: t.strategy.momentum.stoch_rsi_compare || 'Stochastic RSI Comparison',
          value: 'stoch_rsi_compare',
        },
      ],

      // 3. 超买超卖策略 (Overbought/Oversold Strategies)
      overboughtOversold: [
        {
          label: t.strategy.overboughtOversold.mfi_analysis || 'MFI Single Token Analysis',
          value: 'mfi_analysis',
        },
        {
          label: t.strategy.overboughtOversold.mfi_batch_analysis || 'MFI Batch Analysis',
          value: 'mfi_batch_analysis',
        },
        {
          label: t.strategy.overboughtOversold.mfi_overbought || 'MFI>80 Overbought',
          value: 'mfi_overbought',
        },
        {
          label: t.strategy.overboughtOversold.mfi_oversold || 'MFI<20 Oversold',
          value: 'mfi_oversold',
        },
        {
          label: t.strategy.overboughtOversold.mfi_top_divergence || 'MFI Top Divergence',
          value: 'mfi_top_divergence',
        },
        {
          label: t.strategy.overboughtOversold.mfi_bottom_divergence || 'MFI Bottom Divergence',
          value: 'mfi_bottom_divergence',
        },
      ],

      // 4. 量价分析策略 (Volume-Price Strategies)
      volumePrice: [
        {
          label: t.strategy.volumePrice.obv_sync_uptrend || 'Price and OBV Sync Uptrend',
          value: 'obv_sync_uptrend',
        },
        {
          label: t.strategy.volumePrice.obv_top_divergence || 'OBV Top Divergence',
          value: 'obv_top_divergence',
        },
        {
          label: t.strategy.volumePrice.obv_bottom_divergence || 'OBV Bottom Divergence',
          value: 'obv_bottom_divergence',
        },
        {
          label: t.strategy.volumePrice.volume_price_rise || 'Volume Price Rise Together',
          value: 'volume_price_rise',
        },
        {
          label: t.strategy.volumePrice.volume_price_divergence || 'Volume Price Divergence',
          value: 'volume_price_divergence',
        },
        {
          label: t.strategy.volumePrice.volume_retrace || 'Volume Retrace',
          value: 'volume_retrace',
        },
        {
          label: t.strategy.volumePrice.volume_price_drop_surge || 'Volume Price Drop Surge',
          value: 'volume_price_drop_surge',
        },
        {
          label: t.strategy.volumePrice.volume_price_extreme || 'Extreme Volume Price',
          value: 'volume_price_extreme',
        },
        {
          label: t.strategy.volumePrice.volume_price_minimum || 'Minimum Volume Price',
          value: 'volume_price_minimum',
        },
        {
          label: t.strategy.volumePrice.volume_surge || 'Volume Surge',
          value: 'volume_surge',
        },
        {
          label: t.strategy.volumePrice.volume_compare_fold || 'Volume vs Average Multiple',
          value: 'volume_compare_fold',
        },
        {
          label: t.strategy.volumePrice.emv_compare_value || 'EMV Value Comparison',
          value: 'emv_compare_value',
        },
        {
          label: t.strategy.volumePrice.emv_divergence || 'EMV Divergence',
          value: 'emv_divergence',
        },
      ],

      // 5. 形态识别策略 (Pattern Recognition Strategies)
      pattern: [
        {
          label: t.strategy.pattern.candlestick_patterns || 'Candlestick Pattern Scanning',
          value: 'candlestick_patterns',
        },
        {
          label: t.strategy.pattern.token_pattern_analysis || 'Token Pattern Analysis',
          value: 'token_pattern_analysis',
        },
        {
          label: t.strategy.pattern.consecutive_patterns || 'Consecutive Patterns',
          value: 'consecutive_patterns',
        },
        {
          label: t.strategy.pattern.chart_patterns || 'Chart Pattern Scanning',
          value: 'chart_patterns',
        },
      ],

      // 6. 波动率策略 (Volatility Strategies)
      volatility: [
        {
          label: t.strategy.volatility.bband_squeeze || 'Bollinger Bands Squeeze',
          value: 'bband_squeeze',
        },
        {
          label: t.strategy.volatility.bband_touch || 'Bollinger Bands Touch',
          value: 'bband_touch',
        },
        {
          label: t.strategy.volatility.bband_attach || 'Bollinger Bands Attach',
          value: 'bband_attach',
        },
        {
          label: t.strategy.volatility.bband_fake_breakout || 'Bollinger Bands Fake Breakout',
          value: 'bband_fake_breakout',
        },
        {
          label: t.strategy.volatility.bband_breakout || 'Bollinger Bands Breakout',
          value: 'bband_breakout',
        },
        {
          label: t.strategy.volatility.atr_trend || 'ATR Trend',
          value: 'atr_trend',
        },
        {
          label: t.strategy.volatility.atr_exceed_highest || 'ATR Exceed Highest',
          value: 'atr_exceed_highest',
        },
      ],
    };
  }, [t]);

  return strategies;
}
