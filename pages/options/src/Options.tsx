import '@src/Options.css';
import { useMemo } from 'react';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import MessageCenter from '@src/message-center/MessageCenter';

const Options = () => {
  // 从通知跳转时带 ?messageId=xxx，直接进入该条消息的详情视图
  const initialMessageId = useMemo(() => {
    const raw = new URLSearchParams(window.location.search).get('messageId');
    const id = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isNaN(id) ? undefined : id;
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F7F2] text-black">
      <MessageCenter initialMessageId={initialMessageId} />
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
