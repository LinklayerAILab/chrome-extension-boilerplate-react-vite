import { ReactNode, useEffect, useMemo, useRef, useState, memo } from 'react';
import html2canvas from 'html2canvas';
import * as htmlToImage from 'html-to-image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { message } from '@src/ui';
import { useI18n } from '@src/lib/i18n';
import Dialog from './Dialog';

const tradingIcon = chrome.runtime.getURL('content-ui/agent/trading.svg');
const llIcon = chrome.runtime.getURL('content-ui/agent/ll.svg');
const llText = chrome.runtime.getURL('content-ui/agent/llicon.svg');
const offIcon = chrome.runtime.getURL('content-ui/agent/off.svg');
const bigLogo = chrome.runtime.getURL('content-ui/agent/biglogo.svg');
const codeIcon = chrome.runtime.getURL('content-ui/agent/code.png');
const noDataIcon = chrome.runtime.getURL('content-ui/agent/noData.svg');

export interface MessageChunk {
  id: string;
  content: string;
  timestamp?: number;
}

export interface CoinItem {
  symbol?: string;
}

interface TypewriterProps {
  text?: string;
  messages?: MessageChunk[];
  speed?: number;
  currentCoin?: CoinItem;
  status?: 'init' | 'loading' | 'generating' | 'end';
  isStreaming?: boolean;
  initNode?: ReactNode;
  loadingClassName?: string;
  initClassName?: string;
  initNodeClassName?: string;
}

const CircularProgress = ({ percent }: { percent: number }) => {
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative flex h-[120px] w-[120px] items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#eee" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#8aa90b"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.2s ease' }}
        />
      </svg>
      <div className="absolute text-sm font-semibold text-gray-600">{Math.round(clamped)}%</div>
    </div>
  );
};

const Typewriter = ({
  text,
  messages,
  speed = 10,
  currentCoin,
  status = 'init',
  isStreaming = false,
  initNode,
  loadingClassName,
  initClassName,
  initNodeClassName,
}: TypewriterProps) => {
  const { t } = useI18n();
  const tAny = t as unknown as Record<string, any>;
  const [displayedText, setDisplayedText] = useState('');
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const downloadRef = useRef<HTMLDivElement | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isTypingDone, setIsTypingDone] = useState(false);

  const processedMessagesRef = useRef<Set<string>>(new Set());
  const fullTextRef = useRef('');
  const currentIndexRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const prevStatusRef = useRef(status);
  const messageTimestampsRef = useRef<number[]>([]);
  const prevTextLengthRef = useRef(0);
  const prevModeRef = useRef<'text' | 'messages' | null>(null);

  const labels = useMemo(
    () => ({
      analyzing: tAny?.agent?.analyzing ?? 'Analyzing...',
      downloadError: tAny?.agent?.downloadError ?? 'Download failed',
      downloadSuccess: tAny?.agent?.downloadSuccess ?? 'Download successful',
      copySuccess: tAny?.agent?.copySuccess ?? 'Copied to clipboard',
      copyError: tAny?.agent?.copyError ?? 'Copy failed',
      trading: tAny?.agent?.trading ?? 'Trading',
      scanCode: tAny?.agent?.scanCode ?? 'Scan the code',
      scanTip: tAny?.agent?.scanTip ?? 'Open LinkLayer AI to view the full report.',
      download: tAny?.agent?.download ?? 'Download',
      copyContent: tAny?.agent?.copyContent ?? 'Copy Content',
      shareReport: tAny?.agent?.shareReport ?? 'Share Report',
      downloadReport: tAny?.agent?.downloadReport ?? 'Download Report',
      linkLayerAI: tAny?.agent?.linkLayerAI ?? 'LinkLayer AI',
    }),
    [tAny],
  );

  const calculateDynamicSpeed = (totalLength: number, currentStatus: string = status): number => {
    const remainingLength = totalLength - currentIndexRef.current;

    if (currentStatus === 'end' && remainingLength > 0) {
      const targetDuration = 1500;
      const calculatedSpeed = targetDuration / remainingLength;
      return Math.max(1, Math.min(50, calculatedSpeed));
    }

    let baseSpeed = speed;

    if (messageTimestampsRef.current.length >= 2) {
      const timestamps = messageTimestampsRef.current;
      const totalInterval = timestamps[timestamps.length - 1] - timestamps[0];
      const avgInterval = totalInterval / (timestamps.length - 1);
      const charsPerSecond = 1000 / avgInterval;
      const targetCharsPerSecond = charsPerSecond * 1.2;
      const targetMsPerChar = 1000 / targetCharsPerSecond;
      baseSpeed = Math.max(3, Math.min(30, targetMsPerChar));
    }

    if (totalLength <= 500) {
      return baseSpeed;
    }
    if (totalLength <= 2000) {
      const ratio = (totalLength - 500) / 1500;
      return baseSpeed - baseSpeed * 0.5 * ratio;
    }
    if (totalLength <= 5000) {
      const ratio = (totalLength - 2000) / 3000;
      return baseSpeed / 2 - baseSpeed * 0.3 * ratio;
    }
    return Math.max(1, baseSpeed / 10);
  };

  const startTypewriterIfNeeded = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (currentIndexRef.current >= fullTextRef.current.length) {
      return;
    }

    const dynamicSpeed = calculateDynamicSpeed(fullTextRef.current.length, status);
    timerRef.current = window.setInterval(() => {
      if (currentIndexRef.current < fullTextRef.current.length) {
        currentIndexRef.current += 1;
        const currentText = fullTextRef.current.slice(0, currentIndexRef.current);
        setDisplayedText(currentText);
      } else {
        window.dispatchEvent(new Event('textLoaded'));
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }, dynamicSpeed);
  };

  const initStr = () => {
    const currentMode: 'text' | 'messages' | null = text ? 'text' : messages ? 'messages' : null;

    if (prevModeRef.current !== null && prevModeRef.current !== currentMode) {
      processedMessagesRef.current.clear();
      fullTextRef.current = '';
      currentIndexRef.current = 0;
      messageTimestampsRef.current = [];
      prevTextLengthRef.current = 0;
      setDisplayedText('');
    }

    prevModeRef.current = currentMode;
    const currentMessages = messages || (text ? [{ id: 'legacy', content: text, timestamp: Date.now() }] : []);

    if (currentMessages.length === 0) {
      if (status !== 'loading') {
        setDisplayedText('');
      }
      processedMessagesRef.current.clear();
      fullTextRef.current = '';
      currentIndexRef.current = 0;
      messageTimestampsRef.current = [];
      prevTextLengthRef.current = 0;
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (text) {
      const currentTextLength = text.length;
      if (currentTextLength > prevTextLengthRef.current) {
        const charsAdded = currentTextLength - prevTextLengthRef.current;
        const currentTime = Date.now();

        for (let i = 0; i < Math.min(charsAdded, 10); i += 1) {
          messageTimestampsRef.current.push(currentTime);
        }

        if (messageTimestampsRef.current.length > 20) {
          messageTimestampsRef.current = messageTimestampsRef.current.slice(-20);
        }

        prevTextLengthRef.current = currentTextLength;
      }

      fullTextRef.current = text;
      startTypewriterIfNeeded();
      return;
    }

    const newMessages = currentMessages.filter(msg => !processedMessagesRef.current.has(msg.id));

    if (newMessages.length > 0) {
      window.dispatchEvent(new Event('textLoading'));
      newMessages.forEach(msg => processedMessagesRef.current.add(msg.id));

      const currentTime = Date.now();
      newMessages.forEach(() => {
        messageTimestampsRef.current.push(currentTime);
      });

      if (messageTimestampsRef.current.length > 20) {
        messageTimestampsRef.current = messageTimestampsRef.current.slice(-20);
      }

      const newContent = newMessages.map(msg => msg.content).join('');
      if (newContent.length > 0) {
        fullTextRef.current += newContent;
        startTypewriterIfNeeded();
      }
    }
  };

  useEffect(() => {
    if (prevStatusRef.current !== 'end' && status === 'end') {
      const remainingChars = fullTextRef.current.length - currentIndexRef.current;

      if (remainingChars > 0) {
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const finalSpeed = calculateDynamicSpeed(fullTextRef.current.length, 'end');
        timerRef.current = window.setInterval(() => {
          if (currentIndexRef.current < fullTextRef.current.length) {
            currentIndexRef.current += 1;
            const currentText = fullTextRef.current.slice(0, currentIndexRef.current);
            setDisplayedText(currentText);
          } else {
            window.dispatchEvent(new Event('textLoaded'));
            if (timerRef.current) {
              window.clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
        }, finalSpeed);
      } else {
        window.dispatchEvent(new Event('textLoaded'));
      }
    }

    prevStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    const handleTextLoaded = () => {
      if (status === 'end') {
        setIsTypingDone(true);
      }
    };
    const handleTextLoading = () => setIsTypingDone(false);

    window.addEventListener('textLoaded', handleTextLoaded);
    window.addEventListener('textLoading', handleTextLoading);

    return () => {
      window.removeEventListener('textLoaded', handleTextLoaded);
      window.removeEventListener('textLoading', handleTextLoading);
    };
  }, [status]);

  useEffect(() => {
    if (status === 'loading') {
      setProgressPercent(0);

      const startTimer = window.setTimeout(() => {
        const totalTime = 10000;
        const targetPercent = 95;
        const intervalTime = 70;
        const increment = (targetPercent / totalTime) * intervalTime;

        progressTimerRef.current = window.setInterval(() => {
          setProgressPercent(prev => {
            if (prev >= targetPercent) {
              if (progressTimerRef.current) {
                window.clearInterval(progressTimerRef.current);
                progressTimerRef.current = null;
              }
              return targetPercent;
            }
            return prev + increment;
          });
        }, intervalTime);
      }, 50);

      return () => {
        window.clearTimeout(startTimer);
        if (progressTimerRef.current) {
          window.clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
      };
    }

    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgressPercent(0);
  }, [status]);

  useEffect(() => {
    initStr();

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [messages, text, speed]);

  useEffect(() => {
    if (status === 'end') {
      if (fullTextRef.current.length === 0 || currentIndexRef.current >= fullTextRef.current.length) {
        setIsTypingDone(true);
      }
      return;
    }
    setIsTypingDone(false);
  }, [status]);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(displayedText);
        message.success(labels.copySuccess);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = displayedText;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          message.success(labels.copySuccess);
        } catch {
          message.error(labels.copyError);
        }
        document.body.removeChild(textArea);
      }
    } catch {
      message.error(labels.copyError);
    }
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    const isSafeImageSrc = (src?: string | null) => {
      if (!src) return true;
      if (src.startsWith('data:')) return true;
      if (src.startsWith('chrome-extension://')) return true;
      try {
        const url = new URL(src, window.location.href);
        return url.origin === window.location.origin;
      } catch {
        return true;
      }
    };

    const findInShadowDOMs = (): HTMLElement | null => {
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const shadowRoot = (el as any).shadowRoot as ShadowRoot | null;
        if (shadowRoot) {
          const found = shadowRoot.getElementById('download-ele');
          if (found) {
            return found as HTMLElement;
          }
        }
      }
      return null;
    };

    const element =
      downloadRef.current || (document.getElementById('download-ele') as HTMLElement | null) || findInShadowDOMs();
    if (!element) {
      message.error(labels.downloadError);
      setIsDownloading(false);
      return;
    }

    console.log('[Typewriter][Download] start', {
      hasElement: Boolean(element),
      displayedTextLength: displayedText.length,
      hasMessages: Boolean(messages?.length),
      status,
      timestamp: Date.now(),
    });

    try {
      const preloadImages = () =>
        new Promise<void>(resolve => {
          const images = element.querySelectorAll('img');
          console.log('[Typewriter][Download] preload images:', images.length);
          const imagePromises = Array.from(images).map(
            img =>
              new Promise<void>(imgResolve => {
                if (img.complete) {
                  console.log('[Typewriter][Download] image already complete', img.src);
                  imgResolve();
                } else {
                  img.onload = () => imgResolve();
                  img.onerror = () => imgResolve();
                }
              }),
          );
          Promise.all(imagePromises).then(() => resolve());
        });

      console.log('[Typewriter][Download] waiting for preload + delay');
      await Promise.all([new Promise(resolve => window.setTimeout(resolve, 1000)), preloadImages()]);

      const codeImg = element.querySelector('img[src*="code"]');
      if (codeImg) {
        console.log('[Typewriter][Download] found code image');
        (codeImg as HTMLElement).style.cssText = `
          width: 100px !important;
          height: 100px !important;
          object-fit: contain !important;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          position: static !important;
          transform: none !important;
          flex-shrink: 0 !important;
        `;
      }

      const rect = element.getBoundingClientRect();
      console.log('[Typewriter][Download] element rect', rect);

      let dataUrl: string | undefined;
      try {
        console.log('[Typewriter][Download] html-to-image start');
        dataUrl = await htmlToImage.toPng(element, {
          quality: 1,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          width: Math.max(element.scrollWidth, element.clientWidth, rect.width),
          height: Math.max(element.scrollHeight, element.clientHeight, rect.height),
          filter: node => {
            if (node instanceof HTMLImageElement) {
              return isSafeImageSrc(node.src);
            }
            return true;
          },
        });
        console.log('[Typewriter][Download] html-to-image success', {
          length: dataUrl?.length,
        });
      } catch (htmlToImageError) {
        console.warn('[Typewriter][Download] html-to-image failed, fallback to html2canvas', htmlToImageError);
        const canvas = await html2canvas(element, {
          useCORS: true,
          allowTaint: true,
          scale: 1,
          logging: true,
          ignoreElements: node => {
            if (node instanceof HTMLImageElement) {
              return !isSafeImageSrc(node.src);
            }
            return false;
          },
          backgroundColor: '#ffffff',
          onclone: clonedDoc => {
            const images = clonedDoc.querySelectorAll('img');
            images.forEach(img => {
              img.style.display = 'block';
              img.style.visibility = 'visible';
              img.style.opacity = '1';
              img.style.width = img.getAttribute('width') || '100px';
              img.style.height = img.getAttribute('height') || '100px';
              img.style.objectFit = 'contain';
            });
          },
        });

        dataUrl = canvas.toDataURL('image/png');
        console.log('[Typewriter][Download] html2canvas success', {
          length: dataUrl?.length,
        });
      }

      if (!dataUrl || dataUrl === 'data:,' || dataUrl.length < 50) {
        console.warn('[Typewriter][Download] invalid dataUrl', {
          dataUrlLength: dataUrl?.length,
        });
        message.error(labels.downloadError);
        setIsDownloading(false);
        return;
      }

      try {
        console.log('[Typewriter][Download] trigger download');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `linklayer-ai-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success(labels.downloadSuccess);
      } catch (downloadError) {
        console.error('Download failed:', downloadError);
        message.error(labels.downloadError);
      }
      setIsDownloading(false);
    } catch (error) {
      console.error('[Typewriter][Download] failed:', error);
      message.error(labels.downloadError);
      setIsDownloading(false);
    }
  };

  const handleShowDialog = () => {
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleToTrading = () => {
    if (!currentCoin?.symbol) return;
    const symbol = currentCoin.symbol.split('USDT')[0];
    window.open(`https://www.binance.com/en/trade/${symbol}_USDT?type=spot`, '_blank');
  };

  const hasMessageData = useMemo(() => {
    return status === 'loading' || Boolean(messages?.length) || Boolean(text?.length);
  }, [status, messages, text]);

  const showCopyButtons = isTypingDone && !isStreaming;

  useEffect(() => {
    if (showCopyButtons) {
      window.dispatchEvent(new Event('copyButtonsShown'));
    }
  }, [showCopyButtons]);

  return (
    <div style={{ boxSizing: 'border-box' }}>
      {status === 'init' ? (
        <div
          className={`type-context flex items-center justify-center ${
            initClassName ? initClassName : 'h-[60vh] lg:h-[73.4vh]'
          }`}>
          {initNode ? initNode : <img src={noDataIcon} className="lg:h-[140px] lg:w-[140px]" alt="" />}
        </div>
      ) : status === 'loading' ? (
        <div
          className={`${
            loadingClassName ? loadingClassName : 'h-[60vh] lg:h-[70vh]'
          } type-context flex items-center justify-center lg:w-[100%]`}>
          <div className="flex flex-col items-center gap-4">
            <CircularProgress percent={Math.round(progressPercent)} />
            <div className="text-gray-600">{labels.analyzing}</div>
          </div>
        </div>
      ) : (status === 'generating' || status === 'end') && hasMessageData ? (
        <>
          <div
            className="markdown-body relative max-w-[88vw] break-words rounded-[8px] bg-[#eee] p-4 text-[12px]"
            id="copy-ele"
            style={{
              fontSize: 12,
            }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                table: ({ ...props }) => (
                  <div style={{ overflowX: 'auto', fontSize: 12 }}>
                    <table {...props} />
                  </div>
                ),
                img: ({ ...props }) => <img {...props} crossOrigin="anonymous" />,
              }}>
              {displayedText}
            </ReactMarkdown>
          </div>
          <div
            className={`mx-4 flex flex-col items-center justify-start gap-2 overflow-hidden text-[12px] font-bold transition-all duration-300 ${
              showCopyButtons
                ? 'max-h-[200px] translate-y-0 opacity-100'
                : 'pointer-events-none max-h-0 translate-y-2 opacity-0'
            }`}
            id="copy-btns">
            <div
              onClick={handleCopy}
              aria-label="Copy"
              className="flex h-[38px] w-full cursor-pointer items-center justify-between gap-4 rounded-[8px] bg-[#F3F3F3] px-[14px] transition-colors hover:bg-[#e5e5e5]">
              {labels.copyContent}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 0.5C18.3513 0.5 23.5 5.64873 23.5 12C23.5 18.3513 18.3513 23.5 12 23.5C5.64873 23.5 0.5 18.3513 0.5 12C0.5 5.64873 5.64873 0.5 12 0.5Z"
                  stroke="black"
                />
                <g clip-path="url(#clip0_10581_11076)">
                  <path
                    d="M14.709 9.26611H6.95508V9.26709L6.94727 9.26611C6.94165 9.26603 6.93588 9.26792 6.93066 9.27002C6.92555 9.27209 6.92094 9.27495 6.91699 9.27881C6.913 9.28275 6.9094 9.2873 6.90723 9.29248C6.90506 9.29766 6.9043 9.30347 6.9043 9.30908V17.0718L6.90723 17.0884C6.90939 17.0935 6.91304 17.0982 6.91699 17.1021C6.92094 17.1059 6.92557 17.1088 6.93066 17.1108C6.93588 17.1129 6.94165 17.1138 6.94727 17.1138H14.709C14.7202 17.1138 14.7313 17.1099 14.7393 17.1021C14.7472 17.0941 14.7519 17.083 14.752 17.0718V9.30908C14.752 9.29784 14.7472 9.28676 14.7393 9.27881C14.7313 9.27088 14.7202 9.26611 14.709 9.26611Z"
                    fill="white"
                    stroke="black"
                    stroke-width="1.2"
                  />
                  <path
                    d="M16.9902 6.6001H9.23633V6.60107L9.22852 6.6001C9.2229 6.60002 9.21713 6.60191 9.21191 6.604C9.2068 6.60608 9.20219 6.60893 9.19824 6.61279C9.19425 6.61673 9.19065 6.62128 9.18848 6.62646C9.18631 6.63165 9.18555 6.63745 9.18555 6.64307V14.4058L9.18848 14.4224C9.19064 14.4275 9.19429 14.4321 9.19824 14.436C9.20219 14.4399 9.20682 14.4428 9.21191 14.4448C9.21713 14.4469 9.2229 14.4478 9.22852 14.4478H16.9902C17.0014 14.4478 17.0126 14.4439 17.0205 14.436C17.0284 14.4281 17.0332 14.417 17.0332 14.4058V6.64307C17.0332 6.63183 17.0285 6.62074 17.0205 6.61279C17.0126 6.60487 17.0015 6.6001 16.9902 6.6001Z"
                    fill="white"
                    stroke="black"
                    stroke-width="1.2"
                  />
                  <path
                    d="M10.8359 9.08333C10.8359 8.76117 11.0259 8.5 11.2602 8.5L15.0784 8.5C15.3127 8.5 15.5026 8.76117 15.5026 9.08333C15.5026 9.4055 15.3127 9.66667 15.0784 9.66667L11.2602 9.66667C11.0259 9.66667 10.8359 9.4055 10.8359 9.08333Z"
                    fill="black"
                  />
                  <path
                    d="M10.8359 11.4168C10.8359 11.0947 11.0259 10.8335 11.2602 10.8335L15.0784 10.8335C15.3127 10.8335 15.5026 11.0947 15.5026 11.4168C15.5026 11.739 15.3127 12.0002 15.0784 12.0002L11.2602 12.0002C11.0259 12.0002 10.8359 11.739 10.8359 11.4168Z"
                    fill="black"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_10581_11076">
                    <rect width="12" height="12" fill="white" transform="translate(6 6)" />
                  </clipPath>
                </defs>
              </svg>
            </div>
            <div
              onClick={handleShowDialog}
              aria-label="Share"
              className="flex h-[38px] w-full cursor-pointer items-center justify-between gap-4 rounded-[8px] bg-[#F3F3F3] px-[14px] transition-colors hover:bg-[#e5e5e5]">
              {labels.shareReport}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect
                  x="0.428571"
                  y="0.428571"
                  width="23.1429"
                  height="23.1429"
                  rx="11.5714"
                  stroke="black"
                  stroke-width="0.857143"
                />
                <g clip-path="url(#clip0_10581_11085)">
                  <g clip-path="url(#clip1_10581_11085)">
                    <path
                      d="M13.8504 10.8912V12.1739C13.8504 12.6481 14.1306 12.7714 14.4774 12.4481L17.2047 9.90572C17.2982 9.80667 17.2998 9.63981 17.2055 9.53924L14.4973 7.17003C14.14 6.85747 13.8504 6.98754 13.8504 7.46409V8.74884C11.2926 8.74884 8.71259 10.2022 8.71259 12.604C8.71259 12.604 10.4375 10.8912 13.8504 10.8912ZM7.85841 12.9999C7.38406 12.9999 7 13.3825 7 13.8545V16.431C7 16.9022 7.38432 17.2856 7.85841 17.2856H16.4171C16.8915 17.2856 17.2755 16.903 17.2755 16.431V13.8545C17.2755 13.3833 16.8912 12.9999 16.4171 12.9999C15.9454 12.9999 15.5629 13.3849 15.5629 13.8561V15.1467C15.5629 15.3812 15.3726 15.5713 15.1344 15.5713H9.14111C8.90444 15.5713 8.71259 15.378 8.71259 15.1467V13.8561C8.71259 13.3833 8.32549 12.9999 7.85841 12.9999Z"
                      fill="black"
                    />
                  </g>
                </g>
                <defs>
                  <clipPath id="clip0_10581_11085">
                    <rect width="10.2857" height="10.2857" fill="white" transform="matrix(0 1 -1 0 17.1445 6.85693)" />
                  </clipPath>
                  <clipPath id="clip1_10581_11085">
                    <rect width="10.2857" height="10.2857" fill="white" transform="translate(6.86328 6.85693)" />
                  </clipPath>
                </defs>
              </svg>
            </div>
            <div
              onClick={handleShowDialog}
              className="flex h-[38px] w-full cursor-pointer items-center justify-between gap-4 rounded-[8px] bg-[#F3F3F3] px-[14px] transition-colors hover:bg-[#e5e5e5]">
              {labels.downloadReport}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 0.5C18.3513 0.5 23.5 5.64873 23.5 12C23.5 18.3513 18.3513 23.5 12 23.5C5.64873 23.5 0.5 18.3513 0.5 12C0.5 5.64873 5.64873 0.5 12 0.5Z"
                  stroke="black"
                />
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M15.8629 6.21143C16.6915 6.21143 17.3633 6.88319 17.3633 7.71184V12.8561C17.3633 13.6848 16.6915 14.3566 15.8629 14.3566H15.0055C14.6503 14.3566 14.3624 14.0687 14.3624 13.7135C14.3624 13.3584 14.6503 13.0705 15.0055 13.0705H15.8629C15.9812 13.0705 16.0772 12.9745 16.0772 12.8561V7.71184C16.0772 7.59346 15.9812 7.4975 15.8629 7.4975L8.14643 7.4975C8.02805 7.4975 7.93208 7.59346 7.93208 7.71184V12.8561C7.93208 12.9745 8.02805 13.0705 8.14643 13.0705H9.00381C9.35895 13.0705 9.64684 13.3584 9.64684 13.7135C9.64684 14.0687 9.35895 14.3566 9.00381 14.3566H8.14643C7.31777 14.3566 6.64601 13.6848 6.64601 12.8561V7.71184C6.64601 6.88319 7.31777 6.21143 8.14643 6.21143L15.8629 6.21143Z"
                  fill="black"
                />
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M14.6481 15.0292C14.87 15.3065 14.825 15.7112 14.5477 15.933L12.3372 17.7014C12.1416 17.8579 11.8635 17.8579 11.6679 17.7014L9.45739 15.933C9.18007 15.7112 9.13511 15.3065 9.35697 15.0292C9.57882 14.7519 9.98348 14.7069 10.2608 14.9288L11.3595 15.8077V10.2866C11.3595 9.93145 11.6474 9.64355 12.0025 9.64355C12.3577 9.64355 12.6456 9.93145 12.6456 10.2866V15.8077L13.7443 14.9288C14.0216 14.7069 14.4263 14.7519 14.6481 15.0292Z"
                  fill="black"
                />
              </svg>
            </div>
          </div>
        </>
      ) : (
        <div
          className={`flex items-center justify-center ${
            initNodeClassName ? initNodeClassName : 'h-[60vh] lg:h-[73.4vh]'
          }`}>
          {initNode ? initNode : <img src={noDataIcon} className="bg-[#F9FFE2] lg:h-[140px] lg:w-[140px]" alt="" />}
        </div>
      )}

      <Dialog isOpen={isDialogOpen} onClose={handleCloseDialog}>
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-start">
            <img src={llText} alt="" className="h-[24px]" />
            <span className="text-[16px] font-bold">{labels.linkLayerAI}</span>
          </div>
          <div>
            <img src={offIcon} className="h-[24px] w-[24px] cursor-pointer" onClick={handleCloseDialog} alt="" />
          </div>
        </div>
        <div className="mt-[14px] h-[65vh] bg-white lg:mt-[20px] lg:h-[70vh]">
          <div
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#ccc #f1f5f9', // Firefox: thumb color, track color (slate-300, slate-100)
            }}
            className={`${messages?.length ? 'custom-scrollbar-light overflow-y-scroll' : ''} h-full`}>
            <div
              id="download-ele"
              ref={downloadRef}
              className="w-full min-w-[800px] max-w-none overflow-x-auto p-[14px] lg:w-[1000px]"
              style={{
                fontSize: 12,
              }}>
              <div className="border-b-solid flex min-w-0 items-center justify-between gap-4 border-b border-[#eee] py-[20px] pb-[14px]">
                <div className="flex min-w-0 flex-1 items-center">
                  <img src={bigLogo} className="h-[100px] w-[100px] flex-shrink-0 lg:h-[100px] lg:w-[100px]" alt="" />
                  <div className="flex min-w-0 flex-1 flex-col justify-center pl-4">
                    <div className="flex flex-col gap-2">
                      <div className="text-[14px] font-bold lg:text-[16px]">{labels.scanCode}</div>
                      <div className="break-words text-[12px] text-gray-600 lg:text-[14px]">{labels.scanTip}</div>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <img
                    width={100}
                    height={100}
                    src={codeIcon}
                    className="h-[100px] w-[100px] object-contain lg:h-[100px] lg:w-[100px]"
                    alt=""
                  />
                </div>
              </div>
              <div className="markdown-body min-h-[56vh] break-words pb-[30px]" style={{ fontSize: 12 }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    table: ({ ...props }) => (
                      <div style={{ overflowX: 'auto' }}>
                        <table {...props} />
                      </div>
                    ),
                    img: ({ ...props }) => <img {...props} crossOrigin="anonymous" />,
                  }}>
                  {displayedText}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <div
            onClick={handleDownload}
            className={`mt-[24px] w-[70%] rounded-[8px] bg-[#cf0] px-[16px] py-[6px] text-center text-[16px] font-bold text-black ${
              isDownloading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
            }`}>
            {isDownloading ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block h-[14px] w-[14px] animate-spin rounded-full border-2 border-black border-t-transparent"
                  aria-hidden="true"
                />
                {`${labels.download}...`}
              </span>
            ) : (
              labels.download
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default memo(Typewriter);

Typewriter.displayName = 'Typewriter';
