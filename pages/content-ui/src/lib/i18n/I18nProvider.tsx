import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Locale, LocaleMessages } from './index';
import { locales, getBrowserLocale, STORAGE_KEY } from './index';

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

  useEffect(() => {
    // Only run once
    if (isInitialized) return;

    const loadSavedLocale = () => {
      try {
        chrome.storage.local.get([STORAGE_KEY], result => {
          console.log('[I18nProvider] Loading saved locale:', result[STORAGE_KEY], 'STORAGE_KEY:', STORAGE_KEY);
          if (result[STORAGE_KEY]) {
            const savedLocale = result[STORAGE_KEY] as Locale;
            if (savedLocale in locales) {
              console.log('[I18nProvider] Setting locale from storage:', savedLocale);
              setLocaleState(savedLocale);
              setMessages(locales[savedLocale]);
            }
          }
          setIsInitialized(true);
        });
      } catch (error) {
        console.error('Failed to load locale from storage:', error);
        setIsInitialized(true);
      }
    };

    loadSavedLocale();

    // Listen for storage changes (sync across contexts)
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      console.log('[I18nProvider] Storage changed:', { changes, areaName, STORAGE_KEY });
      if (areaName === 'local' && STORAGE_KEY in changes) {
        const newLocale = changes[STORAGE_KEY].newValue as Locale;
        console.log('[I18nProvider] Locale change detected:', newLocale);
        if (newLocale && newLocale in locales) {
          console.log('[I18nProvider] Updating locale to:', newLocale);
          setLocaleState(newLocale);
          setMessages(locales[newLocale]);
        }
      }
    };

    console.log('[I18nProvider] Adding storage listener');
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      console.log('[I18nProvider] Removing storage listener');
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [isInitialized]);

  const changeLocale = (newLocale: Locale) => {
    console.log('[I18nProvider] changeLocale called:', newLocale, 'STORAGE_KEY:', STORAGE_KEY);
    if (newLocale in locales) {
      setLocaleState(newLocale);
      setMessages(locales[newLocale]);

      // Save to chrome.storage
      try {
        chrome.storage.local.set({ [STORAGE_KEY]: newLocale }, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to save locale:', chrome.runtime.lastError);
          } else {
            console.log('[I18nProvider] Locale saved to storage:', newLocale);
          }
        });
      } catch (error) {
        console.error('Failed to save locale to storage:', error);
      }
    }
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
