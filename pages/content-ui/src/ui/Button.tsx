import { ButtonHTMLAttributes, forwardRef } from 'react';
import { classNames } from './utils';

export type ButtonType = 'default' | 'primary' | 'dashed' | 'link' | 'text';
export type ButtonSize = 'large' | 'middle' | 'small';
export type ButtonShape = 'default' | 'circle' | 'round';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  type?: ButtonType;
  size?: ButtonSize;
  shape?: ButtonShape;
  danger?: boolean;
  ghost?: boolean;
  loading?: boolean;
  block?: boolean;
  href?: string;
}

const sizeClasses: Record<ButtonSize, string> = {
  large: 'h-[40px] px-8 text-[16px]',
  middle: 'h-[36px] px-4 text-[14px]',
  small: 'h-[32px] px-2 text-[12px]',
};

const typeClasses: Record<ButtonType, string> = {
  default: 'bg-white border-black text-gray-700',
  primary: 'bg-[#ccff00] border-black text-black hover:bg-[#b3e600]',
  dashed: 'bg-white border-dashed border-black text-gray-700',
  link: 'border-transparent text-[#7A9900] shadow-none bg-transparent',
  text: 'border-transparent text-gray-700 shadow-none bg-transparent',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      type = 'default',
      size = 'middle',
      shape = 'default',
      danger = false,
      ghost = false,
      loading = false,
      block = false,
      disabled,
      className,
      children,
      ...restProps
    },
    ref,
  ) => {
    const isLink = type === 'link' || type === 'text';

    const baseClasses = classNames(
      'inline-flex items-center justify-center gap-2 font-normal transition-all duration-200 cursor-pointer border select-none',
      'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:not-allowed',
      'focus:outline-none focus:shadow-outline',
      sizeClasses[size],
      typeClasses[type],
      {
        'rounded-md': shape === 'default',
        'rounded-full': shape === 'circle' || shape === 'round',
        'rounded-[10px]': shape === 'round',
        'w-full': block,
        'border border-solid': !isLink,
        'shadow-[0px_3px_0px_0px_rgba(0,0,0,1)]': !isLink && !ghost,
        'hover:shadow-none hover:translate-y-[3px]': !isLink && !ghost,
      },
      danger && type === 'primary' && 'bg-red-500 border-red-500 text-white hover:bg-red-600',
      danger && type !== 'primary' && 'border-red-500 text-red-500 hover:border-red-600 hover:text-red-600',
      ghost &&
        type === 'primary' &&
        'bg-transparent border-[#7A9900] text-[#7A9900] hover:bg-[#7A9900] hover:text-white',
      ghost && type !== 'primary' && 'bg-transparent border-gray-300 text-gray-700 hover:bg-gray-100',
      className,
    );

    const content = loading ? (
      <>
        <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        {children}
      </>
    ) : (
      children
    );

    if (restProps.href) {
      return (
        <a ref={ref as any} className={baseClasses} {...restProps}>
          {content}
        </a>
      );
    }

    return (
      <button ref={ref} className={baseClasses} disabled={disabled || loading} {...restProps}>
        {content}
      </button>
    );
  },
);

Button.displayName = 'Button';
