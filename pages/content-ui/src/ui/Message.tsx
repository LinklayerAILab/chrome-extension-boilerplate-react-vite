import { createRoot, Root } from 'react-dom/client';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { classNames } from './utils';

export type MessageType = 'success' | 'info' | 'warning' | 'error' | 'loading';

export interface MessageInstance {
  success: (content: ReactNode, duration?: number) => void;
  error: (content: ReactNode, duration?: number) => void;
  info: (content: ReactNode, duration?: number) => void;
  warning: (content: ReactNode, duration?: number) => void;
  loading: (content: ReactNode, duration?: number) => void;
}

const messageContainerId = 'content-ui-message-container';

// 确保消息容器存在于根节点的 relative text-black 元素内
const ensureContainer = (): HTMLElement => {
  // 尝试在 Shadow DOM 中查找根节点
  const shadowHost = document.getElementById('sidepanel-shadow-host');
  let rootElement: HTMLElement | null = null;
  let panelElement: HTMLElement | null = null;

  if (shadowHost?.shadowRoot) {
    // 在 Shadow Root 中查找 relative text-black 元素
    rootElement = shadowHost.shadowRoot.querySelector('.relative.text-black');
    panelElement = shadowHost.shadowRoot.querySelector('[data-popover-boundary]');
  }

  let container: HTMLElement | null = null;

  if (panelElement) {
    panelElement.style.overflow = 'visible';
    // 在根节点内查找或创建容器
    container = panelElement.querySelector(`#${messageContainerId}`);

    if (!container) {
      container = document.createElement('div');
      container.id = messageContainerId;
      // 使用 absolute 定位，在根节点右侧，从顶部开始
      container.className = 'absolute top-4 right-4 z-[99999] flex flex-col gap-2';
      container.style.cssText =
        'position: absolute; top: 1rem; right: 1rem; z-index: 99999; display: flex; flex-direction: column; gap: 0.5rem; max-width: 400px;';
      panelElement.appendChild(container);
    }
  } else if (rootElement) {
    // 鍦ㄦ牴鑺傜偣鍐呮煡鎵炬垨鍒涘缓瀹瑰櫺
    container = rootElement.querySelector(`#${messageContainerId}`);

    if (!container) {
      container = document.createElement('div');
      container.id = messageContainerId;
      container.className = 'absolute top-4 right-4 z-[99999] flex flex-col gap-2';
      container.style.cssText =
        'position: absolute; top: 1rem; right: 1rem; z-index: 99999; display: flex; flex-direction: column; gap: 0.5rem; max-width: 400px;';
      rootElement.appendChild(container);
    }
  } else {
    // 回退方案：在 body 中创建（fixed 定位，右侧）
    container = document.getElementById(messageContainerId);

    if (!container) {
      container = document.createElement('div');
      container.id = messageContainerId;
      container.className = 'fixed top-4 right-4 z-[99999] flex flex-col gap-2';
      container.style.cssText =
        'position: fixed; top: 1rem; right: 1rem; z-index: 99999; display: flex; flex-direction: column; gap: 0.5rem; max-width: 400px;';
      document.body.appendChild(container);
    }
  }

  return container;
};

interface MessageProps {
  content: ReactNode;
  type: MessageType;
  duration?: number;
  onClose?: () => void;
}

const MessageItem = ({ content, type, duration = 3, onClose }: MessageProps) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const showTimeout = window.setTimeout(() => {
      setVisible(true);
    }, 0);
    if (duration > 0 && type !== 'loading') {
      timerRef.current = setTimeout(() => {
        handleClose();
      }, duration * 1000);
    }

    return () => {
      clearTimeout(showTimeout);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [duration, type]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      onClose?.();
    }, 300); // 增加动画时间匹配过渡效果
  };

  const typeStyles = {
    success: 'text-black',
    error: 'text-black',
    info: 'text-black',
    warning: 'text-black',
    loading: 'text-black',
  };

  const typeIcons = {
    success: (
      <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
    ),
    error: (
      <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
    ),
    info: (
      <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
    ),
    warning: (
      <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    ),
    loading: (
      <svg className="h-5 w-5 animate-spin text-gray-600" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    ),
  };

  return (
    <div
      ref={itemRef}
      className={classNames(
        'pointer-events-auto inline-flex min-w-[200px] max-w-md items-center gap-2 rounded bg-white px-4 py-3 shadow-xl transition-all duration-300',
        typeStyles[type],
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
      )}>
      {typeIcons[type]}
      <span className="flex-1 text-sm font-medium">{content}</span>
      <button type="button" className="ml-2 text-gray-400 hover:text-gray-600" onClick={handleClose}>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

const showMessage = (content: ReactNode, type: MessageType, duration = 3): (() => void) => {
  const container = ensureContainer();
  const wrapper = document.createElement('div');
  container.appendChild(wrapper);

  const root = createRoot(wrapper);

  const close = () => {
    root.unmount();
    wrapper.remove();

    // Remove container if empty
    if (container.children.length === 0) {
      container.remove();
    }
  };

  root.render(<MessageItem content={content} type={type} duration={duration} onClose={close} />);

  return close;
};

const message: MessageInstance = {
  success: (content: ReactNode, duration?: number) => showMessage(content, 'success', duration),
  error: (content: ReactNode, duration?: number) => showMessage(content, 'error', duration),
  info: (content: ReactNode, duration?: number) => showMessage(content, 'info', duration),
  warning: (content: ReactNode, duration?: number) => showMessage(content, 'warning', duration),
  loading: (content: ReactNode, duration?: number) => showMessage(content, 'loading', duration),
};

export default message;
export { MessageItem };
