import { useCallback, useEffect, useState } from 'react';
import { formatMessageDate, type GuardMessage } from './api';
import { useAuth, useMessageList } from './useMessageList';
import { useMessageLocale } from './useMessageLocale';
import type { DetailErrorKind, MessageTexts } from './i18n';

/** 列表滚动触发加载的阈值（距底部像素） */
const SCROLL_THRESHOLD = 120;

/** 消息正文：后端已渲染好全文，排版符号与缩进都有语义，必须 pre-wrap + 左对齐 */
const MessageContent = ({ content }: { content: string }) => (
  <pre className="whitespace-pre-wrap break-words text-left font-sans text-[13px] leading-6 text-black">{content}</pre>
);

/** 列表项：标题 + 日期 + 币种数 + 正文首行摘要 */
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
  const summary =
    message.content
      .split('\n')
      .map(line => line.trim())
      .find(line => line.length > 0) ?? '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl px-3.5 py-3 text-left transition-colors ${
        active ? 'bg-black text-white' : 'bg-white hover:bg-black/[0.03]'
      }`}>
      <div className={`text-[12px] font-semibold ${active ? 'text-white' : 'text-black'}`}>{message.title}</div>
      <div className={`mt-1 flex items-center gap-2 text-[11px] ${active ? 'text-white/60' : 'text-black/40'}`}>
        <span className="tabular-nums">{formatMessageDate(message.created_at)}</span>
        <span>·</span>
        <span>{t.tokenCount(message.token_count)}</span>
      </div>
      {summary && (
        <div className={`mt-1 truncate text-[11px] ${active ? 'text-white/50' : 'text-black/35'}`}>{summary}</div>
      )}
    </button>
  );
};

/** 详情视图：展示单条消息全文 */
const MessageDetail = ({
  message,
  loading,
  errorKind,
  onBack,
  t,
}: {
  message: GuardMessage | null;
  loading: boolean;
  /** 错误标识，由 t 翻译成当前语言文案 */
  errorKind?: DetailErrorKind;
  onBack: () => void;
  t: MessageTexts;
}) => (
  <div className="space-y-3">
    <button
      type="button"
      onClick={onBack}
      className="text-[12px] text-black/45 transition-colors hover:text-black">
      {t.backToList}
    </button>

    {loading && (
      <div className="flex items-center justify-center rounded-xl bg-white py-16 text-[12px] text-black/35">
        {t.loading}
      </div>
    )}

    {!loading && errorKind && (
      <div className="rounded-xl bg-[#FFFCE0] px-3.5 py-2.5 text-[12px] text-[#8A7A00]">{t[errorKind]}</div>
    )}

    {!loading && !errorKind && message && (
      <article className="rounded-xl bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <header className="mb-3 border-b border-black/[0.06] pb-3">
          <h2 className="text-[13px] font-semibold text-black">{message.title}</h2>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-black/40">
            <span className="tabular-nums">{formatMessageDate(message.created_at)}</span>
            <span>·</span>
            <span>{t.tokenCount(message.token_count)}</span>
          </div>
        </header>
        <MessageContent content={message.content} />
      </article>
    )}

    {!loading && !errorKind && !message && (
      <div className="rounded-xl bg-white py-16 text-center text-[12px] text-black/35">{t.notFound}</div>
    )}
  </div>
);

interface MessageCenterProps {
  /** 从通知跳转时带入的消息 id；有值时直接进入详情视图 */
  initialMessageId?: number;
}

export const MessageCenter = ({ initialMessageId }: MessageCenterProps) => {
  const { auth, ready } = useAuth();
  const { t } = useMessageLocale();
  const [detailId, setDetailId] = useState<number | null>(initialMessageId ?? null);
  const [detailMessage, setDetailMessage] = useState<GuardMessage | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErrorKind, setDetailErrorKind] = useState<DetailErrorKind | undefined>(undefined);

  // 始终拉全部消息（不展示已读/未读状态）；从通知跳转时首屏拉到上限，保证目标消息在范围内
  const list = useMessageList(auth, 'all', initialMessageId ? 100 : undefined);

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
    // 页面级滚动：以整页文档为滚动容器
    const distanceToBottom = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
    if (distanceToBottom < SCROLL_THRESHOLD) void list.loadMore();
  }, [list]);

  // 页面级滚动：监听 window 而非内部容器；详情视图不需要
  useEffect(() => {
    if (detailId !== null) return;
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll, detailId]);

  const handleBack = () => {
    setDetailId(null);
    window.scrollTo({ top: 0 });
    // 清掉 URL 参数，刷新后不再回到详情
    window.history.replaceState(null, '', window.location.pathname);
  };

  const detailView = detailId !== null;

  return (
    <div className="mx-auto w-full max-w-[800px] px-4 py-6">
      <header className="mb-4 flex justify-center">
        <img src={chrome.runtime.getURL('options/botRound.svg')} className="h-9 w-9" alt="logo" />
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
        <>
          <div className="mb-3 text-center text-[12px] font-medium text-black/45">{t.allMessages}</div>

          {list.error && (
            <div className="mb-3 rounded-xl bg-[#FFFCE0] px-3.5 py-2.5 text-[12px] text-[#8A7A00]">{t[list.error]}</div>
          )}

          <div className="space-y-1.5">
            {!ready || list.loading ? (
              <div className="rounded-xl bg-white py-16 text-center text-[12px] text-black/35">{t.loading}</div>
            ) : list.items.length === 0 ? (
              <div className="rounded-xl bg-white py-16 text-center text-[12px] text-black/35">{t.empty}</div>
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
                {list.loadingMore && (
                  <div className="py-4 text-center text-[11px] text-black/30">{t.loading}</div>
                )}
                {!list.hasMore && list.items.length > 0 && (
                  <div className="py-4 text-center text-[11px] text-black/25">{t.noMore}</div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default MessageCenter;
