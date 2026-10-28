export interface LocaleMessages {
  settings: {
    title: string;
    language: string;
    pluginPermissions: string;
    notifications: string;
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
    token: string;
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
    connectFirst: string;
    /** 钱包实际已断开时地址行的提示 */
    walletDisconnected: string;
    /** My Account 页面：关注位用量 */
    watchQuota: string;
    /** My Account 页面：免费试用剩余时间 */
    freeEnds: string;
    /** My Account 页面：已订阅用户的剩余时长（与试用期文案区分） */
    freeEndsPaid: string;
    /** 倒计时单位：天 */
    durationDays: string;
    /** 倒计时单位：小时 */
    durationHours: string;
    /** 倒计时单位：分 */
    durationMinutes: string;
    /** 倒计时单位：秒 */
    durationSeconds: string;
    /** My Account 页面：About Points 标题 */
    aboutPoints: string;
    /** My Account 页面：About Points 说明 */
    aboutPointsDesc: string;
    /** My Account 页面：权益列表分隔条 */
    benefitsInclude: string;
    /** My Account 页面：订阅按钮 */
    subscribe: string;
    /** My Account 页面：权益列表 5 条 */
    benefitFreePicks: string;
    benefitFreeQuota: string;
    benefitMonth1: string;
    benefitMonth3: string;
    benefitMonth12: string;
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
    closeDialog: string;
    close: string;
    optimal: string;
    lpStability: string;
    trade: string;
    select: string;
    transactionFailed: string;
    insufficientBalance: string;
    transactionSubmitted: string;
    switchNetwork: string;
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
    downloading: string;
    trading: string;
    update: string;
    token: string;
    tokenDesc: string;
    inputPlaceholder?: string;
    startAnalysis?: string;
  };
  guard: {
    addWatch: string;
    watchList: string;
    dailyReport: string;
    /** 日报 tab 右侧：报告日期标签 */
    dailyReportDate: string;
    addWatchDesc: string;
    watchListDesc: string;
    dailyReportDesc: string;
    searchPlaceholder: string;
    name: string;
    price: string;
    follow: string;
    addMore: string;
    /** 关注 tab：打开消息历史（options 页）的链接 */
    messageHistory: string;
    liquidity: string;
    explorer: string;
    waitingResponse: string;
    stop: string;
    copy: string;
    regenerate: string;
    streamFailed: string;
    pushPromptTitle: string;
    pushPromptDesc: string;
    pushPromptEnable: string;
    pushPromptLater: string;
    pushPromptWebOptInHint: string;
    pushPromptUnavailable: string;
    pushPromptEnabled: string;
    pushPromptDenied: string;
    entitlementNew: string;
    entitlementTrial: string;
    entitlementPaid: string;
    entitlementTrialExpired: string;
    entitlementPaidExpired: string;
    entitlementExpiresAt: string;
    entitlementRemaining: string;
    watchlistQuota: string;
    muteEnable: string;
    muteDisable: string;
    muteUntil: string;
    analysisDisabled: string;
    trialExpiredToast: string;
    paidExpiredToast: string;
    cexLiquidity: string;
    dexLiquidity: string;
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
    oneTime: string;
    monthly: string;
  };
  myPoints: {
    rechargePoints: string;
    paymentMethod: string;
    recharge: string;
    pointsRecord: string;
    points: string;
    waitingConfirmation: string;
    /** 钱包重连流程（锁定/断开后点击充值时触发） */
    walletReconnecting: string;
    walletReconnected: string;
    reconnectCancelled: string;
    reconnectFailed: string;
    stripe: {
      cardLabel: string;
      notAvailable: string;
      invalidPackage: string;
      upstreamError: string;
      pendingLimit: string;
      resumingPayment: string;
      tooManyRequests: string;
      /** 扩展特有：background 与 window.open 两条开标签路径均失败时提示 */
      popupBlocked: string;
    };
  };
  stripeResult: {
    confirming: string;
    confirmingDesc: string;
    success: string;
    /** 含 {{points}} / {{llax}} 占位符，组件内手动插值 */
    successDesc: string;
    cancelled: string;
    cancelledDesc: string;
    timeout: string;
    timeoutDesc: string;
    notFound: string;
    notFoundDesc: string;
    backToPoints: string;
    retry: string;
    refresh: string;
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
    token: {
      title: string;
      description: string;
    };
    account: {
      title: string;
      description: string;
    };
  };
  claim: {
    title: string;
    claimButton: string;
    claiming: string;
    claimSuccess: string;
    claimFailed: string;
    stepCheckBalance: string;
    stepFetchNonce: string;
    stepSignMessage: string;
    stepSubmitClaim: string;
    stepSwitchChain: string;
    stepExecuteContract: string;
    stepWaitReceipt: string;
    stepConfirmClaim: string;
    stepSuccess: string;
    historyTitle: string;
    historyEmpty: string;
    statusPending: string;
    statusConfirmed: string;
    statusFailed: string;
    walletRequired: string;
    viewOnBscScan: string;
    frozenAmount: string;
    frozenTip: string;
  };
}
