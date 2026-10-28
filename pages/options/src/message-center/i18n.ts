/**
 * 消息中心文案（5 语言）。
 *
 * options 页不引入 content-ui 的 React Context i18n，而是直接读
 * chrome.storage.local 里的项目语言（与侧边栏共用同一个 key），
 * 因此用户在侧边栏切换语言后，这里打开即是新语言。
 */

export type MessageLocale = 'zh' | 'en' | 'ja' | 'ko' | 'ru';

/** 与 pages/content-ui/src/lib/storageKeys.ts 的 LOCALE_KEY 保持一致 */
export const LOCALE_STORAGE_KEY = '@Linklayerai/content-ui-locale';

export interface MessageTexts {
  allMessages: string;
  loading: string;
  empty: string;
  noMore: string;
  backToList: string;
  tokenCount: (n: number) => string;
  notFound: string;
  loadFailed: string;
  notLoggedIn: string;
  sessionExpired: string;
  /** 详情页头部：Agent 在线状态 */
  agentOnline: string;
  /** 列表页头部副标题 */
  fromAgents: string;
  /** 详情页头部返回按钮（短） */
  backShort: string;
  /** 滚动到底部区域后出现的返回顶部按钮（无障碍标签，视觉上只有图标） */
  backToTop: string;
  /** 免责声明（render.ts 文案，详情页底部展示） */
  disclaimer: string;
  /**
   * 浏览器标签页标题。countText 为格式化后的消息总数（如「1.1K」），
   * 总数未知/为 0 时传 undefined，标题里省略括号部分。
   */
  pageTitle: (countText?: string) => string;
  /** 详情视图的标签页标题：messageTitle 为消息自身的标题 */
  detailPageTitle: (messageTitle: string) => string;
  /** <meta name="description"> 内容 */
  pageDescription: string;
}

/** 详情视图可能出现的错误：notFound（列表里找不到）/ sessionExpired / loadFailed */
export type DetailErrorKind = 'notFound' | 'sessionExpired' | 'loadFailed';

const TEXTS: Record<MessageLocale, MessageTexts> = {
  zh: {
    allMessages: '全部消息',
    loading: '加载中…',
    empty: '暂无消息',
    noMore: '没有更多了',
    backToList: '← 返回全部消息',
    tokenCount: n => `${n} 个币种`,
    notFound: '消息不存在或不在当前加载范围内',
    loadFailed: '消息加载失败',
    notLoggedIn: '未检测到登录态，请先在侧边栏连接钱包并登录',
    sessionExpired: '登录已过期，请重新登录',
    agentOnline: '在线 · 你的 AI 交易助手',
    fromAgents: '来自你的 LinkLayerAI Agents',
    backShort: '← 返回列表',
    backToTop: '返回顶部',
    disclaimer: '本产品仅提供链上与市场数据信号，不构成任何投资建议。',
    pageTitle: count => `${count ? `全部消息 (${count})` : '全部消息'} · LinkLayerAI`,
    detailPageTitle: messageTitle => `${messageTitle} · LinkLayerAI`,
    pageDescription: '来自你的 LinkLayerAI Agents 的风险提醒与流动性消息，随时在这里查看全部历史。',
  },
  en: {
    allMessages: 'All messages',
    loading: 'Loading…',
    empty: 'No messages',
    noMore: 'No more messages',
    backToList: '← Back to all messages',
    tokenCount: n => `${n} token${n === 1 ? '' : 's'}`,
    notFound: 'Message not found or outside the loaded range',
    loadFailed: 'Failed to load messages',
    notLoggedIn: 'Not signed in. Please connect your wallet in the side panel first.',
    sessionExpired: 'Session expired, please sign in again',
    agentOnline: 'Online · your AI trading assistant',
    fromAgents: 'From your LinkLayerAI Agents',
    backShort: '← Back',
    backToTop: 'Back to top',
    disclaimer: 'This product provides data signals only and is not investment advice.',
    pageTitle: count => `${count ? `All messages (${count})` : 'All messages'} · LinkLayerAI`,
    detailPageTitle: messageTitle => `${messageTitle} · LinkLayerAI`,
    pageDescription:
      'Risk alerts and liquidity messages from your LinkLayerAI Agents — browse the full history anytime.',
  },
  ja: {
    allMessages: 'すべてのメッセージ',
    loading: '読み込み中…',
    empty: 'メッセージはありません',
    noMore: 'これ以上ありません',
    backToList: '← すべてのメッセージに戻る',
    tokenCount: n => `${n} 銘柄`,
    notFound: 'メッセージが見つからないか、読み込み範囲外です',
    loadFailed: 'メッセージの読み込みに失敗しました',
    notLoggedIn: 'ログインしていません。先にサイドパネルでウォレットを接続してください。',
    sessionExpired: 'セッションの有効期限が切れました。再度ログインしてください',
    agentOnline: 'オンライン · あなたの AI トレーディングアシスタント',
    fromAgents: 'あなたの LinkLayerAI Agents から',
    backShort: '← 一覧へ',
    backToTop: 'トップへ戻る',
    disclaimer: '本製品はデータシグナルのみを提供し、投資アドバイスではありません。',
    pageTitle: count => `${count ? `すべてのメッセージ (${count})` : 'すべてのメッセージ'} · LinkLayerAI`,
    detailPageTitle: messageTitle => `${messageTitle} · LinkLayerAI`,
    pageDescription: 'LinkLayerAI Agents からのリスク通知と流動性メッセージ。すべての履歴をいつでも確認できます。',
  },
  ko: {
    allMessages: '전체 메시지',
    loading: '불러오는 중…',
    empty: '메시지가 없습니다',
    noMore: '더 이상 없습니다',
    backToList: '← 전체 메시지로 돌아가기',
    tokenCount: n => `${n}개 코인`,
    notFound: '메시지를 찾을 수 없거나 로드된 범위를 벗어났습니다',
    loadFailed: '메시지를 불러오지 못했습니다',
    notLoggedIn: '로그인되어 있지 않습니다. 먼저 사이드 패널에서 지갑을 연결하세요.',
    sessionExpired: '세션이 만료되었습니다. 다시 로그인하세요',
    agentOnline: '온라인 · 나의 AI 트레이딩 어시스턴트',
    fromAgents: '나의 LinkLayerAI Agents 에서',
    backShort: '← 목록',
    backToTop: '맨 위로',
    disclaimer: '본 제품은 데이터 신호만 제공하며 투자 자문이 아닙니다.',
    pageTitle: count => `${count ? `전체 메시지 (${count})` : '전체 메시지'} · LinkLayerAI`,
    detailPageTitle: messageTitle => `${messageTitle} · LinkLayerAI`,
    pageDescription: 'LinkLayerAI Agents 가 보낸 리스크 알림과 유동성 메시지입니다. 전체 기록을 언제든 확인하세요.',
  },
  ru: {
    allMessages: 'Все сообщения',
    loading: 'Загрузка…',
    empty: 'Нет сообщений',
    noMore: 'Больше нет',
    backToList: '← Назад ко всем сообщениям',
    tokenCount: n => `${n} монет`,
    notFound: 'Сообщение не найдено или вне загруженного диапазона',
    loadFailed: 'Не удалось загрузить сообщения',
    notLoggedIn: 'Вы не вошли. Сначала подключите кошелёк в боковой панели.',
    sessionExpired: 'Сессия истекла, войдите снова',
    agentOnline: 'В сети · ваш AI-торговый помощник',
    fromAgents: 'От ваших LinkLayerAI Agents',
    backShort: '← Назад',
    backToTop: 'Наверх',
    disclaimer: 'Этот продукт предоставляет только сигналы данных и не является инвестиционной рекомендацией.',
    pageTitle: count => `${count ? `Все сообщения (${count})` : 'Все сообщения'} · LinkLayerAI`,
    detailPageTitle: messageTitle => `${messageTitle} · LinkLayerAI`,
    pageDescription:
      'Оповещения о рисках и сообщения о ликвидности от ваших LinkLayerAI Agents. Вся история всегда доступна.',
  },
};

const SUPPORTED = new Set<string>(['zh', 'en', 'ja', 'ko', 'ru']);

/** 浏览器语言 → 支持的 locale，不支持回退 en（与 content-ui defaultLocale 一致） */
export const detectBrowserLocale = (): MessageLocale => {
  const lang = (navigator.language || 'en').split('-')[0].toLowerCase();
  return SUPPORTED.has(lang) ? (lang as MessageLocale) : 'en';
};

export const getTexts = (locale: MessageLocale): MessageTexts => TEXTS[locale] ?? TEXTS.en;

export const isSupportedLocale = (value: unknown): value is MessageLocale =>
  typeof value === 'string' && SUPPORTED.has(value);
