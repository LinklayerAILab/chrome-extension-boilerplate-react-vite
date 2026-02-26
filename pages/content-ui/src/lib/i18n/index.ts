import { en } from './locales/en';
import { ko } from './locales/ko';
import { ja } from './locales/ja';
import { zh } from './locales/zh';
import { ru } from './locales/ru';
import type { LocaleMessages } from './types';
import { LOCALE_KEY } from '@src/lib/storageKeys';

export type Locale = 'en' | 'ko' | 'ja' | 'zh' | 'ru';

export const locales: Record<Locale, LocaleMessages> = {
  en,
  ko,
  ja,
  zh,
  ru,
} as const;

export type { LocaleMessages };

export const defaultLocale: Locale = 'en';

// Get browser language
export const getBrowserLocale = (): Locale => {
  const browserLang = navigator.language.split('-')[0] as Locale;

  // Check if browser language is supported
  if (browserLang in locales) {
    return browserLang;
  }

  return defaultLocale;
};

// Storage key
export const STORAGE_KEY = LOCALE_KEY;
