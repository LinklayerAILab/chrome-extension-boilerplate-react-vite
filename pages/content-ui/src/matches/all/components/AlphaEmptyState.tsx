import { useI18n } from '@src/lib/i18n';

export const AlphaEmptyState = () => {
  const { t } = useI18n();
  const noDataImage = chrome.runtime.getURL('content-ui/noData/null.svg');

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center py-12 text-center">
      <img src={noDataImage} alt="No data" className="h-[120px] w-[120px]" />

      <div className="mt-4 text-[12px] text-gray-500">{t.alpha?.noDataDescription || 'No alpha token information'}</div>
    </div>
  );
};
