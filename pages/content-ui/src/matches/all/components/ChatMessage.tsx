import { ReactNode, useEffect, useMemo, useRef, useState, memo } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { Popover } from '@src/ui';
import { useI18n } from '@src/lib/i18n';
import type { AnalyseCoinCResponse, RecommendCoinCResponse } from '@src/api/agent_c';
import Typewriter, { type MessageChunk, type CoinItem } from './Typewriter';

interface RecomendItem {
  type: 'recommend_coin';
  data: RecommendCoinCResponse;
}
interface AnalyseItem {
  type: 'analyse_coin';
  data: AnalyseCoinCResponse;
}
export type Messageitem = RecomendItem | AnalyseItem;

interface StopButtonProps {
  onClick?: () => void;
}

const StopButton = memo(({ onClick }: StopButtonProps) => {
  const lottieAnimation = useMemo(
    () => (
      <DotLottieReact src="https://lottie.host/79305bfb-5216-49e6-b30c-95f0871fbf64/yKlX4HP3Dl.lottie" loop autoplay />
    ),
    [],
  );

  return (
    <button
      type="button"
      className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-white shadow-md"
      onClick={onClick}
      aria-label="Stop">
      {lottieAnimation}
    </button>
  );
});

StopButton.displayName = 'StopButton';

const ConfirmPopover = ({
  open,
  onConfirm,
  title,
  okText,
  children,
}: {
  open: boolean;
  onConfirm: () => void;
  title: string;
  okText: string;
  children: ReactNode;
}) => {
  return (
    <Popover
      open={open}
      placement="top"
      content={
        <div className="flex w-[180px] flex-col gap-3">
          <div className="text-sm text-gray-800">{title}</div>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-[6px] bg-[#cf0] px-3 py-1 text-sm font-bold text-black">
            {okText}
          </button>
        </div>
      }>
      {children}
    </Popover>
  );
};

export const ChatMessage = (props: {
  message?: Messageitem[];
  text?: string;
  messages?: MessageChunk[];
  loading: boolean;
  tip: string;
  className?: string;
  currentCoin?: CoinItem;
  initNode?: ReactNode;
  status: 'init' | 'loading' | 'generating' | 'end';
  stopCreation?: () => void;
  isStreaming?: boolean;
}) => {
  const { t } = useI18n();
  const tAny = t as unknown as Record<string, any>;
  const messageRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const rafScrollRef = useRef<number | null>(null);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [intervalId, setIntervalId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const labels = useMemo(
    () => ({
      stopGenerationTip: tAny?.common?.stopGenerationTip ?? 'Stop generation?',
      gotIt: tAny?.common?.gotIt ?? 'Got it',
    }),
    [tAny],
  );

  const handleStop = (event: Event) => {
    event.stopPropagation();
  };

  const checkIfAtBottom = () => {
    if (messageRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messageRef.current;
      const isBottom = scrollHeight - scrollTop - clientHeight < 10;
      setIsAtBottom(isBottom);
    }
  };

  const canAutoScroll = () => {
    if (!messageRef.current) return false;
    return !userScrolledUp;
  };

  const scrollToBottom = () => {
    if (!canAutoScroll()) return;
    if (messageRef.current) {
      messageRef.current.scrollTop = messageRef.current.scrollHeight;
    }
  };

  const handleScroll = () => {
    if (!messageRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messageRef.current;
    const isBottom = scrollHeight - scrollTop - clientHeight < 10;
    const scrolledUp = scrollTop < lastScrollTopRef.current;
    lastScrollTopRef.current = scrollTop;

    setIsAtBottom(isBottom);

    if (isBottom) {
      setUserScrolledUp(false);
    } else if (scrolledUp) {
      setUserScrolledUp(true);
    }
  };

  useEffect(() => {
    const currentRef = messageRef.current;
    if (currentRef) {
      currentRef.addEventListener('scroll', handleStop);
      currentRef.addEventListener('wheel', handleStop);
      currentRef.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (currentRef) {
        currentRef.removeEventListener('scroll', handleStop);
        currentRef.removeEventListener('wheel', handleStop);
        currentRef.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  useEffect(() => {
    const shouldStickToBottom = props.status === 'generating' && isAtBottom && canAutoScroll();
    if (!shouldStickToBottom) {
      if (rafScrollRef.current) {
        cancelAnimationFrame(rafScrollRef.current);
        rafScrollRef.current = null;
      }
      return;
    }

    const tick = () => {
      scrollToBottom();
      rafScrollRef.current = requestAnimationFrame(tick);
    };

    rafScrollRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafScrollRef.current) {
        cancelAnimationFrame(rafScrollRef.current);
        rafScrollRef.current = null;
      }
    };
  }, [props.status, isAtBottom, userScrolledUp]);

  useEffect(() => {
    if (
      !messageRef.current ||
      (props.status !== 'generating' && props.status !== 'end') ||
      !isAtBottom ||
      !canAutoScroll()
    ) {
      return;
    }

    const observer = new MutationObserver(() => {
      if ((props.status === 'generating' || props.status === 'end') && isAtBottom && canAutoScroll()) {
        scrollToBottom();
      }
    });

    observer.observe(messageRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [props.status, isAtBottom]);

  useEffect(() => {
    if (!messageRef.current) return;
    if (!userScrolledUp) {
      scrollToBottom();
    }
  }, [props.status, props.messages, userScrolledUp]);

  const showLoader = () => {
    if (intervalId) {
      window.clearInterval(intervalId);
    }
    let ptg = -2;
    const nextInterval = window.setInterval(() => {
      if (ptg < 94) {
        ptg += 2;
      }
    }, 350);
    setIntervalId(nextInterval);
    return nextInterval;
  };

  useEffect(() => {
    if (props.loading) {
      showLoader();
    } else if (intervalId) {
      window.clearInterval(intervalId);
      setIntervalId(null);
    }
  }, [props.loading]);

  const handleConfirm = () => {
    localStorage.setItem('showCreateCollectionTip', 'true');
    setOpen(false);
  };

  useEffect(() => {
    let copyButtonsObserver: ResizeObserver | null = null;

    if (
      (props.status === 'loading' || props.status === 'generating') &&
      !localStorage.getItem('showCreateCollectionTip')
    ) {
      setOpen(true);
    }

    const handleTextLoaded = () => {
      setOpen(false);
      setIsTypingComplete(true);
    };

    const handleCopyButtonsShown = () => {
      if (!messageRef.current || userScrolledUp) return;
      const copyBtns = messageRef.current.querySelector('#copy-btns') as HTMLElement | null;
      if (!copyBtns) return;

      const scrollIfNeeded = () => {
        if (!messageRef.current) return;
        messageRef.current.scrollTo({ top: messageRef.current.scrollHeight, behavior: 'auto' });
        setIsAtBottom(true);
      };

      scrollIfNeeded();

      copyButtonsObserver = new ResizeObserver(() => {
        if (!userScrolledUp) {
          scrollIfNeeded();
        }
      });
      copyButtonsObserver.observe(copyBtns);
    };

    window.addEventListener('textLoaded', handleTextLoaded);
    window.addEventListener('copyButtonsShown', handleCopyButtonsShown);
    return () => {
      window.removeEventListener('textLoaded', handleTextLoaded);
      window.removeEventListener('copyButtonsShown', handleCopyButtonsShown);
      if (copyButtonsObserver) {
        copyButtonsObserver.disconnect();
        copyButtonsObserver = null;
      }
    };
  }, [props.status, userScrolledUp]);

  useEffect(() => {
    if (props.status === 'loading' || props.status === 'generating') {
      setIsTypingComplete(false);
    }
  }, [props.status]);

  useEffect(() => {
    if (props.status === 'loading') {
      setUserScrolledUp(false);
      return;
    }
    if (props.status === 'generating' && isAtBottom) {
      setUserScrolledUp(false);
    }
  }, [props.status, isAtBottom]);

  const showStopButton = Boolean(props.isStreaming);

  return (
    <div className="relative mb-4 h-[100%]">
      <div
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#ccc #f1f5f9', // Firefox: thumb color, track color (slate-300, slate-100)
        }}
        ref={messageRef}
        className={`flex w-full flex-1 flex-col gap-8 overflow-y-auto overflow-x-hidden rounded-[4px] ${props.className || 'h-[70vh]'} lg:h-[64vh]`}>
        <Typewriter
          messages={props.messages}
          currentCoin={props.currentCoin}
          status={props.status}
          isStreaming={props.isStreaming}
          initNode={props.initNode}
          loadingClassName="h-[64vh]"
          initClassName="h-[64vh]"
          initNodeClassName="h-[64vh]"
        />
      </div>

      <div
        className="absolute bottom-[20px] right-[50%] mr-[-20px] lg:bottom-[20px] lg:right-[20px] lg:mr-[0]"
        style={{
          opacity: showStopButton ? 1 : 0,
          pointerEvents: showStopButton ? 'auto' : 'none',
          transition: 'opacity 0.2s ease-in-out',
        }}>
        <ConfirmPopover open={open} onConfirm={handleConfirm} title={labels.stopGenerationTip} okText={labels.gotIt}>
          <StopButton onClick={props.stopCreation} />
        </ConfirmPopover>
      </div>
    </div>
  );
};
