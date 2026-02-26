// Export the new Context-based implementation
export { useI18n, I18nProvider } from './i18n/I18nProvider';

// Keep the old implementation for backwards compatibility (can be removed later)
export { useI18n as useI18nOld } from './i18n/useI18n';

export { locales, getBrowserLocale, STORAGE_KEY } from './i18n/index';
export type { Locale, LocaleMessages } from './i18n/index';
export { localeOptions, getLocaleOption } from './i18n/localeOptions';
