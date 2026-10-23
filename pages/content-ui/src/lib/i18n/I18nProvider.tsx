import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Locale, LocaleMessages } from './index';
import { locales, getBrowserLocale, STORAGE_KEY } from './index';
import { LOCALE_KEY } from '@src/lib/storageKeys';
import { getGuardPushLang, putGuardPushLang } from '@src/api/guardLang';

interface I18nContextType {
  locale: Locale;
  messages: LocaleMessages;
  changeLocale: (locale: Locale) => void;
  t: LocaleMessages;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(getBrowserLocale);
  const [messages, setMessages] = useState<LocaleMessages>(locales[locale]);
  const [isInitialized, setIsInitialized] = useState(false);

  const syncLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    setMessages(locales[newLocale]);
    window.localStorage.setItem(LOCALE_KEY, newLocale);
  };

  useEffect(() => {
    // Only run once
    if (isInitialized) return;

    /**
     * 初始化优先级：
     *   ① 服务端用户级设置（manual=true 时覆盖本地，全设备统一）
     *   ② 本地已保存的语言（chrome.storage）
     *   ③ 浏览器语言（getBrowserLocale，state 初值）
     *
     * 服务端为 auto 表示「跟随设备」。此时若用户尚未在服务端设置过语言，
     * 把本地生效的语言首次回传，让推送也按这个语言渲染（否则服务端只能
     * 按订阅时上报的设备语言，可能与界面语言不一致）。
     */
    const loadSavedLocale = async () => {
      let localLocale: Locale | undefined;
      try {
        const result = await chrome.storage.local.get([STORAGE_KEY]);
        const saved = result[STORAGE_KEY] as Locale | undefined;
        if (saved && saved in locales) localLocale = saved;
      } catch (error) {
        console.error('Failed to load locale from storage:', error);
      }

      const server = await getGuardPushLang();

      if (server?.manual && server.locale !== 'auto') {
        // 服务端显式设置：全设备统一，覆盖本地
        syncLocale(server.locale);
        setIsInitialized(true);
        return;
      }

      // 服务端 auto：本地有值用它，否则用浏览器语言
      const effective = localLocale ?? getBrowserLocale();
      if (localLocale) syncLocale(localLocale);

      // 服务端尚未设置语言：把本地生效的语言传上去，让推送语言与界面一致。
      // 首次推送后服务端变为 manual，之后的打开会走上面的分支，不会重复 PUT。
      // server === null 表示未登录或请求失败，此时不写，避免把默认值误存进数据库。
      if (server && server.locale === 'auto') {
        void putGuardPushLang(effective);
      }

      setIsInitialized(true);
    };

    void loadSavedLocale();

    // Listen for storage changes (sync across contexts)
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && STORAGE_KEY in changes) {
        const newLocale = changes[STORAGE_KEY].newValue as Locale;
        if (newLocale && newLocale in locales) {
          syncLocale(newLocale);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [isInitialized]);

  const changeLocale = (newLocale: Locale) => {
    if (!(newLocale in locales)) return;

    syncLocale(newLocale);

    // 保存到本地存储（跨上下文同步）
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: newLocale }, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to save locale:', chrome.runtime.lastError);
        }
      });
    } catch (error) {
      console.error('Failed to save locale to storage:', error);
    }

    // 同步到服务端：推送语言对全部设备生效。
    // 失败静默——本地语言已切换，不影响当前使用，下次切换会再试。
    void putGuardPushLang(newLocale);
  };

  const t = messages;

  if (!isInitialized) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-gray-800 border-t-transparent"
          aria-label="Loading"
        />
      </div>
    );
  }

  return <I18nContext.Provider value={{ locale, messages, changeLocale, t }}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
};
