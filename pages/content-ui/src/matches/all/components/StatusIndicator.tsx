import { useMemo } from 'react';

interface StatusIndicatorProps {
  statusColor?: 'GREEN' | 'RED' | 'YELLOW';
  size?: number; // 宽高，默认48
  borderWidth?: number; // 边框宽度，默认2
  className?: string;
}

export const StatusIndicator = ({ statusColor, size = 48, borderWidth = 2, className = '' }: StatusIndicatorProps) => {
  const randomDelay = useMemo(() => (Math.random() * 1 + 0.5).toFixed(2), []);

  const renderClass = (str?: string) => {
    if (str === 'GREEN') return 'gradientFade1';
    if (str === 'RED') return 'gradientFade2';
    if (str === 'YELLOW') return 'gradientFade3';
    return '';
  };

  return (
    <div
      className={`alpha-status rounded-full border-solid border-black ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderWidth: `${borderWidth}px`,
        animation: statusColor ? `${renderClass(statusColor)} 4s ease-in-out ${randomDelay}s infinite` : undefined,
      }}
    />
  );
};
