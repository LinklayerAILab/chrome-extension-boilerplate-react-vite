import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import * as htmlToImage from 'html-to-image';
import html2canvas from 'html2canvas';
import { message } from '@src/ui';
import { useI18n } from '@src/lib/i18n';
import Dialog from './Dialog';

const bigLogo = chrome.runtime.getURL('content-ui/agent/biglogo.svg');
const llLogo = chrome.runtime.getURL('content-ui/agent/ll.svg');
const llIcon = chrome.runtime.getURL('content-ui/agent/llicon.svg');
const closeIcon = chrome.runtime.getURL('content-ui/agent/off.svg');
const qrCode = chrome.runtime.getURL('content-ui/agent/code.jpg');

// 打字机参数（移植自 bodyguard-app AgentStream）
const TYPE_INTERVAL_MS = 20; // 每帧间隔（~50 帧/秒）
const CHARS_PER_TICK = 1; // 基础每帧字数
const SPEEDUP_THRESHOLD = 50; // 缓冲超过此值时加速
const CHARS_PER_TICK_FAST = 3; // 加速时每帧字数

/** 下载用的图片白名单：data: / 扩展资源 / 同源图片，避免 canvas 污染 */
const isSafeImageSrc = (src?: string | null): boolean => {
  if (!src) return true;
  if (src.startsWith('data:') || src.startsWith('chrome-extension://')) return true;
  try {
    return new URL(src, window.location.href).origin === window.location.origin;
  } catch {
    return true;
  }
};

/**
 * 打字机渲染拆分：\n\n 之前的完整块交给 Markdown（输入不变则解析输出不变，
 * 历史内容零重排）；之后的未完成块用纯文本逐字打，避免 **bold**、表格行等
 * 行内记号在闭合瞬间整块翻转造成布局抖动
 */
function splitStableMarkdown(text: string): { stable: string; partial: string } {
  const idx = text.lastIndexOf('\n\n');
  if (idx === -1) return { stable: '', partial: text };
  return { stable: text.slice(0, idx + 2), partial: text.slice(idx + 2) };
}

interface ReportStreamProps {
  /** 流工厂：每次生成时传入新的 AbortSignal */
  createStream: (signal: AbortSignal) => AsyncGenerator<string>;
  /** 流异常回调（AbortError 除外）；缺省时用 message 兜底提示 */
  onError?: (errorMessage: string, code?: number) => void;
  /** 内容区最大高度类（tailwind），默认 h-[68vh] */
  contentClassName?: string;
  /** 根容器附加类（需要在父级 flex 中撑满高度时传 h-full min-h-0） */
  className?: string;
  /** 内容区额外内联样式（如按场景微调字号） */
  contentStyle?: CSSProperties;
}

/**
 * SSE 流式内容打字机渲染器（移植自 bodyguard-app AgentStream，去除 TG/订阅/下载图片逻辑）：
 * chunk 先入缓冲，定时器逐字弹出；完整段落 Markdown 渲染、未闭合部分纯文本打字 + 光标闪烁；
 * 自动滚动跟随（用户上滚则交还控制）；操作按钮 Stop / Copy。
 */
export const ReportStream = memo(
  ({ createStream, onError, contentClassName, className, contentStyle }: ReportStreamProps) => {
    const { t } = useI18n();
    const tAny = t as unknown as Record<string, any>;

    // displayedText: 已渲染给用户看的文字（逐字增长）
    const [displayedText, setDisplayedText] = useState('');
    // isStreaming: SSE 流是否活跃；isTyping: 打字机是否活跃（流式 + 缓冲刷新）
    const [isStreaming, setIsStreaming] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    /** 下载预览弹窗（参考 ll-agent：点下载图标先开预览，再截图下载） */
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // bufferRef: 已收到但尚未渲染的缓冲文字（ref 避免 re-render）
    const bufferRef = useRef('');
    const abortRef = useRef<AbortController | null>(null);
    const isStreamingRef = useRef(false);
    const createStreamRef = useRef(createStream);
    createStreamRef.current = createStream;

    // auto-scroll：默认跟随打字机滚到底；用户手动上滚则交还控制；滚回底部则恢复跟随
    const containerRef = useRef<HTMLDivElement>(null);
    const stickToBottomRef = useRef(true);
    /** 预览弹窗内的截图节点（对应参考实现的 #download-ele） */
    const downloadRef = useRef<HTMLDivElement>(null);

    const handleScroll = useCallback(() => {
      const el = containerRef.current;
      if (!el) return;
      stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    }, []);

    // useLayoutEffect：在 paint 前滚到底，避免流式期间每帧视觉抖动
    useLayoutEffect(() => {
      const el = containerRef.current;
      if (el && stickToBottomRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    }, [displayedText]);

    const start = useCallback(async () => {
      // 先中止上一个流，避免两个流同时往 bufferRef 写入导致内容重复
      abortRef.current?.abort();
      setDisplayedText('');
      bufferRef.current = '';
      stickToBottomRef.current = true;
      setIsStreaming(true);
      setIsTyping(true);
      isStreamingRef.current = true;
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        for await (const chunk of createStreamRef.current(ac.signal)) {
          if (ac.signal.aborted || abortRef.current !== ac) break;
          bufferRef.current += chunk;
        }
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          const errorMessage = e instanceof Error ? e.message : tAny?.guard?.streamFailed || 'Stream failed';
          const code = (e as { code?: unknown } | null)?.code;
          if (onError) {
            onError(errorMessage, typeof code === 'number' ? code : undefined);
          } else {
            message.error(errorMessage);
          }
        }
      } finally {
        // 只有当前流是最新流时才修改共享状态，防止旧流的 finally 覆盖新流
        if (abortRef.current !== ac) return;
        setIsStreaming(false);
        isStreamingRef.current = false;
        abortRef.current = null;
      }
    }, [onError, tAny]);

    // 挂载时自动发起流（空依赖：语言切换不重启流）
    const startRef = useRef(start);
    startRef.current = start;
    useEffect(() => {
      startRef.current();
      return () => {
        abortRef.current?.abort();
      };
    }, []);

    // 打字机定时器：从缓冲逐字弹出到 displayedText
    useEffect(() => {
      if (!isTyping) return;

      const interval = setInterval(() => {
        const buf = bufferRef.current;
        if (buf.length === 0) {
          if (!isStreamingRef.current) {
            // 流已结束 + 缓冲空 → 打字机停
            setIsTyping(false);
            clearInterval(interval);
          }
          return;
        }

        // 自适应速度：缓冲过长时加速，避免落后太多
        const n = buf.length > SPEEDUP_THRESHOLD ? CHARS_PER_TICK_FAST : CHARS_PER_TICK;
        bufferRef.current = buf.slice(n);
        setDisplayedText(prev => prev + buf.slice(0, n));
      }, TYPE_INTERVAL_MS);

      return () => clearInterval(interval);
    }, [isTyping]);

    const stop = useCallback(() => {
      abortRef.current?.abort();
      bufferRef.current = ''; // 清缓冲，打字机下一帧自动停
    }, []);

    // 完整文本 = 已显示 + 未渲染缓冲（copy 用）
    const copy = useCallback(async () => {
      try {
        await navigator.clipboard.writeText(displayedText + bufferRef.current);
        message.success(tAny?.common?.copySuccess || 'Copied');
      } catch {
        message.error(tAny?.common?.copyError || 'Copy failed');
      }
    }, [displayedText, tAny]);

    /**
     * 下载为 PNG（对齐 ll-agent / agent-ai-front `Typewriter.tsx` 的 `handleDownload`）：
     * 1. 等图片加载完成 + 1s 缓冲（参考实现的固定等待）；
     * 2. 对 `#download-ele` 预览节点截图：html-to-image 优先（pixelRatio 2），失败回退 html2canvas；
     * 3. 生成 `linklayer-ai-<ts>.png` 并触发 a[download]。
     * 截图对象是预览弹窗里的完整节点（高度 auto、无滚动），因此不会被截断。
     */
    const download = useCallback(async () => {
      const element = downloadRef.current;
      if (!element || isDownloading) {
        message.error(tAny?.agent?.downloadError || 'Download failed');
        return;
      }
      setIsDownloading(true);

      try {
        // 等图片加载完成，避免截出空白图；同时保留参考实现的 1s 等待
        await Promise.all([
          new Promise(resolve => window.setTimeout(resolve, 1000)),
          Promise.all(
            Array.from(element.querySelectorAll('img')).map(
              img =>
                new Promise<void>(resolve => {
                  if (img.complete) return resolve();
                  img.onload = () => resolve();
                  img.onerror = () => resolve();
                }),
            ),
          ),
        ]);

        const rect = element.getBoundingClientRect();
        const width = Math.max(element.scrollWidth, element.clientWidth, rect.width);
        const height = Math.max(element.scrollHeight, element.clientHeight, rect.height);

        let dataUrl: string | undefined;
        try {
          dataUrl = await htmlToImage.toPng(element, {
            quality: 1,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            width,
            height,
            filter: node => !(node instanceof HTMLImageElement) || isSafeImageSrc(node.src),
          });
        } catch {
          const canvas = await html2canvas(element, {
            useCORS: true,
            allowTaint: true,
            scale: 1,
            logging: true,
            width,
            height,
            windowWidth: width,
            windowHeight: height,
            backgroundColor: '#ffffff',
            ignoreElements: node => node instanceof HTMLImageElement && !isSafeImageSrc(node.src),
            onclone: clonedDoc => {
              // 参考实现：克隆文档中的图片统一转为可见块级图，避免导出空白
              clonedDoc.querySelectorAll('img').forEach(img => {
                img.style.display = 'block';
                img.style.visibility = 'visible';
                img.style.opacity = '1';
                img.style.objectFit = 'contain';
              });
            },
          });
          dataUrl = canvas.toDataURL('image/png');
        }

        if (!dataUrl || dataUrl === 'data:,' || dataUrl.length < 50) {
          message.error(tAny?.agent?.downloadError || 'Download failed');
          return;
        }

        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `linklayer-ai-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success(tAny?.agent?.downloadSuccess || 'Download success');
      } catch {
        message.error(tAny?.agent?.downloadError || 'Download failed');
      } finally {
        setIsDownloading(false);
      }
    }, [isDownloading, tAny]);

    return (
      <div className={`flex min-h-0 flex-col overflow-hidden bg-transparent ${className || ''}`}>
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className={`markdown-body min-h-0 flex-1 overflow-y-auto rounded-lg border-2 border-black bg-white p-3 leading-relaxed ${contentClassName || 'h-[68vh]'}`}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#ccc #f1f5f9',
            // 显式字号：github-markdown-css 的 `.markdown-body{font-size:16px}` 声明在
            // tailwind utilities 之后，会覆盖 className 上的 text-[..] 工具类，故用内联样式。
            // 调用方可通过 contentStyle 覆盖。
            fontSize: '14px',
            ...contentStyle,
          }}>
          {isStreaming && !displayedText ? (
            <div className="flex items-center gap-2 py-3 text-black/40">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#8AA90B]" />
              <span>{tAny?.guard?.waitingResponse || 'Waiting for response…'}</span>
            </div>
          ) : (
            <>
              {isTyping
                ? (() => {
                    const { stable, partial } = splitStableMarkdown(displayedText);
                    return (
                      <>
                        {stable && (
                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                            {stable}
                          </ReactMarkdown>
                        )}
                        {partial && <div className="whitespace-pre-wrap break-words">{partial}</div>}
                      </>
                    );
                  })()
                : displayedText && (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                      {displayedText}
                    </ReactMarkdown>
                  )}
              {isTyping && <span className="ml-0.5 inline-block animate-pulse">▋</span>}
            </>
          )}
        </div>

        {/* 操作行固定高度：父级是 flex-1 + overflow-hidden 时不会被压缩掉 */}
        <div className={`flex shrink-0 gap-3 px-0 py-2 ${isTyping ? 'justify-end' : 'justify-start'}`}>
          {isTyping ? (
            <button
              type="button"
              onClick={stop}
              className="flex items-center gap-1 rounded-[6px] border border-black bg-white px-3 py-1 text-[12px] font-bold text-black hover:bg-black/5">
              <span className="inline-block h-[8px] w-[8px] bg-black" />
              <span>{tAny?.guard?.stop || 'Stop'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              {displayedText && (
                <>
                  {/* Copy / Download 图标（对齐 ll-agent Typewriter 的 CopyOutlined / DownloadOutlined） */}
                  <button
                    type="button"
                    onClick={copy}
                    aria-label={tAny?.guard?.copy || 'Copy'}
                    title={tAny?.guard?.copy || 'Copy'}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-black text-black transition-opacity hover:opacity-70">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="12" height="12" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(true)}
                    disabled={isDownloading}
                    aria-label={tAny?.agent?.download || 'Download'}
                    title={tAny?.agent?.download || 'Download'}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-black text-black transition-opacity hover:opacity-70 disabled:opacity-40">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 3v12" />
                      <path d="m7 12 5 5 5-5" />
                      <path d="M4 21h16" />
                    </svg>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => startRef.current()}
                className="rounded-[6px] bg-[#cf0] px-3 py-1 text-[12px] font-bold text-black hover:opacity-80">
                {tAny?.guard?.regenerate || 'Regenerate'}
              </button>
            </div>
          )}
        </div>

        {/* 下载预览弹窗（对齐 ll-agent Typewriter 的下载 Dialog：品牌头 + 二维码 + 完整 markdown） */}
        <Dialog
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          panelClassName="relative z-[10001] w-[630px] max-w-[92%] rounded-[12px] bg-white p-[16px] shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img src={llLogo} alt="LinkLayer AI" className="h-[24px] w-[130px]" />
              <img src={llIcon} alt="" className="h-[24px]" />
              <span className="text-[16px] font-bold text-black">LinkLayer AI</span>
            </div>
            <img
              src={closeIcon}
              alt={tAny?.common?.close || 'Close'}
              className="h-[24px] w-[24px] cursor-pointer"
              onClick={() => setIsPreviewOpen(false)}
            />
          </div>

          <div
            className="mt-[14px] h-[65vh] overflow-x-auto overflow-y-auto bg-white"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#ccc #f1f5f9' }}>
            {/*
            截图节点固定宽度（参考 miniapp 的 min-w-[800px]）：比弹窗内容区宽 → 出现横向滚动条，
            导出的 PNG 也保持统一宽度，不会随侧边栏宽度变化。
          */}
            <div ref={downloadRef} className="px-20px w-[600px] min-w-[600px] max-w-none">
              <div className="flex min-w-0 items-center justify-between gap-4 border-b border-[#eee] py-[20px] pb-[14px]">
                <div className="flex min-w-0 flex-1 items-center">
                  <img src={bigLogo} alt="" className="h-[100px] w-[100px] shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col justify-center pl-4">
                    <div className="flex flex-col gap-2">
                      <div className="text-[14px] font-bold text-black">{tAny?.agent?.scanCode || 'Scan the code'}</div>
                      <div className="break-words text-[12px] text-gray-600">
                        {tAny?.agent?.scanTip || 'Open LinkLayer AI to view the full report.'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="shrink-0">
                  <img src={qrCode} alt="" className="h-[100px] w-[100px] object-contain" />
                </div>
              </div>

              <div className="markdown-body break-words pb-[30px] text-[12px]">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {displayedText}
                </ReactMarkdown>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={download}
              disabled={isDownloading}
              className="mt-[24px] flex w-[70%] cursor-pointer items-center justify-center gap-2 rounded-[8px] bg-[#cf0] px-[16px] py-[6px] text-center text-[16px] font-bold text-black disabled:cursor-not-allowed disabled:opacity-60">
              {isDownloading && (
                <span className="h-[16px] w-[16px] shrink-0 animate-spin rounded-full border-2 border-black/20 border-t-black" />
              )}
              {isDownloading ? tAny?.agent?.downloading || 'Downloading...' : tAny?.agent?.download || 'Download'}
            </button>
          </div>
        </Dialog>
      </div>
    );
  },
);

ReportStream.displayName = 'ReportStream';
