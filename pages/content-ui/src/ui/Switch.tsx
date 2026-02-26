import { InputHTMLAttributes, forwardRef, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { classNames } from './utils';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  size?: 'small' | 'default';
  checkedChildren?: React.ReactNode;
  unCheckedChildren?: React.ReactNode;
  onChange?: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      size = 'default',
      checked: controlledChecked,
      defaultChecked = false,
      checkedChildren,
      unCheckedChildren,
      disabled = false,
      className,
      style,
      onChange,
      ...restProps
    },
    ref,
  ) => {
    const [internalChecked, setInternalChecked] = useState(defaultChecked);

    const isControlled = controlledChecked !== undefined;
    const checked = isControlled ? controlledChecked : internalChecked;

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;

        if (!isControlled) {
          setInternalChecked(e.target.checked);
        }

        onChange?.(e.target.checked, e);
      },
      [disabled, isControlled, onChange],
    );

    const sizeTokens =
      size === 'small'
        ? { width: 28, height: 16, handle: 12, padding: 2 }
        : { width: 40, height: 22, handle: 18, padding: 2 };

    const trackInset = size === 'small' ? 3 : 4;
    const containerStyle: CSSProperties = {
      width: sizeTokens.width,
      height: sizeTokens.height,
    };

    const trackStyle: CSSProperties = {
      width: sizeTokens.width - trackInset * 2,
      height: sizeTokens.height - trackInset * 2,
      borderRadius: (sizeTokens.height - trackInset * 2) / 2,
      backgroundColor: checked ? '#ABCB2F' : '#BBBDBF',
      transition: 'background-color 200ms ease-in-out',
      boxSizing: 'border-box',
    };

    const handleTranslate = checked ? sizeTokens.width - sizeTokens.handle - sizeTokens.padding * 2 : 0;

    const handleStyle: CSSProperties = {
      width: sizeTokens.handle,
      height: sizeTokens.handle,
      borderRadius: '50%',
      backgroundColor: checked ? '#cf0' : '#fff',
      border: `1px solid ${checked ? '#A4CC00' : '#BBBDBF'}`,
      transform: `translateX(${handleTranslate}px)`,
      transition: 'transform 200ms ease-in-out',
      boxSizing: 'border-box',
    };

    return (
      <label
        className={classNames(
          'inline-flex select-none items-center gap-2',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
          className,
        )}
        style={style}>
        <div className="relative" style={containerStyle}>
          <input
            ref={ref}
            type="checkbox"
            className="sr-only"
            checked={checked}
            disabled={disabled}
            onChange={handleChange}
            {...restProps}
          />
          <div
            className="absolute"
            style={{
              top: trackInset,
              left: trackInset,
              ...trackStyle,
            }}
          />
          <div
            className="absolute"
            style={{
              top: sizeTokens.padding,
              left: sizeTokens.padding,
              ...handleStyle,
            }}
          />
        </div>
        <span className="text-sm text-gray-700">{checked ? checkedChildren : unCheckedChildren}</span>
      </label>
    );
  },
);

Switch.displayName = 'Switch';
