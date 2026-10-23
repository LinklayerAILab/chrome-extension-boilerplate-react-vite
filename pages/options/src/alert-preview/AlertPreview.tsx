import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ALERT_MAX_PAYLOAD_BYTES,
  GUARD_LOCALES,
  PUSH_PAYLOAD_HARD_LIMIT,
  buildMergedAlertSegments,
  toPushPayload,
  type AlertSegment,
  type GuardLocale,
  type RenderContext,
  type TriggeredAlert,
  utf8Bytes,
} from './render';
import { SAMPLE_SCENARIOS } from './samples';
import { loadLiveAlerts, readAuth, type AuthInfo } from './useAlertPreview';

type Source = 'live' | 'sample';
type ViewTab = 'render' | 'payload' | 'raw';

interface LoadState {
  loading: boolean;
  source: Source;
  alerts: TriggeredAlert[];
  context: RenderContext;
  error?: string;
}

const EMPTY_CONTEXT: RenderContext = { liquidityChange: {}, prices: {}, dailyByToken: {} };

const LOCALE_LABEL: Record<GuardLocale, string> = {
  zh: '中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  ru: 'Русский',
};

const COLOR_SWATCH: Record<string, string> = {
  red: '#F44A40',
  yellow: '#B19F00',
  green: '#2EC94C',
  stale: '#9CA3AF',
};

/** 字节预算进度条：超 3500 预算标红，超 4096 硬上限深红 */
const BudgetBar = ({ bytes }: { bytes: number }) => {
  const ratio = Math.min(bytes / PUSH_PAYLOAD_HARD_LIMIT, 1);
  const overBudget = bytes > ALERT_MAX_PAYLOAD_BYTES;
  const overHard = bytes > PUSH_PAYLOAD_HARD_LIMIT;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full transition-all"
          style={{
            width: `${Math.max(ratio * 100, 2)}%`,
            backgroundColor: overHard ? '#B91C1C' : overBudget ? '#F59E0B' : '#2EC94C',
          }}
        />
      </div>
      <span
        className={`text-[11px] tabular-nums ${
          overHard ? 'font-bold text-red-700' : overBudget ? 'font-semibold text-amber-600' : 'text-gray-500'
        }`}>
        {bytes} / {ALERT_MAX_PAYLOAD_BYTES} B{overHard && ' ⚠ 超硬上限'}
        {!overHard && overBudget && ' ⚠ 超预算'}
      </span>
    </div>
  );
};

/** 原样保留 backend 排版：空格缩进与换行都有语义，必须 pre-wrap */
const SegmentText = ({ text }: { text: string }) => (
  <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-6 text-black">{text}</pre>
);

const SegmentCard = ({ segment, index, total }: { segment: AlertSegment; index: number; total: number }) => {
  const payload = useMemo(() => toPushPayload(segment.text), [segment.text]);
  return (
    <div className="rounded-lg border-[1.5px] border-black bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
        <span className="text-[12px] font-bold text-black">
          第 {index + 1} / {total} 段
          {segment.alertIndices.length > 0 && (
            <span className="ml-2 font-normal text-gray-500">含 {segment.alertIndices.length} 个币种块</span>
          )}
        </span>
        <BudgetBar bytes={segment.bytes} />
      </div>

      <div className="space-y-3 px-3 py-3">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">通知栏外观</div>
          <div className="rounded-md border border-gray-300 bg-[#FAFAFA] p-2.5">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-[16px] leading-none">💡</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-bold text-black">{payload.title}</div>
                <div className="line-clamp-2 text-[11px] text-gray-600">
                  {payload.body.split('\n').filter(Boolean)[0] ?? '—'}
                </div>
                <div className="mt-1 text-[10px] text-gray-400">LinkLayer AI Guard</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">推送全文</div>
          <div className="rounded-md border border-gray-200 bg-[#FCFCF9] p-3">
            <SegmentText text={segment.text} />
          </div>
        </div>
      </div>
    </div>
  );
};

const TokenChip = ({
  alert,
  selected,
  onToggle,
}: {
  alert: TriggeredAlert;
  selected: boolean;
  onToggle: () => void;
}) => {
  const symbol = alert.health.token.symbol || alert.health.token.token_id;
  const color = String(alert.health.color ?? '').toLowerCase();
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[12px] transition-colors ${
        selected ? 'border-black bg-[#F4FFC8]' : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}>
      <span
        className="inline-block size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: COLOR_SWATCH[color] ?? '#9CA3AF' }}
      />
      <span className="min-w-0 flex-1 truncate font-semibold text-black">{symbol}</span>
      <span className="shrink-0 text-[10px] text-gray-500">{alert.health.level}</span>
      {alert.eventId !== undefined && (
        <span className="shrink-0 text-[10px] tabular-nums text-gray-400">#{alert.eventId}</span>
      )}
    </button>
  );
};

export const AlertPreview = () => {
  const [locale, setLocale] = useState<GuardLocale>('zh');
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
  const [tab, setTab] = useState<ViewTab>('render');

  const scenario = useMemo(() => SAMPLE_SCENARIOS.find(s => s.id === scenarioId) ?? SAMPLE_SCENARIOS[0], [scenarioId]);

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
      setTab('render');
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
    // 首次挂载时 state 已是示例数据，无需重复 setState（避免覆盖用户选择）
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
    () => buildMergedAlertSegments(selectedAlerts, state.context, locale, undefined),
    [selectedAlerts, state.context, locale],
  );

  const fullText = useMemo(() => segments.map(s => s.text).join('\n\n———\n\n'), [segments]);

  const payloads = useMemo(() => segments.map(s => toPushPayload(s.text)), [segments]);

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

  return (
    <div className="min-h-screen bg-[#F7F7F2] px-6 py-6 text-black">
      <div className="mx-auto max-w-[1200px] space-y-4">
        {/* 头部 */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-bold">告警推送预览</h1>
            <p className="mt-1 text-[12px] text-gray-600">
              按后端 <code className="rounded bg-gray-200 px-1">guard_alert_render.go</code> 的规则还原推送文案， 含{' '}
              {ALERT_MAX_PAYLOAD_BYTES} 字节拆段。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                state.source === 'live'
                  ? 'border-green-600 bg-green-50 text-green-700'
                  : 'border-gray-400 bg-white text-gray-600'
              }`}>
              {state.source === 'live' ? `真实数据 · ${state.alerts.length} 条` : '示例数据'}
            </span>

            <button
              type="button"
              onClick={() => {
                if (auth) void loadLive(auth);
                else
                  void (async () => {
                    const info = await readAuth();
                    setAuth(info);
                    if (info) await loadLive(info);
                    else loadSample(scenarioId);
                  })();
              }}
              disabled={state.loading}
              className="rounded-md border-[1.5px] border-black bg-[#CCFF00] px-3 py-1 text-[12px] font-semibold disabled:opacity-50">
              {state.loading ? '加载中…' : '刷新'}
            </button>
          </div>
        </header>

        {state.error && (
          <div className="rounded-md border border-amber-500 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            {state.error}
          </div>
        )}

        {/* 示例场景切换（仅在示例模式可用） */}
        {state.source === 'sample' && (
          <div className="flex flex-wrap gap-2">
            {SAMPLE_SCENARIOS.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setScenarioId(s.id);
                  loadSample(s.id);
                }}
                className={`rounded-md border px-3 py-1.5 text-left text-[12px] transition-colors ${
                  scenarioId === s.id
                    ? 'border-black bg-[#F4FFC8] font-semibold'
                    : 'border-gray-300 bg-white hover:bg-gray-50'
                }`}>
                <div className="font-semibold">{s.title}</div>
                <div className="text-[10px] text-gray-500">{s.description}</div>
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
          {/* 左栏：告警选择 + 语言 + Tab */}
          <aside className="space-y-4">
            <section className="rounded-lg border-[1.5px] border-black bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-bold">选择告警</span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] text-gray-500 underline hover:text-black">
                  {selectedIds.size === state.alerts.length ? '全不选' : '全选'}
                </button>
              </div>
              <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
                {state.alerts.map((alert, index) => (
                  <TokenChip
                    key={`${alert.eventId ?? index}-${alert.health.token.token_id}`}
                    alert={alert}
                    selected={selectedIds.has(index)}
                    onToggle={() => toggleAlert(index)}
                  />
                ))}
                {state.alerts.length === 0 && (
                  <p className="py-4 text-center text-[11px] text-gray-400">没有可选告警</p>
                )}
              </div>
            </section>

            <section className="rounded-lg border-[1.5px] border-black bg-white p-3">
              <div className="mb-2 text-[12px] font-bold">语言</div>
              <div className="grid grid-cols-2 gap-1.5">
                {GUARD_LOCALES.map(code => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLocale(code)}
                    className={`rounded-md border px-2 py-1 text-[11px] ${
                      locale === code
                        ? 'border-black bg-[#CCFF00] font-semibold'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}>
                    {LOCALE_LABEL[code]}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border-[1.5px] border-black bg-white p-3">
              <div className="mb-2 text-[12px] font-bold">视图</div>
              <div className="flex flex-col gap-1.5">
                {(
                  [
                    ['render', '渲染结果'],
                    ['payload', 'Web Push payload'],
                    ['raw', '纯文本'],
                  ] as [ViewTab, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`rounded-md border px-2 py-1 text-left text-[11px] ${
                      tab === key
                        ? 'border-black bg-[#F4FFC8] font-semibold'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-gray-300 bg-white p-3 text-[11px] leading-5 text-gray-600">
              <div className="font-bold text-black">本次预览</div>
              <div className="mt-1">
                选中 {selectedAlerts.length} 条 → <span className="font-semibold">{segments.length}</span> 段
              </div>
              <div>
                总字节 <span className="font-semibold tabular-nums">{utf8Bytes(fullText)}</span> B
              </div>
            </section>
          </aside>

          {/* 右栏：结果 */}
          <main className="min-w-0 space-y-3">
            {selectedAlerts.length === 0 && (
              <div className="rounded-lg border-[1.5px] border-dashed border-gray-300 bg-white py-16 text-center text-[12px] text-gray-400">
                左侧至少选择一条告警
              </div>
            )}

            {selectedAlerts.length > 0 && tab === 'render' && (
              <>
                {segments.length > 1 && (
                  <div className="rounded-md border border-amber-500 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                    内容超过 {ALERT_MAX_PAYLOAD_BYTES} 字节，被拆成 {segments.length} 段分别推送（后端
                    <code className="mx-1 rounded bg-amber-100 px-1">guardBuildMergedAlertSegments</code>
                    行为）。
                  </div>
                )}
                {segments.map((segment, index) => (
                  <SegmentCard key={index} segment={segment} index={index} total={segments.length} />
                ))}
              </>
            )}

            {selectedAlerts.length > 0 && tab === 'payload' && (
              <div className="space-y-3">
                {payloads.map((payload, index) => (
                  <div key={index} className="rounded-lg border-[1.5px] border-black bg-white">
                    <div className="border-b border-gray-200 px-3 py-2 text-[12px] font-bold">
                      第 {index + 1} / {payloads.length} 段 · payload
                      <span className="ml-2 font-normal text-gray-500">{utf8Bytes(JSON.stringify(payload))} B</span>
                    </div>
                    <pre className="overflow-x-auto px-3 py-3 font-mono text-[11px] leading-5 text-gray-800">
                      {JSON.stringify(payload, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}

            {selectedAlerts.length > 0 && tab === 'raw' && (
              <div className="rounded-lg border-[1.5px] border-black bg-white">
                <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
                  <span className="text-[12px] font-bold">未拆段完整文本</span>
                  <span className="text-[11px] tabular-nums text-gray-500">{utf8Bytes(fullText)} B</span>
                </div>
                <div className="px-3 py-3">
                  <SegmentText text={fullText} />
                </div>
              </div>
            )}
          </main>
        </div>

        <footer className="pb-4 text-[11px] leading-5 text-gray-500">
          数据来源：<code className="rounded bg-gray-200 px-1">chrome.storage.local</code> 中的
          <code className="mx-1 rounded bg-gray-200 px-1">guardPushState</code>
          （开启推送后由 content-ui 写入）。未开启时展示内置示例，覆盖红色告警、多币拆段、全绿降级三种排版分支。
        </footer>
      </div>
    </div>
  );
};

export default AlertPreview;
