'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { captainAvatarImgReferrerPolicy, captainAvatarImgSrc } from '@/lib/captain-avatar-placeholder';
import { HOST_TYPE_LABEL } from '@/lib/hosting-types';
import { isoDatesCurrentWeek, todayIsoDate } from '@/lib/hosting-week-utils';

const WEEK_TAB_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;

/** 当日人数 > 此值时，使用可滚动列表（即 ≥4 人） */
const DENSE_LIST_THRESHOLD = 3;

type HostWeekTodo = {
  id: number;
  todoDate: string;
  roleName: string;
  hostType: string;
  stuckTask: boolean;
  sortOrder: number;
  captainId: number | null;
  avatarUrl: string | null;
  avatarUpdatedAt?: number | null;
};

function dayOfMonthFromIso(iso: string) {
  const parts = iso.split('-');
  const d = Number(parts[2]);
  return Number.isFinite(d) ? d : 0;
}

function placeholderFromRoleName(raw: string): string {
  const t = raw.trim();
  if (!t) return '?';
  const asciiWord = t.match(/^([A-Za-z][A-Za-z0-9'_\-]*)/);
  if (asciiWord) {
    const w = asciiWord[1]!;
    const u = w.toUpperCase();
    if (u.length >= 2) return u.slice(0, 2);
    return u.length === 1 ? `${u}${u}` : u.slice(0, 2);
  }
  const chars = Array.from(t.replace(/\s+/g, ''));
  if (chars.length >= 2) return `${chars[0]!}${chars[1]!}`;
  return chars[0] ?? '?';
}

function ringClass(hostType: string) {
  if (hostType === 'group') {
    return 'shadow-[0_0_0_2px_#3b82f6,0_0_14px_rgba(59,130,246,0.38)]';
  }
  return 'shadow-[0_0_0_2px_#fb7299,0_0_16px_rgba(251,114,153,0.44)]';
}

function AvatarInnerPhoto({
  src,
  label,
  textClass,
  updatedAt,
}: {
  src: string | null;
  label: string;
  textClass: string;
  updatedAt?: number | null;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src, updatedAt]);

  if (!src || failed) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 font-semibold text-slate-600 ${textClass}`}>
        {label}
      </div>
    );
  }
  const bust = updatedAt ?? 0;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={captainAvatarImgSrc(src, bust)}
      alt=""
      referrerPolicy={captainAvatarImgReferrerPolicy(src)}
      className="h-full w-full object-cover"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function AvatarFace({
  item,
  sizeClass,
  textClass,
}: {
  item: HostWeekTodo;
  sizeClass: string;
  textClass: string;
}) {
  const label = placeholderFromRoleName(item.roleName);
  const ring = ringClass(item.hostType);
  const ht = item.hostType === 'group' ? 'group' : 'scan';
  return (
    <div className={`relative shrink-0 rounded-full p-[2px] ${ring}`} title={`${item.roleName} · ${HOST_TYPE_LABEL[ht]}`}>
      {item.stuckTask ? (
        <span
          className="absolute -right-0.5 -top-0.5 z-10 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-bold leading-none text-white shadow ring-1 ring-white"
          aria-label="卡任务">
          !
        </span>
      ) : null}
      <div className={`${sizeClass} overflow-hidden rounded-full bg-gray-100 ring-2 ring-white`}>
        <AvatarInnerPhoto src={item.avatarUrl} label={label} textClass={textClass} updatedAt={item.avatarUpdatedAt} />
      </div>
    </div>
  );
}

function HostingAvatarChipComfort({ item }: { item: HostWeekTodo }) {
  const ht = item.hostType === 'group' ? 'group' : 'scan';
  return (
    <div className="relative flex w-full min-w-0 max-w-[88px] flex-col items-center" title={`${item.roleName} · ${HOST_TYPE_LABEL[ht]}`}>
      <AvatarFace item={item} sizeClass="h-11 w-11" textClass="text-xs" />
      <span className="mt-1.5 w-full min-w-0 break-words px-0.5 text-center text-[10px] font-medium leading-tight text-[#555] line-clamp-2">
        {item.roleName}
      </span>
    </div>
  );
}

function HostingAvatarCardDense({ item }: { item: HostWeekTodo }) {
  const ht = item.hostType === 'group' ? 'group' : 'scan';
  return (
    <div
      className="flex w-full min-w-0 flex-col items-center gap-1 rounded-lg border border-gray-100 bg-white px-1.5 py-2 shadow-sm"
      title={`${item.roleName} · ${HOST_TYPE_LABEL[ht]}`}>
      <AvatarFace item={item} sizeClass="h-9 w-9" textClass="text-[10px]" />
      <p className="w-full min-w-0 break-words text-center text-[11px] font-medium leading-snug text-gray-800 line-clamp-2">
        {item.roleName}
      </p>
    </div>
  );
}

function PanelHeader({
  weekDates,
  loading,
  onRefresh,
}: {
  weekDates: string[];
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="shrink-0 border-b border-gray-200 bg-gray-50 px-4 pb-4 pt-3 md:px-4 md:pt-4">
      <div className="mx-auto mb-2 hidden h-1 w-10 rounded-full bg-gray-300 md:hidden" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold tracking-tight text-gray-900">本周搜打撤行动预案</p>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
            <span className="font-mono text-[13px] text-gray-700">{weekDates[0] ?? ''}</span>
            <span className="mx-1.5 text-gray-300">→</span>
            <span className="font-mono text-[13px] text-gray-700">{weekDates[6] ?? ''}</span>
            <span className="ml-2 hidden text-gray-400 sm:inline">周一至周日</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-[#00A1D6] shadow-sm transition hover:border-sky-200 hover:bg-sky-50 disabled:opacity-40">
          {loading ? '…' : '刷新'}
        </button>
      </div>
    </div>
  );
}

function PanelLegend() {
  return (
    <p className="mx-auto max-w-lg border-t border-gray-100 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-center text-[10px] leading-relaxed text-gray-400 md:pb-4">
      粉圈扫号 · 蓝圈组排 · 「!」卡任务 · <span className="font-medium text-red-600/90">红框为已请假</span>
      <span className="hidden md:inline"> · 当日满 4 人及以上时，该列在格内纵向滚动</span>
    </p>
  );
}

type DayColumnProps = {
  iso: string;
  idx: number;
  list: HostWeekTodo[];
  isToday: boolean;
  onLeave: boolean;
  dense: boolean;
};

function WeekDayColumn({ iso, idx, list, isToday, onLeave, dense }: DayColumnProps) {
  const dm = dayOfMonthFromIso(iso);
  const colToday = isToday && !onLeave;
  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-white transition-colors ${
        onLeave
          ? 'border-red-500/80 bg-gradient-to-b from-red-50 to-red-50/90 ring-2 ring-red-600/90'
          : colToday
            ? 'border-amber-400 bg-gradient-to-b from-amber-50 to-amber-50 ring-1 ring-amber-200'
            : 'border-gray-200 bg-gradient-to-b from-gray-50 to-white'
      }`}>
      <div
        className={`flex shrink-0 flex-col items-center justify-center gap-0.5 border-b px-0.5 py-1.5 sm:py-2 ${
          onLeave ? 'border-red-200 bg-red-100' : colToday ? 'border-amber-200 bg-amber-100' : 'border-gray-200 bg-gray-50'
        }`}>
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.06em] sm:text-[11px] ${
            onLeave ? 'text-red-800' : colToday ? 'text-amber-900' : 'text-gray-400'
          }`}>
          周{WEEK_TAB_LABELS[idx]}
        </span>
        <div className="flex items-center justify-center gap-1">
          <span
            className={`text-sm font-bold tabular-nums sm:text-base ${
              onLeave ? 'text-red-950' : colToday ? 'text-gray-900' : 'text-gray-700'
            }`}>
            {dm}
          </span>
          {list.length > 0 ? (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums sm:text-[10px] ${
                onLeave ? 'bg-red-200 text-red-950' : colToday ? 'bg-amber-200 text-amber-950' : 'bg-gray-200 text-gray-700'
              }`}>
              {list.length}
            </span>
          ) : null}
        </div>
        {onLeave ? <span className="mt-0.5 text-[10px] font-bold tracking-wide text-red-700 sm:text-[11px]">已请假</span> : null}
      </div>

      {list.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-white py-6">
          <span className={`text-[11px] ${onLeave ? 'font-semibold text-red-600' : 'text-gray-300'}`}>
            {onLeave ? '已请假' : '空'}
          </span>
        </div>
      ) : dense ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-2 [scrollbar-color:#cbd5e1_#f1f5f9] [scrollbar-width:thin] sm:px-1.5 sm:py-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar]:w-1">
            <div className="flex flex-col gap-1.5 sm:gap-2">
              {list.map(item => (
                <HostingAvatarCardDense key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 overflow-y-auto bg-white px-0.5 py-2.5 sm:gap-2.5 sm:py-3">
          {list.map(item => (
            <HostingAvatarChipComfort key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 移动端：单日全宽展示，多人时用网格而非窄列滚动 */
function MobileDayDetail({ iso, idx, list, isToday, onLeave }: DayColumnProps) {
  const dm = dayOfMonthFromIso(iso);
  const dense = list.length > DENSE_LIST_THRESHOLD;
  const colToday = isToday && !onLeave;

  return (
    <div
      className={`rounded-xl border ${
        onLeave ? 'border-red-500/80 bg-red-50/90 ring-2 ring-red-600/80' : colToday ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200 bg-white'
      }`}>
      <div
        className={`flex items-center justify-between gap-2 border-b px-4 py-3 ${
          onLeave ? 'border-red-200' : colToday ? 'border-amber-200' : 'border-gray-100'
        }`}>
        <div>
          <p className={`text-sm font-bold ${onLeave ? 'text-red-900' : 'text-gray-900'}`}>
            周{WEEK_TAB_LABELS[idx]} · {dm} 日
            {colToday ? <span className="ml-2 text-xs font-semibold text-amber-700">今天</span> : null}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-gray-500">{iso}</p>
        </div>
        {onLeave ? (
          <span className="shrink-0 rounded-full bg-red-200 px-2.5 py-1 text-xs font-bold text-red-900">已请假</span>
        ) : list.length > 0 ? (
          <span className="shrink-0 rounded-full bg-gray-200 px-2.5 py-1 text-xs font-semibold tabular-nums text-gray-700">
            {list.length} 人
          </span>
        ) : null}
      </div>

      <div className="px-3 py-4">
        {list.length === 0 ? (
          <p className={`py-8 text-center text-sm ${onLeave ? 'font-medium text-red-600' : 'text-gray-400'}`}>
            {onLeave ? '本日已请假' : '暂无安排'}
          </p>
        ) : dense ? (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {list.map(item => (
              <HostingAvatarCardDense key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-5">
            {list.map(item => (
              <HostingAvatarChipComfort key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EdgeCalendarFloat() {
  const [open, setOpen] = useState(false);
  const [weekDates, setWeekDates] = useState<string[]>(() => isoDatesCurrentWeek(todayIsoDate()));
  const [selectedIso, setSelectedIso] = useState<string>(() => todayIsoDate());
  const [todos, setTodos] = useState<HostWeekTodo[]>([]);
  const [leaveDates, setLeaveDates] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const todayIso = todayIsoDate();
  const todayDayNum = dayOfMonthFromIso(todayIso);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/site/hosting-week', { cache: 'no-store' });
      const body = (await res.json()) as {
        data?: { weekDates: string[]; todos: HostWeekTodo[]; leaveDates?: string[] };
        error?: string;
      };
      if (!res.ok) {
        setLoadError(body.error || '加载失败');
        setTodos([]);
        setLeaveDates([]);
        return;
      }
      if (body.data?.weekDates?.length) setWeekDates(body.data.weekDates);
      setTodos(body.data?.todos ?? []);
      setLeaveDates(body.data?.leaveDates ?? []);
    } catch {
      setLoadError('网络错误');
      setTodos([]);
      setLeaveDates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!weekDates.length) return;
    setSelectedIso(prev => (weekDates.includes(prev) ? prev : weekDates.includes(todayIso) ? todayIso : weekDates[0]!));
  }, [weekDates, todayIso]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const byDate = useMemo(() => {
    const m = new Map<string, HostWeekTodo[]>();
    for (const t of todos) {
      const k = t.todoDate;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    }
    return m;
  }, [todos]);

  const leaveSet = useMemo(() => new Set(leaveDates), [leaveDates]);

  const selectedIdx = weekDates.indexOf(selectedIso);
  const selectedList = byDate.get(selectedIso) ?? [];

  function toggleOpen() {
    setOpen(v => {
      const next = !v;
      if (next && weekDates.includes(todayIso)) setSelectedIso(todayIso);
      return next;
    });
  }

  const triggerBtn = (
    <button
      type="button"
      onClick={toggleOpen}
      className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-full border border-white/10 bg-gradient-to-b from-[#121820] to-[#0A0E14] text-[#E8B84B] shadow-lg transition hover:from-[#161d28] hover:to-[#0d1218] md:rounded-l-xl md:rounded-r-none md:border-r-0 md:py-6 md:shadow-inner
        h-14 w-14 max-md:fixed max-md:bottom-20 max-md:right-4 max-md:z-[86]
        md:h-auto md:w-12 md:gap-1 md:py-5"
      aria-expanded={open}
      aria-controls="edge-hosting-week-panel"
      id="edge-hosting-week-tab">
      <span className="text-lg font-bold leading-none text-white md:text-xl">{todayDayNum}</span>
      <span className="text-[9px] font-medium tracking-wide text-[#E8B84B]/95 md:text-[10px]">本周</span>
      <span className="hidden text-[10px] tracking-wide text-white/45 md:block">托管</span>
    </button>
  );

  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-[80] cursor-default bg-black/40 md:bg-transparent"
          aria-label="关闭本周托管"
          onClick={() => setOpen(false)}
        />
      ) : null}

      {/* —— 移动端：底部抽屉 + 日期 Tab —— */}
      <div
        id="edge-hosting-week-panel"
        role="region"
        aria-labelledby="edge-hosting-week-tab"
        className={`fixed inset-x-0 bottom-0 z-[90] flex max-h-[min(88dvh,720px)] flex-col rounded-t-2xl border border-gray-200 bg-white shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          open ? 'translate-y-0' : 'pointer-events-none translate-y-full'
        }`}>
        <PanelHeader weekDates={weekDates} loading={loading} onRefresh={() => void refresh()} />

        {loadError ? (
          <p className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">{loadError}</p>
        ) : null}

        <div className="shrink-0 border-b border-gray-100 px-3 py-2">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {weekDates.map((iso, idx) => {
              const list = byDate.get(iso) ?? [];
              const isToday = iso === todayIso;
              const onLeave = leaveSet.has(iso);
              const selected = iso === selectedIso;
              const dm = dayOfMonthFromIso(iso);
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedIso(iso)}
                  className={`flex shrink-0 flex-col items-center rounded-xl border px-3 py-2 min-w-[3.25rem] transition ${
                    selected
                      ? onLeave
                        ? 'border-red-500 bg-red-100 ring-2 ring-red-500/50'
                        : isToday
                          ? 'border-amber-400 bg-amber-100 ring-2 ring-amber-300/80'
                          : 'border-[#00A1D6] bg-sky-50 ring-2 ring-sky-200'
                      : onLeave
                        ? 'border-red-200 bg-red-50/80'
                        : 'border-gray-200 bg-gray-50'
                  }`}>
                  <span className={`text-[10px] font-semibold ${onLeave ? 'text-red-800' : 'text-gray-500'}`}>
                    周{WEEK_TAB_LABELS[idx]}
                  </span>
                  <span className={`text-base font-bold tabular-nums ${onLeave ? 'text-red-950' : 'text-gray-800'}`}>{dm}</span>
                  {list.length > 0 ? (
                    <span className="mt-0.5 text-[9px] font-medium text-gray-500">{list.length}人</span>
                  ) : onLeave ? (
                    <span className="mt-0.5 text-[9px] font-bold text-red-700">假</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          {selectedIdx >= 0 ? (
            <MobileDayDetail
              iso={selectedIso}
              idx={selectedIdx}
              list={selectedList}
              isToday={selectedIso === todayIso}
              onLeave={leaveSet.has(selectedIso)}
              dense={selectedList.length > DENSE_LIST_THRESHOLD}
            />
          ) : null}
        </div>

        <PanelLegend />
      </div>

      {/* —— 桌面端：右侧贴边展开（原交互） —— */}
      <div className="pointer-events-none fixed bottom-24 right-0 z-[85] hidden md:block md:bottom-28">
        <div className="pointer-events-auto flex flex-row-reverse items-end shadow-[0_16px_48px_-12px_rgba(0,0,0,0.22)]">
          {triggerBtn}

          <div
            aria-hidden={!open}
            className={`origin-bottom-right overflow-hidden rounded-l-xl border border-gray-200 border-r-0 bg-white shadow-xl transition-[width,opacity] duration-200 ease-out ${
              open ? 'pointer-events-auto w-[min(96vw,600px)] opacity-100' : 'pointer-events-none w-0 border-transparent opacity-0'
            }`}>
            <div className="flex w-[min(96vw,600px)] max-h-[min(90vh,760px)] flex-col bg-white">
              <PanelHeader weekDates={weekDates} loading={loading} onRefresh={() => void refresh()} />

              {loadError ? (
                <p className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">{loadError}</p>
              ) : null}

              <div className="min-h-0 flex-1 overflow-y-auto bg-white px-3 pb-3 pt-2">
                <div className="grid h-[min(52vh,400px)] min-h-[280px] grid-cols-7 gap-1.5">
                  {weekDates.map((iso, idx) => {
                    const list = byDate.get(iso) ?? [];
                    return (
                      <WeekDayColumn
                        key={iso}
                        iso={iso}
                        idx={idx}
                        list={list}
                        isToday={iso === todayIso}
                        onLeave={leaveSet.has(iso)}
                        dense={list.length > DENSE_LIST_THRESHOLD}
                      />
                    );
                  })}
                </div>
                <PanelLegend />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 移动端触发钮（桌面钮嵌在上面的 flex 里） */}
      <div className="md:hidden">{!open ? triggerBtn : null}</div>
    </>
  );
}
