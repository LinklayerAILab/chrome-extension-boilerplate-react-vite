import { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@src/store';
import { useI18n } from '@src/lib/i18n';
import { dailyReportStream } from '@src/api/guard';
import { ReportStream } from './ReportStream';

/**
 * Daily Report tab：AI 日报 SSE 流（挂载自动生成，打字机渲染，Stop / Copy / Regenerate）。
 * 移植自 bodyguard-app /alerts（去除订阅校验与 TG 下载链路）。
 */
export const DailyReportTab = memo(() => {
  const { t } = useI18n();
  const tAny = t as unknown as Record<string, any>;
  const address = useSelector((state: RootState) => state.user.address);

  const createStream = useCallback((signal: AbortSignal) => dailyReportStream(signal, address), [address]);

  return (
    <div className="relative mt-2 flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-[50px] shrink-0 items-center bg-[#EAEAEA] px-3 text-[12px] leading-relaxed text-black/70">
        {tAny?.guard?.dailyReportDesc ||
          'Health check on every coin you watch, delivered at 02:00 daily — calm days included.'}
      </div>
      <ReportStream createStream={createStream} className="min-h-0 flex-1" contentClassName="min-h-0 flex-1" />
    </div>
  );
});

DailyReportTab.displayName = 'DailyReportTab';
