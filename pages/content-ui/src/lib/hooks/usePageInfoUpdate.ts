import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@src/store';
import { setPageInfo } from '@src/store/slices/pageInfoSlice';
import { updateAllPageInfo } from '@src/store/slices/pageInfoSlice';
import type { Locale } from '@src/lib/i18n';
import { locales } from '@src/lib/i18n';

/**
 * Hook to listen for language change events and update page info translations
 * Call this in page components (Alpha, AddApi, Earn, Perps, Poliet) to auto-update titles/descriptions
 * Also initializes pageInfo on first render with current locale
 *
 * @param pageKey - The page key in pageInfo store (e.g., 'alpha', 'api', 'earn', 'perps', 'poliet', 'points')
 * @param locale - Current locale for initial update
 */
export const usePageInfoUpdate = (pageKey: keyof ReturnType<typeof locales> = 'en', locale?: Locale) => {
  const dispatch = useDispatch<AppDispatch>();
  const initializedRef = useRef(false);

  useEffect(() => {
    // 初次渲染时使用当前 locale 更新一次 pageInfo
    if (!initializedRef.current && locale) {
      const messages = locales[locale];
      if (messages?.pageInfo?.[pageKey]) {
        const pageInfo = messages.pageInfo[pageKey];
        dispatch(
          setPageInfo({
            page: pageKey,
            info: {
              title: pageInfo.title,
              description: pageInfo.description,
            },
          }),
        );
        console.log(`[usePageInfoUpdate] Initialized ${pageKey} pageInfo with locale: ${locale}`);
        initializedRef.current = true;
      }
    }

    const handleLanguageChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ locale: Locale }>;
      const newLocale = customEvent.detail?.locale;

      if (newLocale) {
        console.log(`[usePageInfoUpdate] Language changed to ${newLocale}, updating ${pageKey} pageInfo`);

        // 获取翻译后的页面信息
        const messages = locales[newLocale];
        if (messages?.pageInfo?.[pageKey]) {
          const pageInfo = messages.pageInfo[pageKey];
          dispatch(
            setPageInfo({
              page: pageKey,
              info: {
                title: pageInfo.title,
                description: pageInfo.description,
              },
            }),
          );
        }
      }
    };

    // 监听语言切换事件
    window.addEventListener('ChangeLanguage', handleLanguageChange);

    return () => {
      window.removeEventListener('ChangeLanguage', handleLanguageChange);
    };
  }, [pageKey, locale, dispatch]);
};

/**
 * Alternative hook to update all page infos at once
 * Use this in your root component or a centralized location
 */
export const usePageInfoUpdateAll = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { locale } = require('@src/lib/i18n').useI18n();

  useEffect(() => {
    const handleLanguageChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ locale: Locale }>;
      const newLocale = customEvent.detail?.locale;

      if (newLocale) {
        console.log(`[usePageInfoUpdateAll] Language changed to ${newLocale}, updating all pageInfos`);

        // 批量更新所有页面信息
        const translatedInfo = updateAllPageInfo(newLocale);
        dispatch(updateAllPageInfo(translatedInfo));
      }
    };

    window.addEventListener('ChangeLanguage', handleLanguageChange);

    return () => {
      window.removeEventListener('ChangeLanguage', handleLanguageChange);
    };
  }, [dispatch]);
};
