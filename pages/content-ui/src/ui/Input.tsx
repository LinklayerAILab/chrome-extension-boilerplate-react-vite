import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, useState, ReactNode } from 'react';
import { classNames } from './utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  prefix?: ReactNode;
  suffix?: ReactNode;
  allowClear?: boolean;
  size?: 'large' | 'middle' | 'small';
  variant?: 'outlined' | 'borderless' | 'filled';
  search?: boolean;
  onSearch?: (value: string) => void;
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  allowClear?: boolean;
  variant?: 'outlined' | 'borderless' | 'filled';
}

export interface PasswordProps extends Omit<InputProps, 'type'> {
  visibilityToggle?: boolean;
}

const sizeClasses = {
  large: 'h-[48px] px-3 text-[14px]',
  middle: 'h-[44px] px-3 text-[12px]',
  small: 'h-[40px] px-2 text-[10px]',
};
const fontSizeClasses = {
  large: 'text-[14px]',
  middle: 'text-[12px]',
  small: 'text-[10px]',
};
const variantClasses = {
  outlined: 'bg-white border-black focus:border-[#7A9900] focus:shadow-outline',
  borderless: 'bg-transparent border-transparent focus:border-transparent focus:shadow-none',
  filled: 'bg-gray-100 border-transparent focus:bg-white focus:border-[#7A9900]',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      prefix,
      suffix,
      allowClear,
      size = 'middle',
      variant = 'outlined',
      disabled,
      className,
      value,
      onChange,
      search = false,
      onSearch,
      ...restProps
    },
    ref,
  ) => {
    const [internalValue, setInternalValue] = useState(value ?? '');
    const isControlled = value !== undefined;
    const currentValue = isControlled ? value : internalValue;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setInternalValue(e.target.value);
      }
      onChange?.(e);
    };

    const handleClear = () => {
      const syntheticEvent = {
        target: { value: '' },
      } as React.ChangeEvent<HTMLInputElement>;

      if (!isControlled) {
        setInternalValue('');
      }
      onChange?.(syntheticEvent);
    };

    const handleSearch = () => {
      const searchValue = currentValue?.toString() || '';
      onSearch?.(searchValue);
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && search) {
        handleSearch();
      }
    };

    const hasValue = currentValue !== undefined && currentValue !== '';

    return (
      <div
        className={classNames(
          'inline-flex w-full items-center rounded-[6px] border-2 border-solid transition-all duration-200',
          'focus-within:shadow-outline focus-within:border-[#7A9900]',
          disabled && 'cursor-not-allowed opacity-60',
          sizeClasses[size],
          variantClasses[variant],
          className,
        )}>
        {prefix && <span className="mr-2 flex items-center text-gray-400">{prefix}</span>}

        <input
          ref={ref}
          className={`flex-1 border-none bg-transparent text-gray-700 placeholder-gray-400 outline-none ${fontSizeClasses[size]}`}
          disabled={disabled}
          value={currentValue}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          {...restProps}
        />

        {allowClear && hasValue && !disabled && (
          <button
            type="button"
            className="mr-1 flex items-center text-gray-400 hover:text-gray-600"
            onClick={handleClear}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 9l-6 6M9 9l6 6" />
            </svg>
          </button>
        )}

        {search && (
          <button
            type="button"
            className="ml-2 mr-1 flex items-center text-gray-500 hover:text-gray-700"
            onClick={handleSearch}
            disabled={disabled}>
            <svg className="h-[20px] w-[20px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth="2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35" />
            </svg>
          </button>
        )}

        {suffix && !search && <span className="ml-2 flex items-center text-gray-400">{suffix}</span>}
      </div>
    );
  },
);

Input.displayName = 'Input';

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ allowClear, variant = 'outlined', disabled, className, value, onChange, ...restProps }, ref) => {
    const [internalValue, setInternalValue] = useState(value ?? '');
    const isControlled = value !== undefined;
    const currentValue = isControlled ? value : internalValue;

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!isControlled) {
        setInternalValue(e.target.value);
      }
      onChange?.(e);
    };

    const handleClear = () => {
      const syntheticEvent = {
        target: { value: '' },
      } as React.ChangeEvent<HTMLTextAreaElement>;

      if (!isControlled) {
        setInternalValue('');
      }
      onChange?.(syntheticEvent);
    };

    const hasValue = currentValue !== undefined && currentValue !== '';

    return (
      <div
        className={classNames(
          'relative w-full rounded-[6px] border-2 border-solid transition-all duration-200',
          'focus-within:shadow-outline focus-within:border-[#7A9900]',
          disabled && 'cursor-not-allowed opacity-60',
          'px-3 py-2',
          variantClasses[variant],
          className,
        )}>
        <textarea
          ref={ref}
          className="w-full resize-y border-none bg-transparent text-gray-700 placeholder-gray-400 outline-none"
          disabled={disabled}
          value={currentValue}
          onChange={handleChange}
          {...restProps}
        />

        {allowClear && hasValue && !disabled && (
          <button
            type="button"
            className="absolute right-2 top-2 flex items-center text-gray-400 hover:text-gray-600"
            onClick={handleClear}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 9l-6 6M9 9l6 6" />
            </svg>
          </button>
        )}
      </div>
    );
  },
);

TextArea.displayName = 'TextArea';

export const InputPassword = forwardRef<HTMLInputElement, PasswordProps>(
  ({ visibilityToggle = true, className, ...restProps }, ref) => {
    const [visible, setVisible] = useState(false);

    const toggleVisibility = () => {
      setVisible(!visible);
    };

    const suffix = visibilityToggle ? (
      <button
        type="button"
        className="flex items-center text-gray-500 transition-colors hover:text-gray-700"
        onClick={toggleVisibility}>
        {visible ? (
          <svg className="h-[20px] w-[20px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        ) : (
          <svg className="h-[20px] w-[20px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
            />
          </svg>
        )}
      </button>
    ) : null;

    return (
      <Input ref={ref} type={visible ? 'text' : 'password'} suffix={suffix} className={className} {...restProps} />
    );
  },
);

InputPassword.displayName = 'InputPassword';
