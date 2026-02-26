import { useEffect, useState } from 'react';
import type { Locale, LocaleMessages } from './index';
import { locales, getBrowserLocale, STORAGE_KEY } from './index';

export const useI18n = () => {
  const [locale, setLocaleState] = useState<Locale>(getBrowserLocale);
  const [messages, setMessages] = useState<LocaleMessages>(locales[locale]);

  // Load saved locale from storage on mount
  useEffect(() => {
    const loadSavedLocale = () => {
      try {
        chrome.storage.local.get([STORAGE_KEY], result => {
          console.log('[useI18n] Loading saved locale:', result[STORAGE_KEY], 'STORAGE_KEY:', STORAGE_KEY);
          if (result[STORAGE_KEY]) {
            const savedLocale = result[STORAGE_KEY] as Locale;
            if (savedLocale in locales) {
              console.log('[useI18n] Setting locale from storage:', savedLocale);
              setLocaleState(savedLocale);
              setMessages(locales[savedLocale]);
            }
          }
        });
      } catch (error) {
        console.error('Failed to load locale from storage:', error);
      }
    };

    loadSavedLocale();

    // Listen for storage changes to sync locale across all components
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      console.log('[useI18n] Storage changed:', { changes, areaName, STORAGE_KEY });
      if (areaName === 'local' && STORAGE_KEY in changes) {
        const newLocale = changes[STORAGE_KEY].newValue as Locale;
        console.log('[useI18n] Locale change detected:', newLocale);
        if (newLocale && newLocale in locales) {
          console.log('[useI18n] Updating locale to:', newLocale);
          setLocaleState(newLocale);
          setMessages(locales[newLocale]);
        }
      }
    };

    console.log('[useI18n] Adding storage listener');
    chrome.storage.onChanged.addListener(handleStorageChange);

    // Cleanup listener on unmount
    return () => {
      console.log('[useI18n] Removing storage listener');
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // Change locale and save to storage
  const changeLocale = (newLocale: Locale) => {
    console.log('[useI18n] changeLocale called:', newLocale, 'STORAGE_KEY:', STORAGE_KEY);
    if (newLocale in locales) {
      setLocaleState(newLocale);
      setMessages(locales[newLocale]);

      // Save to chrome.storage
      try {
        chrome.storage.local.set({ [STORAGE_KEY]: newLocale }, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to save locale:', chrome.runtime.lastError);
          } else {
            console.log('[useI18n] Locale saved to storage:', newLocale);
          }
        });
      } catch (error) {
        console.error('Failed to save locale to storage:', error);
      }
    }
  };

  const t = messages;

  return {
    locale,
    changeLocale,
    t,
  };
};
