import { ReactNode, useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { classNames } from './utils';
import { Portal } from './Portal';

export interface PopoverProps {
  content: ReactNode;
  title?: ReactNode;
  trigger?: 'click' | 'hover' | 'focus';
  placement?: 'top' | 'left' | 'right' | 'bottom' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export const Popover = ({
  content,
  title,
  trigger = 'click',
  placement = 'top',
  open: controlledOpen,
  onOpenChange,
  className,
  style,
  children,
}: PopoverProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const [isPositioned, setIsPositioned] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const boundaryRef = useRef<HTMLElement | null>(null);

  const handleToggle = useCallback(() => {
    if (isControlled) {
      onOpenChange?.(!isOpen);
    } else {
      setInternalOpen(!internalOpen);
    }
  }, [isControlled, isOpen, internalOpen, onOpenChange]);

  const handleClose = useCallback(() => {
    if (isControlled) {
      onOpenChange?.(false);
    } else {
      setInternalOpen(false);
    }
  }, [isControlled, onOpenChange]);

  // Calculate position based on placement
  const updatePosition = useCallback(() => {
    if (!containerRef.current || !popoverRef.current || !isOpen) return;

    const rootNode = containerRef.current.getRootNode();
    const localBoundary =
      boundaryRef.current ??
      (containerRef.current.closest('[data-popover-boundary]') as HTMLElement | null) ??
      (rootNode instanceof ShadowRoot
        ? (rootNode.querySelector('[data-popover-boundary]') as HTMLElement | null)
        : null);

    if (localBoundary && boundaryRef.current !== localBoundary) {
      boundaryRef.current = localBoundary;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const popoverRect = popoverRef.current.getBoundingClientRect();
    const popoverWidth = popoverRect.width;
    const popoverHeight = popoverRect.height;
    const gap = 8;

    const boundary = localBoundary ?? boundaryRef.current;
    const position: CSSProperties = {
      position: boundary ? 'absolute' : 'fixed',
      zIndex: 10000,
    };

    const boundaryRect = boundary?.getBoundingClientRect();
    const baseTop = boundaryRect ? containerRect.top - boundaryRect.top : containerRect.top;
    const baseLeft = boundaryRect ? containerRect.left - boundaryRect.left : containerRect.left;
    const baseRight = boundaryRect ? containerRect.right - boundaryRect.left : containerRect.right;
    const boundaryWidth = boundary?.clientWidth ?? boundaryRect?.width ?? window.innerWidth;
    const boundaryHeight = boundary?.clientHeight ?? boundaryRect?.height ?? window.innerHeight;

    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
    const leftSpace = baseLeft;
    const rightSpace = boundaryWidth - baseRight;

    switch (placement) {
      case 'top':
        position.top = baseTop - popoverHeight - gap;
        position.left = baseLeft + containerRect.width / 2 - popoverWidth / 2;
        break;
      case 'topLeft':
        position.top = baseTop - popoverHeight - gap;
        position.left = baseLeft;
        break;
      case 'topRight':
        position.top = baseTop - popoverHeight - gap;
        position.left = baseRight - popoverWidth;
        break;
      case 'bottom':
        position.top = baseTop + containerRect.height + gap;
        position.left = baseLeft + containerRect.width / 2 - popoverWidth / 2;
        break;
      case 'bottomLeft':
        position.top = baseTop + containerRect.height + gap;
        position.left = baseLeft;
        break;
      case 'bottomRight':
        position.top = baseTop + containerRect.height + gap;
        position.left = baseRight - popoverWidth;
        break;
      case 'left':
        position.top = baseTop + containerRect.height / 2 - popoverHeight / 2;
        position.left = baseLeft - popoverWidth - gap;
        break;
      case 'right':
        position.top = baseTop + containerRect.height / 2 - popoverHeight / 2;
        position.left = baseRight + gap;
        break;
    }

    if ((placement === 'topLeft' || placement === 'bottomLeft') && boundaryWidth && position.left !== undefined) {
      const rightEdge = position.left + popoverWidth;
      const maxRight = boundaryWidth - gap;
      const canFitLeft = leftSpace >= popoverWidth + gap;
      const shouldFlipLeft = rightEdge > maxRight || (canFitLeft && leftSpace > rightSpace);
      if (shouldFlipLeft) {
        position.left = baseLeft - popoverWidth - gap;
      }
    }

    if (typeof position.top === 'number') {
      const minTop = gap;
      const maxTop = boundaryHeight - popoverHeight - gap;
      position.top = clamp(position.top, minTop, maxTop);
    }

    if (typeof position.left === 'number') {
      const minLeft = gap;
      const maxLeft = boundaryWidth - popoverWidth - gap;
      position.left = clamp(position.left, minLeft, maxLeft);
    }

    if (placement.startsWith('top') && position.top === gap) {
      const fallbackTop = baseTop + containerRect.height + gap;
      position.top = clamp(fallbackTop, gap, boundaryHeight - popoverHeight - gap);
    }

    setPopoverStyle(position);
    setIsPositioned(true);
  }, [isOpen, placement, title]);

  useEffect(() => {
    if (!isOpen) return;
    setIsPositioned(false);
    const localBoundary = containerRef.current?.closest('[data-popover-boundary]') as HTMLElement | null;
    if (localBoundary) {
      boundaryRef.current = localBoundary;
    } else {
      const rootNode = containerRef.current?.getRootNode();
      if (rootNode instanceof ShadowRoot) {
        boundaryRef.current = rootNode.querySelector('[data-popover-boundary]') as HTMLElement | null;
      } else {
        boundaryRef.current = document.querySelector('[data-popover-boundary]') as HTMLElement | null;
      }
    }
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    let rafId = 0;
    const tryPosition = () => {
      if (!isOpen) return;
      if (popoverRef.current) {
        updatePosition();
      } else {
        rafId = requestAnimationFrame(tryPosition);
      }
    };
    tryPosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    let resizeObserver: ResizeObserver | null = null;
    if (popoverRef.current) {
      resizeObserver = new ResizeObserver(() => updatePosition());
      resizeObserver.observe(popoverRef.current);
    }

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      resizeObserver?.disconnect();
    };
  }, [isOpen, updatePosition]);

  const handlePopoverRef = useCallback(
    (node: HTMLDivElement | null) => {
      popoverRef.current = node;
      if (node) {
        updatePosition();
      }
    },
    [updatePosition],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isOpen || !containerRef.current || !popoverRef.current) return;

      const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
      const clickedInside =
        (path.length > 0 && (path.includes(containerRef.current) || path.includes(popoverRef.current))) ||
        containerRef.current.contains(event.target as Node) ||
        popoverRef.current.contains(event.target as Node);

      if (!clickedInside && trigger === 'click') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, trigger, handleClose]);

  const handleMouseEnter = () => {
    if (trigger === 'hover' && !isOpen) {
      handleToggle();
    }
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover' && isOpen) {
      handleClose();
    }
  };

  const handleFocus = () => {
    if (trigger === 'focus' && !isOpen) {
      handleToggle();
    }
  };

  const handleBlur = () => {
    if (trigger === 'focus' && isOpen) {
      handleClose();
    }
  };

  const getArrowClass = () => {
    const baseClass = 'absolute w-2 h-2 bg-black rotate-45';
    switch (placement) {
      case 'top':
      case 'topLeft':
      case 'topRight':
        return `${baseClass} -bottom-1 left-1/2 -translate-x-1/2`;
      case 'bottom':
      case 'bottomLeft':
      case 'bottomRight':
        return `${baseClass} -top-1 left-1/2 -translate-x-1/2`;
      case 'left':
        return `${baseClass} -right-1 top-1/2 -translate-y-1/2`;
      case 'right':
        return `${baseClass} -left-1 top-1/2 -translate-y-1/2`;
      default:
        return `${baseClass}`;
    }
  };

  return (
    <div
      ref={containerRef}
      className={classNames('relative inline-block', className)}
      style={style}
      onClick={trigger === 'click' ? handleToggle : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}>
      {children}

      {isOpen && (
        <Portal
          container={
            boundaryRef.current ??
            (containerRef.current?.getRootNode() instanceof ShadowRoot ? containerRef.current.getRootNode() : null)
          }>
          <div
            ref={handlePopoverRef}
            style={{
              ...popoverStyle,
              visibility: isPositioned ? 'visible' : 'hidden',
            }}
            className="relative max-w-lg rounded-lg bg-white p-4 shadow-xl"
            onMouseDown={event => event.stopPropagation()}
            onClick={event => event.stopPropagation()}>
            {/* <div className={getArrowClass()} /> */}
            {title && <div className="mb-2 font-medium text-gray-900">{title}</div>}
            <div className="text-sm text-gray-700">{content}</div>
          </div>
        </Portal>
      )}
    </div>
  );
};
