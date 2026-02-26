import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@src/store';
import { useI18n } from '@src/lib/i18n';
import { updateAllPageInfo } from '@src/store/slices/pageInfoSlice';

/**
 * Hook to sync pageInfo translations when locale changes
 * Call this in your root component (e.g., App.tsx) to ensure all page titles and descriptions are translated
 */
export const usePageInfoSync = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { locale } = useI18n();

  useEffect(() => {
    // Update all page info translations when locale changes
    const translatedInfo = updateAllPageInfo(locale);
    dispatch(updateAllPageInfo(translatedInfo));
  }, [locale, dispatch]);
};
