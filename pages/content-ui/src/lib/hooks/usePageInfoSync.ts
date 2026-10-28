import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@src/store';
import { useI18n } from '@src/lib/i18n';
import { updateAllPageInfo, updatePageInfoTranslations } from '@src/store/slices/pageInfoSlice';

/**
 * 语言变化时刷新全部页面的 title/description。
 *
 * 这是兜底机制：各页面组件自己会调 usePageInfoUpdate 同步本页文案，
 * 这里保证即使某个页面漏了调用，切换语言后也不会停在上一种语言。
 */
export const usePageInfoSync = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { locale } = useI18n();

  useEffect(() => {
    dispatch(updateAllPageInfo(updatePageInfoTranslations(locale)));
  }, [locale, dispatch]);
};
