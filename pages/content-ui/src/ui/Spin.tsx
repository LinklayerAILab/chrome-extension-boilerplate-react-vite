import { ReactNode } from 'react';
import { classNames } from './utils';

export interface SpinProps {
  spinning?: boolean;
  size?: 'small' | 'default' | 'large';
  tip?: string;
  delay?: number;
  indicator?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
}

const sizeClasses = {
  small: 'w-4 h-4',
  default: 'w-8 h-8',
  large: 'w-12 h-12',
};

const sizeStrokeClasses = {
  small: 'stroke-2',
  default: 'stroke-2',
  large: 'stroke-2',
};

const DefaultSpinner = ({ size = 'default' }: { size: 'small' | 'default' | 'large' }) => (
  <svg
    className={classNames('animate-spin text-[#7A9900]', sizeClasses[size])}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

export const Spin = ({
  spinning = true,
  size = 'default',
  tip,
  delay,
  indicator,
  className,
  style,
  children,
}: SpinProps) => {
  if (children) {
    return (
      <div className={classNames('relative inline-block', className)} style={style}>
        {spinning && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80">
            {indicator || <DefaultSpinner size={size} />}
            {tip && <div className="mt-2 text-sm text-gray-600">{tip}</div>}
          </div>
        )}
        <div className={classNames({ 'opacity-30': spinning })}>{children}</div>
      </div>
    );
  }

  if (!spinning) {
    return null;
  }

  return (
    <div className={classNames('flex flex-col items-center justify-center', className)} style={style}>
      {indicator || <DefaultSpinner size={size} />}
      {tip && <div className="mt-2 text-sm text-gray-600">{tip}</div>}
    </div>
  );
};
