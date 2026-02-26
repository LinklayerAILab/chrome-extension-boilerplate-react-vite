import {
  forwardRef,
  useState,
  useRef,
  useEffect,
  ReactNode,
  useCallback,
  createContext,
  useContext,
  isValidElement,
  useMemo,
} from 'react';
import type { CSSProperties, MouseEvent, ReactElement } from 'react';
import { classNames } from './utils';
import { Portal } from './Portal';

export interface SelectOption {
  label: ReactNode;
  displayLabel?: ReactNode;
  value: string | number;
  disabled?: boolean;
}

interface SelectContextValue {
  onSelect: (value: string | number, option: SelectOption) => void;
  currentValue: string | number | null;
}

const SelectContext = createContext<SelectContextValue | null>(null);

export interface SelectProps {
  options?: SelectOption[];
  value?: string | number | null;
  defaultValue?: string | number;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  size?: 'large' | 'middle' | 'small';
  variant?: 'outlined' | 'borderless' | 'filled';
  className?: string;
  style?: CSSProperties;
  inputClassName?: string;
  onChange?: (value: string | number, option: SelectOption) => void;
  onClear?: () => void;
  dropdownRender?: (menu: ReactNode) => ReactNode;
  dropdownClassName?: string;
  dropdownStyle?: CSSProperties;
  children?: ReactNode;
}

export interface SelectOptionProps {
  value: string | number;
  disabled?: boolean;
  children: ReactNode;
  label?: ReactNode;
}

const sizeClasses = {
  large: 'h-12 px-3 text-base',
  middle: 'h-10 px-3 text-sm',
  small: 'h-8 px-2 text-xs',
};

const variantClasses = {
  outlined: 'bg-white border-black focus:border-[#7A9900] focus:shadow-outline',
  borderless: 'bg-transparent border-transparent focus:border-transparent focus:shadow-none',
  filled: 'bg-gray-100 border-transparent focus:bg-white focus:border-[#7A9900]',
};

export const Select = forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      options = [],
      value: controlledValue,
      defaultValue,
      placeholder = 'Please select',
      disabled = false,
      allowClear = false,
      size = 'middle',
      variant = 'outlined',
      className,
      style,
      inputClassName,
      onChange,
      onClear,
      dropdownRender,
      dropdownClassName,
      dropdownStyle: dropdownStyleProp,
      ...restProps
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [internalValue, setInternalValue] = useState<string | number | null>(defaultValue ?? null);
    const isControlled = controlledValue !== undefined;
    const currentValue = isControlled ? controlledValue : internalValue;

    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Collect options from children (Select.Option components)
    const optionsFromChildren = useCallback(() => {
      if (!restProps.children) return [];

      const childrenArray = Array.isArray(restProps.children) ? restProps.children : [restProps.children];

      return childrenArray
        .filter((child): child is ReactElement => isValidElement(child) && child.type === Option)
        .map(child => ({
          label: child.props.label !== undefined ? child.props.label : child.props.children,
          value: child.props.value,
          disabled: child.props.disabled || false,
        }));
    }, [restProps.children]);

    // Use options from children if options prop is not provided
    const effectiveOptions = options.length > 0 ? options : optionsFromChildren();
    const selectedOption = effectiveOptions.find(opt => opt.value === currentValue);
    const selectedOptionLabel = selectedOption?.displayLabel ?? selectedOption?.label;

    // Find the selected Option's children for rendering in the display
    const selectedOptionChildren = useMemo(() => {
      if (!restProps.children || !currentValue) return null;

      const childrenArray = Array.isArray(restProps.children) ? restProps.children : [restProps.children];

      const selectedChild = childrenArray.find(
        child => isValidElement(child) && child.type === Option && child.props.value === currentValue,
      );

      return selectedChild && isValidElement(selectedChild) ? selectedChild.props.children : null;
    }, [restProps.children, currentValue]);

    const handleSelect = useCallback(
      (value: string | number, option: SelectOption) => {
        if (option.disabled || disabled) return;

        if (!isControlled) {
          setInternalValue(value);
        }
        setIsOpen(false);
        onChange?.(value, option);
      },
      [disabled, isControlled, onChange],
    );

    const contextValue: SelectContextValue = {
      onSelect: handleSelect,
      currentValue,
    };

    const handleClear = useCallback(
      (e: MouseEvent) => {
        e.stopPropagation();
        if (!isControlled) {
          setInternalValue(null);
        }
        setIsOpen(false);
        onClear?.();
      },
      [isControlled, onClear],
    );

    const handleClick = () => {
      if (!disabled) {
        setIsOpen(!isOpen);
      }
    };

    // Handle click outside to close dropdown
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (!containerRef.current || !dropdownRef.current) return;

        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        const clickedInside =
          (path.length > 0 && (path.includes(containerRef.current) || path.includes(dropdownRef.current))) ||
          containerRef.current.contains(event.target as Node) ||
          dropdownRef.current.contains(event.target as Node);

        if (!clickedInside) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
        };
      }
    }, [isOpen]);

    // Position dropdown
    const [dropdownPositionStyle, setDropdownPositionStyle] = useState<CSSProperties>({});
    useEffect(() => {
      if (isOpen && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDropdownPositionStyle({
          position: 'fixed',
          top: `${rect.bottom + 4}px`,
          left: `${rect.left}px`,
          width: `${rect.width}px`,
          zIndex: 10000,
        });
      }
    }, [isOpen]);

    const renderDropdown = () => {
      // Check if using children (Select.Option)
      const hasOptionChildren =
        restProps.children && Array.isArray(restProps.children)
          ? restProps.children.some(child => isValidElement(child) && child.type === Option)
          : isValidElement(restProps.children) && restProps.children.type === Option;

      const menu = (
        <SelectContext.Provider value={contextValue}>
          <div
            ref={dropdownRef}
            style={{
              ...dropdownPositionStyle,
              ...dropdownStyleProp,
              scrollbarWidth: 'thin',
              scrollbarColor: '#ccc #f1f5f9',
            }}
            className={classNames(
              'max-h-60 overflow-auto rounded-md border shadow-lg',
              dropdownClassName || 'custom-scrollbar-light border-gray-200 bg-white',
            )}>
            {hasOptionChildren
              ? // Render children (Select.Option components)
                restProps.children
              : // Render from options array
                effectiveOptions.map((option, index) => (
                  <div
                    key={`${option.value}-${index}`}
                    className={classNames(
                      'px-3 py-2 transition-colors',
                      option.disabled ? 'cursor-not-allowed text-gray-300' : 'cursor-pointer',
                      option.disabled ? '' : 'hover:bg-[#eee]',
                      option.value === currentValue && '!bg-[#cf0]',
                    )}
                    style={{
                      color: option.disabled ? '#d1d5db' : '#374151',
                    }}
                    onClick={() => handleSelect(option.value, option)}>
                    <div className="flex w-full items-center justify-between">{option.label}</div>
                  </div>
                ))}
            {effectiveOptions.length === 0 && !hasOptionChildren && (
              <div className="px-3 py-2 text-center text-gray-400">No data</div>
            )}
          </div>
        </SelectContext.Provider>
      );

      return dropdownRender ? dropdownRender(menu) : menu;
    };

    return (
      <div ref={containerRef} className={classNames('relative', className)} style={style} {...restProps}>
        <div
          ref={ref}
          className={classNames(
            'inline-flex w-full cursor-pointer items-center justify-between rounded-[6px] border-2 border-solid transition-all duration-200',
            'focus:shadow-outline focus:border-[#7A9900]',
            disabled && 'cursor-not-allowed opacity-60',
            sizeClasses[size],
            variantClasses[variant],
          )}
          onClick={handleClick}>
          <span
            className={classNames(
              'flex-1 select-none',
              inputClassName || (selectedOption ? 'text-black' : 'text-gray-400'),
            )}>
            {selectedOptionChildren || (selectedOption ? selectedOptionLabel : placeholder)}
          </span>

          {allowClear && currentValue && !disabled && (
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

          <svg
            className={classNames(
              'ml-2 h-4 w-4 text-gray-400 transition-transform duration-200',
              isOpen && 'rotate-180 transform',
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {isOpen && (
          <Portal
            container={
              containerRef.current?.getRootNode() instanceof ShadowRoot ? containerRef.current.getRootNode() : null
            }>
            {renderDropdown()}
          </Portal>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';

// Select.Option component
export const Option = forwardRef<HTMLDivElement, SelectOptionProps>(
  ({ value, disabled = false, children, label }, ref) => {
    const context = useContext(SelectContext);

    if (!context) {
      console.warn('Select.Option must be used within a Select component');
      return null;
    }

    const { onSelect, currentValue } = context;
    const isSelected = value === currentValue;

    // Use provided label or fallback to children
    const optionLabel = label !== undefined ? label : children;

    return (
      <div
        ref={ref}
        className={classNames(
          'px-3 py-2 transition-colors',
          disabled ? 'cursor-not-allowed text-gray-300' : 'cursor-pointer text-gray-700',
          disabled ? '' : 'hover:bg-[#eee]',
          isSelected && '!bg-[#cf0]',
        )}
        onClick={() => !disabled && onSelect(value, { label: optionLabel, value, disabled })}>
        {children}
      </div>
    );
  },
);

Option.displayName = 'Option';

Select.Option = Option;
