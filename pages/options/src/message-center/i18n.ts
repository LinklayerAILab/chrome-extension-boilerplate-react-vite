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
