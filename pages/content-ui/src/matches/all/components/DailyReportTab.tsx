import { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@src/store';
import { dailyReportStream } from '@src/api/guard';
import { ReportStream } from './ReportStream';

interface DailyReportTabProps {
  /** 收到 SSE start 事件时回调，携带后端报告日期 report_date */
  onReportDate?: (reportDate: string | null) => void;
}

/**
 * Daily Report tab：AI 日报 SSE 流（挂载自动生成，打字机渲染，Stop / Copy / Regenerate）。
 * 移植自 bodyguard-app /alerts（去除订阅校验与 TG 下载链路）。
 */
export const DailyReportTab = memo(({ onReportDate }: DailyReportTabProps) => {
  const address = useSelector((state: RootState) => state.user.address);

  const createStream = useCallback(
    (signal: AbortSignal) =>
      dailyReportStream(signal, address, data => {
        // start 事件形如 {today, locale, report_date}
        const reportDate = (data as { report_date?: unknown } | null)?.report_date;
        onReportDate?.(typeof reportDate === 'string' && reportDate ? reportDate : null);
      }),
    [address, onReportDate],
  );

  return (
    <div className="relative mt-2 flex min-h-0 flex-1 flex-col gap-3">
      <ReportStream createStream={createStream} className="min-h-0 flex-1" contentClassName="min-h-0 flex-1" />
    </div>
  );
});

DailyReportTab.displayName = 'DailyReportTab';
