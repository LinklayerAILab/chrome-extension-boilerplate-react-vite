export interface LocaleMessages {
  settings: {
    title: string;
    language: string;
    pluginPermissions: string;
  };
  languages: {
    en: string;
    ko: string;
    ja: string;
    zh: string;
    ru: string;
  };
  apiForm: {
    readOnlyApiDocs: string;
    uploadReadOnlyApi2: string;
    uploadReadOnlyApiDesc: string;
    uploadApi: string;
    apiGuide: string;
    exchangeLabel: string;
    apiKeyLabel: string;
    secretKeyLabel: string;
    passphraseLabel: string;
    apiKeyPlaceholder: string;
    secretKeyPlaceholder: string;
    passphrasePlaceholder: string;
    submit: string;
    readOnlyApiTitle: string;
    readOnlyApiDescription: string;
    cexNameRequired: string;
    apiKeyRequired: string;
    secretKeyRequired: string;
    passphraseRequired: string;
    submitSuccess: string;
    pageTitleUpload: string;
    pageDescUpload: string;
    pageTitleGuide: string;
    pageDescGuide: string;
  };
  menus: {
    alpha: string;
    api: string;
    earn: string;
    perps: string;
    poliet: string;
    points: string;
  };
  strategy: {
    types: {
      trendTracking: string;
      momentum: string;
      overboughtOversold: string;
      volumePrice: string;
      pattern: string;
      volatility: string;
    };
    trendTracking: {
      ma_cross: string;
      ma_bull_bear: string;
      ma_overbought_oversold: string;
      ma_price_breakthrough: string;
      ma_twist: string;
      sar_trend: string;
      sar_reversal: string;
      dma_through_ama: string;
      dma_ama_trend: string;
      dma_top_low: string;
      adx_di_trough: string;
      adx_trend: string;
      vwap_above_strong: string;
      vwap_below_weak: string;
      vwap_breakout: string;
      vwap_breakdown: string;
      vwap_support: string;
      vwap_resistance: string;
    };
    momentum: {
      macd_golden_cross: string;
      macd_zero_cross: string;
      macd_pos_neg: string;
      macd_histogram_grow: string;
      macd_histogram_shrink: string;
      macd_divergence: string;
      rsi_overbought_oversold: string;
      rsi_midline_cross: string;
      rsi_divergence: string;
      kdj_cross: string;
      kdj_overbought_oversold: string;
      kdj_compare_d: string;
      kdj_compare_j: string;
      roc_compare_value: string;
      roc_through_zero: string;
      roc_extreme_value: string;
      roc_divergence: string;
      cci_compare_value: string;
      cci_through: string;
      wr_compare_value: string;
      wr_through: string;
      stoch_rsi_compare: string;
    };
    overboughtOversold: {
      mfi_analysis: string;
      mfi_batch_analysis: string;
      mfi_overbought: string;
      mfi_oversold: string;
      mfi_top_divergence: string;
      mfi_bottom_divergence: string;
    };
    volumePrice: {
      obv_sync_uptrend: string;
      obv_top_divergence: string;
      obv_bottom_divergence: string;
      volume_price_rise: string;
      volume_price_divergence: string;
      volume_retrace: string;
      volume_price_drop_surge: string;
      volume_price_extreme: string;
      volume_price_minimum: string;
      volume_surge: string;
      volume_compare_fold: string;
      emv_compare_value: string;
      emv_divergence: string;
    };
    pattern: {
      candlestick_patterns: string;
      token_pattern_analysis: string;
      consecutive_patterns: string;
      chart_patterns: string;
    };
    volatility: {
      bband_squeeze: string;
      bband_touch: string;
      bband_attach: string;
      bband_fake_breakout: string;
      bband_breakout: string;
      atr_trend: string;
      atr_exceed_highest: string;
    };
  };
  loginPanel: {
    logout: string;
    evmAddress: string;
    emailAddress: string;
    myPoints: string;
    myInvite: string;
  };
  alpha: {
    myAlphaHolding: string;
    updateAgo: string;
    worstToken: string;
    noDataTitle: string;
    noDataDescription: string;
    liquidityCheck: string;
  };
  common: {
    price: string;
    explorer: string;
    agent: string;
    search: string;
    token: string;
    spot: string;
    futures: string;
    trading: string;
    loading: string;
    notAvailable: string;
    scrollToLoadMore: string;
    noMoreData: string;
    noData: string;
    pleaseLogin: string;
    notEnoughPoints: string;
    syncPointsFailed: string;
    requestFailed: string;
    stopGenerationTip: string;
    gotIt: string;
    taskRunning: string;
    copySuccess: string;
    copyError: string;
    time: string;
    type: string;
    points: string;
    lpDepth: string;
    time5m: string;
  };
  agent: {
    tokenName: string;
    currentPrice: string;
    contract: string;
    analyze: string;
    analyzing: string;
    analyzeCoin: string;
    recommendCoin: string;
    initStr1: string;
    picker: string;
    tracker: string;
    pickerAgentDesc: string;
    trackerAgentDesc: string;
    searchPlaceholder: string;
    dataRefreshFailed: string;
    updateFailed: string;
    copyContent: string;
    shareReport: string;
    downloadReport: string;
    linkLayerAI: string;
    downloadError: string;
    downloadSuccess: string;
    scanCode: string;
    scanTip: string;
    download: string;
    trading: string;
  };
  home: {
    retroactiveBonus: string;
    retroactiveBonusDesc: string;
    recurringRewards: string;
    recurringRewardsDesc: string;
    ready: string;
    claimAllBonuses: string;
    cycle: string;
    liquidation: string;
    times: string;
    bonus: string;
    received: string;
    countdown: string;
    rewards: string;
    claim: string;
    claimHistory: string;
  };
  myPoints: {
    rechargePoints: string;
    paymentMethod: string;
    recharge: string;
    pointsRecord: string;
    points: string;
  };
  invite: {
    shareTitle: string;
    shareDesc1: string;
    shareDesc2: string;
    shareDesc3: string;
    copyLink: string;
    postOn: string;
    shareText: string;
    noInviteCode: string;
  };
  subscribe: {
    bind_web3: string;
    bind_email: string;
    follow_x: string;
    telegram_group: string;
    new_user: string;
    invite_user: string;
    subcribe: string;
  };
  pageInfo: {
    alpha: {
      title: string;
      description: string;
    };
    api: {
      title: string;
      description: string;
    };
    earn: {
      title: string;
      description: string;
    };
    perps: {
      title: string;
      description: string;
    };
    poliet: {
      title: string;
      description: string;
    };
    points: {
      title: string;
      description: string;
    };
  };
}
