import type { SelectOption } from '@src/ui';
import type { Locale } from './index';

export const localeOptions: SelectOption[] = [
  { label: 'English', value: 'en' },
  { label: '한국어', value: 'ko' },
  { label: '日本語', value: 'ja' },
  { label: '中文', value: 'zh' },
  { label: 'Русский', value: 'ru' },
] as const;

export const getLocaleOption = (locale: Locale): SelectOption => {
  return localeOptions.find(opt => opt.value === locale) || localeOptions[0];
};
