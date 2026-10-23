import { useEffect, useState } from 'react';
import { LOCALE_STORAGE_KEY, detectBrowserLocale, getTexts, isSupportedLocale, type MessageLocale } from './i18n';

/**
 * 读取项目当前语言。
 *
 * 数据源与 content-ui 的 I18nProvider 同一个 chrome.storage 键，
 * 所以用户在侧边栏切换语言后，options 刷新（或 storage 变更回调触发时）即为新语言。
 * 存储为空时用浏览器语言，与 content-ui 的 getBrowserLocale 行为一致。
 */
export const useMessageLocale = () => {
  const [locale, setLocale] = useState<MessageLocale>(detectBrowserLocale);

  useEffect(() => {
    let cancelled = false;

    const apply = (value: unknown) => {
      if (cancelled) return;
      if (isSupportedLocale(value)) setLocale(value);
    };

    void (async () => {
      try {
        const result = await chrome.storage.local.get([LOCALE_STORAGE_KEY]);
        apply(result[LOCALE_STORAGE_KEY]);
      } catch {
        // 存储不可用：保持浏览器语言
      }
    })();

    // 侧边栏切换语言后本页实时跟随（同一 chrome.storage 区域）
    const handleChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local' || !(LOCALE_STORAGE_KEY in changes)) return;
      apply(changes[LOCALE_STORAGE_KEY].newValue);
    };
    chrome.storage.onChanged.addListener(handleChange);

    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(handleChange);
    };
  }, []);

  return { locale, t: getTexts(locale) };
};
