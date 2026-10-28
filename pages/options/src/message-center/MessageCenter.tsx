import { useCallback, useEffect, useState } from 'react';
import { formatMessageDate, type GuardMessage } from './api';
import { formatCompactNumber } from './formatCompactNumber';
import { buildRowSummary, parseMessageContent, type ParsedCoin } from './parseMessage';
import { useAuth, useMessageList } from './useMessageList';
import { useMessageLocale } from './useMessageLocale';
import { useDocumentMeta } from './useDocumentMeta';
import type { DetailErrorKind, MessageTexts } from './i18n';

/** 列表滚动触发加载的阈值（距底部像素） */
const SCROLL_THRESHOLD = 160;

/** 返回顶部按钮出现的滚动阈值：超过一屏才显示，避免短列表下干扰视线 */
const BACK_TO_TOP_THRESHOLD = 400;

/** 风险色调 → 左边条与文字色（取自 01-welcome.html 的设计 token） */
const TONE_COLORS: Record<ParsedCoin['tone'], { bar: string; text: string; dot: string }> = {
  yellow: { bar: '#E6C200', text: '#B89A00', dot: '#E6C200' },
  red: { bar: '#E5484D', text: '#E5484D', dot: '#E5484D' },
  green: { bar: '#2EC94C', text: '#2E9E45', dot: '#2EC94C' },
  unknown: { bar: '#B0B0A8', text: '#8A8A82', dot: '#B0B0A8' },
};

/** 品牌 logo：设计稿用 assets/logo.svg，与 botRound 为同一枚 */
const LOGO_URL = () => chrome.runtime.getURL('options/botRound.svg');

// ============ 列表项 ============

const MessageRow = ({
  message,
  active,
  onClick,
  t,
}: {
  message: GuardMessage;
  active: boolean;
  onClick: () => void;
  t: MessageTexts;
}) => {
  const summary = buildRowSummary(message.content);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3.5 border-b border-[#f2f2ec] px-6 py-4 text-left transition-colors last:border-b-0 ${
        active ? 'bg-[#FAFAF5]' : 'hover:bg-[#FAFAF5]'
      }`}>
      {/* 圆形头像位：设计稿是 🚨 emoji + 浅灰底 */}
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#F2F2EA] text-[20px]">
        🚨
      </span>

      <span className="min-w-0 flex-1">
        <span className="mb-1 flex items-baseline gap-2.5">
          <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-[#0F0F0F]">{message.title}</span>
          <span className="shrink-0 text-[11.5px] text-[#B0B0A8]">
            {formatMessageDate(message.created_at).slice(-5)}
          </span>
        </span>
        <span className="block truncate text-[12.5px] leading-relaxed text-[#9A9A9A]">
          {message.token_count > 0 && `${t.tokenCount(message.token_count)} · `}
          {summary}
        </span>
      </span>
    </button>
  );
};

// ============ 详情页 ============

/** 币种风险卡：左边条按风险等级着色 */
const CoinCard = ({ coin }: { coin: ParsedCoin }) => {
  const tone = TONE_COLORS[coin.tone];
  return (
    <div className="mb-3.5 rounded-[14px] bg-[#FAFAF7] px-5 py-[18px]" style={{ borderLeft: `4px solid ${tone.bar}` }}>
      <div className="mb-3 flex items-center justify-center gap-2">
        <span className="size-2.5 rounded-full" style={{ background: tone.dot }} />
        <span className="text-[15px] font-extrabold text-[#0F0F0F]">{coin.symbol}</span>
        {coin.level && (
          <span className="text-[12px] font-bold" style={{ color: tone.text }}>
            · {coin.level}
          </span>
        )}
      </div>

      {coin.sync && <p className="mb-2.5 text-center text-[12.5px] text-[#C26A00]">{coin.sync}</p>}
      {coin.change && <p className="mb-2.5 text-center text-[12px] text-[#8A8A8A]">{coin.change}</p>}

      <ul className="space-y-2">
        {coin.reasons.map((reason, index) => (
          <li key={index} className="text-center text-[13px] leading-normal text-[#444444]">
            <span className="font-semibold text-[#0F0F0F]">{reason.text}</span>
            {reason.detail && <span className="mt-0.5 block text-[12px] text-[#8A8A8A]">{reason.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

/** 推送正文气泡：头部图标 + 标题 + meta + 分割线 + 摘要 + 币种卡 + 免责 */
const MessageBubble = ({ message, t }: { message: GuardMessage; t: MessageTexts }) => {
  const parsed = parseMessageContent(message.content);

  return (
    <div className="flex items-start gap-3">
      <img src={LOGO_URL()} className="size-9 shrink-0 rounded-[10px]" alt="" />
      <div className="min-w-0 flex-1 rounded-bl-[18px] rounded-br-[18px] rounded-tl-[4px] rounded-tr-[18px] border border-[#ECECE5] bg-white px-6 py-[22px] shadow-[0_1px_3px_rgba(15,15,15,0.04)]">
        <div className="mb-1.5 text-center">
          <div className="mb-3 inline-flex size-[46px] items-center justify-center rounded-[14px] bg-[#CCFF00] text-[22px]">
            🚨
          </div>
          <h1 className="mb-2 text-[18px] font-extrabold text-[#0F0F0F]">{message.title}</h1>
          <p className="text-[12px] text-[#A3A3A3]">
            {formatMessageDate(message.created_at)}
            {message.token_count > 0 && ` · ${t.tokenCount(message.token_count)}`}
          </p>
        </div>

        <hr className="my-[18px] border-t border-[#F0F0EA]" />

        {parsed.coins.length === 0 ? (
          // 解析不出币种块：原样展示，保留后端排版
          <pre className="whitespace-pre-wrap break-words text-left font-sans text-[13px] leading-6 text-[#444444]">
            {parsed.rawFallback ?? message.content}
          </pre>
        ) : (
          <>
            {parsed.summary && (
              <p className="mb-5 text-center text-[14px] font-semibold text-[#0F0F0F]">{parsed.summary}</p>
            )}
            {parsed.coins.map((coin, index) => (
              <CoinCard key={`${coin.symbol}-${index}`} coin={coin} />
            ))}
          </>
        )}
      </div>
    </div>
  );
};

const MessageDetail = ({
  message,
  loading,
  errorKind,
  onBack,
  t,
}: {
  message: GuardMessage | null;
  loading: boolean;
  errorKind?: DetailErrorKind;
  onBack: () => void;
  t: MessageTexts;
}) => (
  <div className="flex flex-1 flex-col">
    {loading && (
      <div className="flex flex-1 items-center justify-center py-24 text-[13px] text-[#B0B0A8]">{t.loading}</div>
    )}

    {!loading && errorKind && (
      <div className="m-6 rounded-xl bg-[#FFFCE0] px-4 py-3 text-[13px] text-[#8A7A00]">{t[errorKind]}</div>
    )}

    {!loading && !errorKind && message && (
      <>
        <div className="flex-1 bg-[#FAFAF7] px-6 pb-5 pt-7">
          <MessageBubble message={message} t={t} />
        </div>
        <div className="bg-[#FAFAF7] px-6 pb-6">
          <p className="pl-12 text-[11px] leading-relaxed text-[#B0B0A8]">ℹ️ {t.disclaimer}</p>
        </div>
      </>
    )}

    {!loading && !errorKind && !message && (
      <div className="flex flex-1 items-center justify-center py-24 text-[13px] text-[#B0B0A8]">{t.notFound}</div>
    )}

    <div className="border-t border-[#EFEFE9] bg-white px-6 py-3.5">
      <button
        type="button"
        onClick={onBack}
        className="w-full rounded-full border border-[#E6E6E0] py-2.5 text-[13px] text-[#8A8A8A] transition-colors hover:border-[#CCFF00] hover:bg-[#CCFF00] hover:text-[#0F0F0F]">
        {t.backToList}
      </button>
    </div>
  </div>
);

// ============ 列表容器 ============

interface MessageCenterProps {
  /** 从通知跳转时带入的消息 id；有值时直接进入详情视图 */
  initialMessageId?: number;
}

export const MessageCenter = ({ initialMessageId }: MessageCenterProps) => {
  const { auth, ready } = useAuth();
  const { t, locale } = useMessageLocale();
  const [detailId, setDetailId] = useState<number | null>(initialMessageId ?? null);
  const [detailMessage, setDetailMessage] = useState<GuardMessage | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErrorKind, setDetailErrorKind] = useState<DetailErrorKind | undefined>(undefined);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // 始终拉全部消息（不展示已读/未读状态）；从通知跳转时首屏拉到上限，保证目标消息在范围内
  const list = useMessageList(auth, 'all', initialMessageId ? 100 : undefined);

  // 标签页标题 / meta description：列表视图显示总数，详情视图显示该条消息标题
  useDocumentMeta({
    t,
    count: list.total,
    totalText: formatCompactNumber(list.total, locale),
    detailTitle: detailId !== null ? (detailMessage?.title ?? null) : null,
  });

  // 详情视图：优先从已加载列表里找；列表还没到位时保持 loading
  useEffect(() => {
    if (detailId === null) {
      setDetailMessage(null);
      setDetailErrorKind(undefined);
      setDetailLoading(false);
      return;
    }

    if (list.loading) {
      setDetailLoading(true);
      return;
    }

    const cached = list.items.find(item => item.id === detailId);
    setDetailMessage(cached ?? null);
    setDetailLoading(false);
    setDetailErrorKind(cached ? undefined : 'notFound');
  }, [detailId, list.items, list.loading]);

  const handleScroll = useCallback(() => {
    if (list.loadingMore || !list.hasMore) return;
    const distanceToBottom = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
    if (distanceToBottom < SCROLL_THRESHOLD) void list.loadMore();
  }, [list]);

  useEffect(() => {
    if (detailId !== null) return;
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll, detailId]);

  // 返回顶部按钮：滚动超过一屏后出现。与上面的无限加载滚动监听分开，
  // 因为它需要在详情视图下同样生效，而加载更多只在列表视图有意义。
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > BACK_TO_TOP_THRESHOLD);
    onScroll(); // 详情视图跳转回来时可能已处于滚动位置，先同步一次
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    // behavior: smooth 在部分系统「减少动态效果」设置下会被浏览器降级为瞬时跳转，属预期
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleBack = () => {
    setDetailId(null);
    // 与返回顶部按钮保持一致，用平滑滚动而非瞬时跳转
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.history.replaceState(null, '', window.location.pathname);
  };

  const detailView = detailId !== null;

  return (
    <div className="mx-auto w-full max-w-[720px] px-6 py-12">
      {/* 外框：设计稿的圆角卡片 */}
      {/*
        overflow-clip 而非 overflow-hidden：两者视觉上都能裁切圆角，
        但 overflow-hidden 会创建滚动容器，使内部的 sticky 头部失效。
        clip 不创建滚动容器，sticky 才能相对 window 生效。
      */}
      <div className="flex min-h-[calc(100vh-96px)] flex-col overflow-clip rounded-3xl border border-[#E6E6E0] bg-white shadow-[0_8px_40px_rgba(15,15,15,0.08)]">
        {/* 头部：滚动时粘在视口顶部（需祖先无 overflow 隐藏滚动容器） */}
        <header className="sticky top-0 z-10 flex items-center gap-3.5 rounded-t-3xl border-b border-[#EFEFE9] bg-white px-[24px] py-[18px]">
          <img src={LOGO_URL()} className="size-11 shrink-0 rounded-xl" alt="LinkLayerAI" />
          <div className="min-w-0 flex-1">
            {detailView ? (
              <>
                <p className="text-[16px] font-extrabold text-[#0F0F0F]">LinkLayerAI Agent</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#8A8A8A]">
                  <span className="size-[7px] rounded-full bg-[#9ED400]" />
                  {t.agentOnline}
                </p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2.5 text-[16px] font-extrabold text-[#0F0F0F]">
                  {t.allMessages}
                  {list.total > 0 && (
                    <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#CCFF00] px-[7px] text-[12px] font-extrabold text-[#0F0F0F]">
                      {formatCompactNumber(list.total, locale)}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[12px] text-[#8A8A8A]">{t.fromAgents}</p>
              </>
            )}
          </div>
          {detailView && (
            <button
              type="button"
              onClick={handleBack}
              className="shrink-0 rounded-full border border-[#E6E6E0] px-4 py-[7px] text-[13px] text-[#8A8A8A] transition-colors hover:border-[#CCFF00] hover:bg-[#CCFF00] hover:text-[#0F0F0F]">
              {t.backShort}
            </button>
          )}
        </header>

        {detailView ? (
          <MessageDetail
            message={detailMessage}
            loading={detailLoading}
            errorKind={detailErrorKind}
            onBack={handleBack}
            t={t}
          />
        ) : (
          <div className="flex flex-1 flex-col">
            {list.error && (
              <div className="m-6 rounded-xl bg-[#FFFCE0] px-4 py-3 text-[13px] text-[#8A7A00]">{t[list.error]}</div>
            )}

            {!ready || list.loading ? (
              <div className="flex flex-1 items-center justify-center py-24 text-[13px] text-[#B0B0A8]">
                {t.loading}
              </div>
            ) : list.items.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-24 text-[13px] text-[#B0B0A8]">{t.empty}</div>
            ) : (
              <>
                {list.items.map(message => (
                  <MessageRow
                    key={message.id}
                    message={message}
                    active={message.id === detailId}
                    onClick={() => setDetailId(message.id)}
                    t={t}
                  />
                ))}
                <div className="py-5 text-center text-[11.5px] text-[#B0B0A8]">
                  {list.loadingMore ? t.loading : !list.hasMore ? t.noMore : ''}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/*
        返回顶部：固定在视口右下角。
        始终挂载、用 opacity/transform 切换显隐 —— 条件渲染会在卸载瞬间消失，
        无法播放离场动画。隐藏时 pointer-events-none + tabIndex=-1 + aria-hidden，
        保证既不可点击也不进入键盘焦点顺序。
        项目无图标库，直接内联 SVG 箭头，避免为单个图标引入依赖。
      */}
      <button
        type="button"
        onClick={scrollToTop}
        aria-label={t.backToTop}
        title={t.backToTop}
        aria-hidden={!showBackToTop}
        tabIndex={showBackToTop ? 0 : -1}
        className={`fixed bottom-8 right-8 z-20 flex size-11 items-center justify-center rounded-full bg-[#cf0] text-[#0F0F0F] shadow-[0_4px_16px_rgba(15,15,15,0.12)] transition-all duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9ED400] ${
          showBackToTop
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-3 scale-90 opacity-0'
        }`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 19V5M12 5L5 12M12 5L19 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
};

export default MessageCenter;
