import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ALERT_MAX_PAYLOAD_BYTES,
  PUSH_PAYLOAD_HARD_LIMIT,
  buildMergedAlertSegments,
  toPushPayload,
  type AlertSegment,
  type RenderContext,
  type TriggeredAlert,
} from './render';
import { SAMPLE_SCENARIOS } from './samples';
import { loadLiveAlerts, readAuth, type AuthInfo } from './useAlertPreview';

type Source = 'live' | 'sample';

interface LoadState {
  loading: boolean;
  source: Source;
  alerts: TriggeredAlert[];
  context: RenderContext;
  error?: string;
}

/** 预览固定用中文：与产品主语言一致，多语言由后端按订阅 locale 渲染 */
const PREVIEW_LOCALE = 'zh' as const;

const LIGHT_BALL_COLORS: Record<string, { base: string; light: string; dark: string }> = {
  green: { base: '#51FF6E', light: '#A7FFD5', dark: '#07C369' },
  yellow: { base: '#E1FF00', light: '#EEFF70', dark: '#C5CC05' },
  red: { base: '#FF6063', light: '#FFACB4', dark: '#D9474C' },
  stale: { base: '#E1FF00', light: '#EEFF70', dark: '#C5CC05' },
};

/** 与 WatchListTab 同款健康灯球：渐变 + 内阴影模拟球体 */
const lightBallStyle = (color?: string) => {
  const c = LIGHT_BALL_COLORS[(color || 'stale').toLowerCase()] ?? LIGHT_BALL_COLORS.stale;
  return {
    background: `linear-gradient(to bottom, ${c.light} 21%, ${c.base} 100%)`,
    boxShadow: `inset 0 3px 3px #fff, inset 0 -3px 3px ${c.dark}`,
  };
};

/** 字节预算：超 3500 预算转黄，超 4096 硬上限转红 */
const BudgetBadge = ({ bytes }: { bytes: number }) => {
  const overHard = bytes > PUSH_PAYLOAD_HARD_LIMIT;
  const overBudget = bytes > ALERT_MAX_PAYLOAD_BYTES;
  const tone = overHard
    ? 'border-[#F44A40] bg-[#FFE9EA] text-[#D9474C]'
    : overBudget
      ? 'border-[#B19F00] bg-[#FFFCE0] text-[#8A7A00]'
      : 'border-black bg-[#F3F3F3] text-black/60';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`}>
      {bytes} / {ALERT_MAX_PAYLOAD_BYTES} B{overHard ? ' 超上限' : overBudget ? ' 超预算' : ''}
    </span>
  );
};

/** 排版原样保留：缩进与换行都有语义 */
const SegmentText = ({ text }: { text: string }) => (
  <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-6 text-black">{text}</pre>
);

const SegmentCard = ({ segment, index, total }: { segment: AlertSegment; index: number; total: number }) => {
  const payload = useMemo(() => toPushPayload(segment.text), [segment.text]);
  return (
    <div className="rounded-[6.5px] border-[1.5px] border-black bg-white">
      <div className="flex h-[48px] items-center justify-between bg-[#CCFF00] px-5 text-xs font-medium text-[#7e9d00]">
        <span className="font-bold text-black">
          {total > 1 ? `第 ${index + 1} / ${total} 段` : '推送内容'}
          {segment.alertIndices.length > 0 && (
            <span className="ml-2 font-normal text-black/50">{segment.alertIndices.length} 个币种</span>
          )}
        </span>
        <BudgetBadge bytes={segment.bytes} />
      </div>

      <div className="space-y-3 p-4">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-black/45">通知栏外观</div>
          <div className="rounded-[5px] border border-black bg-[#F3F3F3] p-2.5">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-[16px] leading-none">💡</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-bold text-black">{payload.title}</div>
                <div className="line-clamp-2 text-[11px] text-black/60">
                  {payload.body.split('\n').filter(Boolean)[0] ?? '—'}
                </div>
                <div className="mt-1 text-[10px] text-black/40">LinkLayer AI Guard</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-black/45">推送全文</div>
          <div className="rounded-[5px] border border-black/15 bg-[#FCFCF9] p-3">
            <SegmentText text={segment.text} />
          </div>
        </div>
      </div>
    </div>
  );
};

const TokenRow = ({
  alert,
  selected,
  onToggle,
}: {
  alert: TriggeredAlert;
  selected: boolean;
  onToggle: () => void;
}) => {
  const symbol = alert.health.token.symbol || alert.health.token.token_id;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-2.5 rounded-[5px] border px-2 py-1.5 text-left transition-colors ${
        selected ? 'border-black bg-[#F4FFC8]' : 'border-black/15 bg-white hover:bg-[#F3F3F3]'
      }`}>
      <span
        className="h-[18px] w-[18px] shrink-0 rounded-full border-2 border-black"
        style={lightBallStyle(alert.health.color)}
      />
      <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-black">{symbol}</span>
      <span className="shrink-0 text-[10px] font-semibold text-black/45">{alert.health.level}</span>
    </button>
  );
};

export const AlertPreview = () => {
  const [scenarioId, setScenarioId] = useState(SAMPLE_SCENARIOS[0].id);
  const [state, setState] = useState<LoadState>({
    loading: true,
    source: 'sample',
    alerts: SAMPLE_SCENARIOS[0].alerts,
    context: SAMPLE_SCENARIOS[0].context,
  });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () => new Set(SAMPLE_SCENARIOS[0].alerts.map((_, i) => i)),
  );
  const [auth, setAuth] = useState<AuthInfo | null>(null);

  const loadSample = useCallback((id: string) => {
    const target = SAMPLE_SCENARIOS.find(s => s.id === id) ?? SAMPLE_SCENARIOS[0];
    setState({ loading: false, source: 'sample', alerts: target.alerts, context: target.context });
    setSelectedIds(new Set(target.alerts.map((_, i) => i)));
  }, []);

  const loadLive = useCallback(async (info: AuthInfo): Promise<boolean> => {
    setState(prev => ({ ...prev, loading: true, error: undefined }));
    try {
      const { alerts, context } = await loadLiveAlerts(info);
      if (alerts.length === 0) {
        setState(prev => ({
          ...prev,
          loading: false,
          source: 'sample',
          error: '真实数据没有未读告警，已回落到示例数据',
        }));
        return false;
      }
      setState({ loading: false, source: 'live', alerts, context });
      setSelectedIds(new Set(alerts.map((_, i) => i)));
      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        source: 'sample',
        error: `真实数据加载失败：${error instanceof Error ? error.message : String(error)}`,
      }));
      return false;
    }
  }, []);

  // 首次挂载：有登录态就拉真实数据，否则停留示例
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const info = await readAuth();
      if (cancelled) return;
      setAuth(info);
      if (info) {
        const ok = await loadLive(info);
        if (!cancelled && !ok) {
          setState(prev => ({
            ...prev,
            error: prev.error ?? '未检测到可用的真实告警数据，当前为示例数据',
          }));
        }
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: '未检测到已开启推送的登录态（chrome.storage.local 无 guardPushState），当前为示例数据',
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLive]);

  const selectedAlerts = useMemo(() => state.alerts.filter((_, i) => selectedIds.has(i)), [state.alerts, selectedIds]);

  const segments = useMemo(
    () => buildMergedAlertSegments(selectedAlerts, state.context, PREVIEW_LOCALE),
    [selectedAlerts, state.context],
  );

  const toggleAlert = (index: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === state.alerts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(state.alerts.map((_, i) => i)));
  };

  const refresh = () => {
    if (auth) void loadLive(auth);
    else
      void (async () => {
        const info = await readAuth();
        setAuth(info);
        if (info) await loadLive(info);
        else loadSample(scenarioId);
      })();
  };

  return (
    <div className="min-h-screen bg-[#F7F7F2] py-6 text-black">
      <div className="mx-auto w-full max-w-[1000px] px-4">
        {/* 标题栏 */}
        <header className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-bold text-black">告警推送预览</h1>
            <p className="mt-0.5 text-[12px] text-black/50">按后端渲染规则还原推送文案，含 3500 字节拆段</p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                state.source === 'live'
                  ? 'border-black bg-[#CCFF00] text-black'
                  : 'border-black/25 bg-white text-black/50'
              }`}>
              {state.source === 'live' ? `真实数据 · ${state.alerts.length} 条` : '示例数据'}
            </span>
            <button
              type="button"
              onClick={refresh}
              disabled={state.loading}
              className="rounded-[5px] border-[1.5px] border-black bg-white px-3 py-1 text-[12px] font-semibold text-black transition-colors hover:bg-[#F4FFC8] disabled:opacity-50">
              {state.loading ? '加载中…' : '刷新'}
            </button>
          </div>
        </header>

        {state.error && (
          <div className="mb-3 rounded-[5px] border border-[#B19F00] bg-[#FFFCE0] px-3 py-2 text-[12px] text-[#8A7A00]">
            {state.error}
          </div>
        )}

        {/* 示例场景切换 */}
        {state.source === 'sample' && (
          <div className="mb-4 flex flex-wrap gap-2">
            {SAMPLE_SCENARIOS.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setScenarioId(s.id);
                  loadSample(s.id);
                }}
                className={`rounded-[5px] border-[1.5px] border-black px-3 py-1.5 text-[12px] font-bold transition-colors ${
                  scenarioId === s.id ? 'bg-[#CCFF00] text-black' : 'bg-white text-black/45 hover:bg-[#F4FFC8]'
                }`}>
                {s.title}
              </button>
            ))}
          </div>
        )}

        {/* 左右分栏：左选告警，右看渲染 */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
          <aside className="rounded-[6.5px] border-[1.5px] border-black bg-white">
            <div className="flex h-[48px] items-center justify-between bg-[#CCFF00] px-4 text-xs font-medium text-[#7e9d00]">
              <span className="font-bold text-black">选择告警</span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="font-semibold text-black/60 underline-offset-2 hover:underline">
                {selectedIds.size === state.alerts.length ? '全不选' : '全选'}
              </button>
            </div>
            <div
              className="max-h-[420px] space-y-1.5 overflow-y-auto p-2"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#ccc #f1f5f9' }}>
              {state.alerts.map((alert, index) => (
                <TokenRow
                  key={`${alert.eventId ?? index}-${alert.health.token.token_id}`}
                  alert={alert}
                  selected={selectedIds.has(index)}
                  onToggle={() => toggleAlert(index)}
                />
              ))}
              {state.alerts.length === 0 && (
                <div className="py-8 text-center text-[12px] text-black/40">没有可选告警</div>
              )}
            </div>
            <div className="border-t border-black/10 px-3 py-2 text-[11px] text-black/45">
              已选 {selectedAlerts.length} 条 · {segments.length} 段
            </div>
          </aside>

          <main className="min-w-0 space-y-3">
            {selectedAlerts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-[6.5px] border border-black bg-white py-16 text-[12px] text-black/40">
                <span>左侧至少选择一条告警</span>
              </div>
            ) : (
              <>
                {segments.length > 1 && (
                  <div className="rounded-[5px] border border-[#B19F00] bg-[#FFFCE0] px-3 py-2 text-[12px] text-[#8A7A00]">
                    内容超过 {ALERT_MAX_PAYLOAD_BYTES} 字节，被拆成 {segments.length} 段分别推送
                  </div>
                )}
                {segments.map((segment, index) => (
                  <SegmentCard key={index} segment={segment} index={index} total={segments.length} />
                ))}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default AlertPreview;
