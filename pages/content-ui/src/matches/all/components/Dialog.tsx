import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

const Dialog = ({ isOpen, onClose, children }: DialogProps) => {
  // 获取 layout-box 元素
  const [layoutBox, setLayoutBox] = useState<HTMLElement | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  // 组件初始化时就查找 layout-box
  useLayoutEffect(() => {
    console.log('[Dialog] Component mounted, looking for layout-box...');

    // 尝试在所有 Shadow DOM 中查找 layout-box
    const findInShadowDOMs = (): HTMLElement | null => {
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const shadowRoot = (el as any).shadowRoot;
        if (shadowRoot) {
          const found = shadowRoot.getElementById('layout-box');
          if (found) {
            console.log('[Dialog] ✓ Found layout-box in Shadow DOM of:', el);
            return found as HTMLElement;
          }
        }
      }
      return null;
    };

    // 立即尝试查找
    let element = document.getElementById('layout-box');
    if (!element) {
      element = findInShadowDOMs();
    }

    if (element) {
      console.log('[Dialog] ✓ Found layout-box on mount:', element);
      setLayoutBox(element);
      return;
    }

    console.log('[Dialog] layout-box not found on mount, setting up observer...');

    // 创建 MutationObserver 持续监听（包括 Shadow DOM）
    const observer = new MutationObserver(() => {
      let el = document.getElementById('layout-box');
      if (!el) {
        el = findInShadowDOMs();
      }

      if (el) {
        console.log('[Dialog] ✓ Found layout-box via observer:', el);
        setLayoutBox(el);
        observer.disconnect();
        observerRef.current = null;
      }
    });

    observerRef.current = observer;

    // 观察整个 document
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 3秒后如果还没找到，回退到 body
    const timeout = setTimeout(() => {
      let el = document.getElementById('layout-box');
      if (!el) {
        el = findInShadowDOMs();
      }

      if (el) {
        console.log('[Dialog] ✓ Found layout-box on timeout:', el);
        setLayoutBox(el);
      } else {
        observer.disconnect();
        observerRef.current = null;
        console.error('[Dialog] ✗ layout-box not found after 3s, falling back to body');
        setLayoutBox(document.body);
      }
    }, 3000);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, []); // 只在组件挂载时执行一次

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  if (!layoutBox) {
    console.log('[Dialog] Not rendering: layoutBox is null');
    return null;
  }

  console.log('[Dialog] Rendering dialog with layoutBox:', layoutBox);

  const dialogContent = (
    <div className="pointer-events-auto absolute inset-0 z-[10000] flex items-center justify-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 cursor-pointer bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[10001] w-[92vw] max-w-[400px] rounded-[12px] bg-white p-[16px] shadow-2xl">
        {children}
      </div>
    </div>
  );

  return createPortal(dialogContent, layoutBox);
};

export default Dialog;
