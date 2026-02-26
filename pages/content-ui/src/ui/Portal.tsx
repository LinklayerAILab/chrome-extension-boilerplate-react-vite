import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface PortalProps {
  children: React.ReactNode;
  className?: string;
  container?: Element | DocumentFragment | null;
}

export const Portal = ({ children, className, container }: PortalProps) => {
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create container element
    const hostElement = document.createElement('div');
    if (className) {
      hostElement.className = className;
    }
    const parent = container ?? document.body;
    parent.appendChild(hostElement);
    setHost(hostElement);

    return () => {
      if (hostElement.parentNode) {
        hostElement.parentNode.removeChild(hostElement);
      }
    };
  }, [className, container]);

  if (!host) return null;
  return createPortal(children, host);
};
