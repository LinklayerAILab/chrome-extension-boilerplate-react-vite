import { useCallback, useEffect, useState } from 'react';
import { classNames } from './utils';
import message from './Message';
import { useI18n } from '../lib/i18n/useI18n';

// 使用 chrome.runtime.getURL 获取扩展资源
const copyIcon = chrome.runtime.getURL('content-ui/mydata-copy.svg');
const successIcon = chrome.runtime.getURL('content-ui/success.svg');

export interface CopyProps {
  text: string;
  className?: string;
  width?: number;
  height?: number;
  onCopySuccess?: () => void;
  disabled?: boolean;
}

export const Copy = ({ text, className = '', width = 13, height = 13, onCopySuccess, disabled = false }: CopyProps) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const fallbackCopy = useCallback(async (value: string): Promise<boolean> => {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch (error) {
      document.body.removeChild(textarea);
      return false;
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (disabled || !text) return;

    try {
      let success = false;

      // 优先使用 Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        success = true;
      } else {
        // 降级方案：使用 execCommand
        success = await fallbackCopy(text);
      }

      if (success) {
        setCopied(true);
        message.success(t.common.copySuccess || 'Copied to clipboard');
        onCopySuccess?.();

        // 2秒后重置状态
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } else {
        message.error(t.common.copyError || 'Copy failed');
      }
    } catch (error) {
      console.error('Copy failed:', error);
      message.error(t.common.copyError || 'Copy failed');
    }
  }, [disabled, fallbackCopy, onCopySuccess, text, t.common.copySuccess, t.common.copyError]);

  return (
    <div
      className={classNames(
        'inline-flex cursor-pointer items-center justify-center rounded-full bg-[#ccff00] p-[7px] transition-opacity duration-200',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      onClick={handleCopy}
      role={disabled ? undefined : 'button'}
      aria-label={disabled ? undefined : 'Copy to clipboard'}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCopy();
        }
      }}>
      {copied ? (
        <img src={successIcon} width={width} height={height} alt="copied" />
      ) : (
        <img src={copyIcon} width={width} height={height} alt="copy" />
      )}
    </div>
  );
};

export default Copy;
