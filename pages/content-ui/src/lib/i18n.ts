// Export the new Context-based implementation
export { useI18n, I18nProvider } from './i18n/I18nProvider';

export { locales, getBrowserLocale, getLocaleTag, STORAGE_KEY } from './i18n/index';
export type { Locale, LocaleMessages } from './i18n/index';
export { localeOptions, getLocaleOption } from './i18n/localeOptions';
