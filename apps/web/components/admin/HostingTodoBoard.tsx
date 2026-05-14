'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAdminCaptainsList } from '@/lib/admin-captains-list';
import { T9_GROUP_KEYS, T9_GROUP_LABEL, t9GroupKeyForDisplayName } from '@/lib/captain-t9-group';
import type { CaptainApiDto } from '@/lib/captain-dto';
import { captainAvatarImgReferrerPolicy, captainAvatarImgSrc } from '@/lib/captain-avatar-placeholder';
import { captainPoolDisplayLine, captainScheduleName } from '@/lib/captain-schedule-name';
import { addDaysIso, analyzeRoleScheduleConflict } from '@/lib/hosting-todo-schedule';
import { isoDatesCurrentWeek, todayIsoDate, weekdayLabel } from '@/lib/hosting-week-utils';
import { DEFAULT_HOST_TYPE, HOST_TYPE_LABEL, HOST_TYPES, isHostType, type HostType } from '@/lib/hosting-types';

/** 从舰长池拖入新建条目时的默认参数（生成后可在卡片上改托管类型 / 卡任务） */
const DRAG_IN_HOST_TYPE = DEFAULT_HOST_TYPE;
const DRAG_IN_STUCK = false;

export type HostingTodoDto = {
  id: number;
  todoDate: string;
  roleName: string;
  hostType: string;
  stuckTask: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

/** 左侧大数字日 + 年月行 */
function parseMissionDate(iso: string) {
  const [y, m, day] = iso.split('-').map(Number);
  return {
    dayNum: day ? String(day).padStart(2, '0') : '--',
    ym: y && m ? `${y}.${String(m).padStart(2, '0')}` : '',
    wd: weekdayLabel(iso),
  };
}

function reorderIds(ids: number[], dragId: number, targetId: number, place: 'before' | 'after') {
  const arr = [...ids];
  const di = arr.indexOf(dragId);
  const ti = arr.indexOf(targetId);
  if (di < 0 || ti < 0 || di === ti) return arr;
  arr.splice(di, 1);
  const ti2 = arr.indexOf(targetId);
  const insert = place === 'before' ? ti2 : ti2 + 1;
  arr.splice(insert, 0, dragId);
  return arr;
}

/** 三角洲任务板风格色板 */
const th = {
  page: 'bg-[#080a0d] text-[#d4cfc4]',
  panel: 'bg-[#0f1218] border border-[#1e2633]',
  rail: 'bg-[#0a0c10]',
  line: 'border-[#1a2230]',
  muted: 'text-[#6d7684]',
  gold: 'text-[#c8aa6e]',
  goldBg: 'bg-[#c8aa6e]/12',
  goldBorder: 'border-[#c8aa6e]/35',
  input:
    'rounded border border-[#2a3344] bg-[#0a0d12] px-2.5 py-2 text-sm text-[#e4dfd4] outline-none placeholder:text-[#4a5568] focus:border-[#c8aa6e]/60 focus:ring-1 focus:ring-[#c8aa6e]/25',
  btn: 'rounded border border-[#c8aa6e]/40 bg-[#c8aa6e]/15 px-4 py-2 text-sm font-medium text-[#c8aa6e] transition hover:bg-[#c8aa6e]/25 disabled:opacity-40',
  btnGhost: 'rounded border border-[#2a3344] bg-transparent px-3 py-2 text-sm text-[#9aa5b4] transition hover:border-[#3d4a5f] hover:text-[#c8aa6e] disabled:opacity-40',
  card: 'group relative border border-[#232b38] bg-gradient-to-r from-[#12161f] to-[#0e1118] transition hover:border-[#c8aa6e]/25',
  cardAccent: 'border-l-[3px] border-l-[#c8aa6e]',
  toastOk: 'border border-emerald-800/60 bg-emerald-950/40 text-emerald-200',
  toastErr: 'border border-red-900/50 bg-red-950/40 text-red-200',
};

function CollapseChevron({ open, className = '', size = 'md' }: { open: boolean; className?: string; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <svg
      aria-hidden
      className={`${sz} shrink-0 text-[#c8aa6e] transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type ApiErrJson = { error?: string; code?: string; requiresConfirm?: boolean };

type PendingWeek =
  | { kind: 'post'; body: { todoDate: string; roleName: string; hostType: string; stuckTask: boolean } }
  | { kind: 'put'; id: number; body: Record<string, unknown> };

function toSchedulingRows(list: HostingTodoDto[]) {
  return list.map(r => ({ id: r.id, todo_date: r.todoDate, role_name: r.roleName }));
}

const MIME_HOSTING = 'application/x-feiyan-hosting';
const MIME_CAPTAIN = 'application/x-feiyan-hosting-captain';

export default function HostingTodoBoard() {
  const [rows, setRows] = useState<HostingTodoDto[]>([]);
  const [captains, setCaptains] = useState<CaptainApiDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [pendingWeek, setPendingWeek] = useState<PendingWeek | null>(null);
  const [captainFilter, setCaptainFilter] = useState('');
  const [leaveDates, setLeaveDates] = useState<string[]>([]);
  const [leaveDialogDate, setLeaveDialogDate] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(true);
  const [poolOpen, setPoolOpen] = useState(true);
  /** 当日「当日队列」正文收起：date 在 Set 内表示已收起 */
  const [collapsedDayQueues, setCollapsedDayQueues] = useState<Set<string>>(() => new Set());
  /** 舰长池九键分组收起：分组 key 在 Set 内表示已收起 */
  const [collapsedCaptainGroups, setCollapsedCaptainGroups] = useState<Set<number>>(() => new Set());

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [todoRes, capR] = await Promise.all([fetch('/api/admin/hosting-todos', { cache: 'no-store' }), fetchAdminCaptainsList()]);
      const todoBody = (await todoRes.json()) as { data?: HostingTodoDto[]; leaveDates?: string[]; error?: string };
      if (!todoRes.ok) {
        setError(todoBody.error || '任务板加载失败');
        setRows([]);
        setLeaveDates([]);
      } else {
        setRows(todoBody.data ?? []);
        setLeaveDates(Array.isArray(todoBody.leaveDates) ? todoBody.leaveDates : []);
      }
      if (!capR.ok) {
        if (todoRes.ok) setError(capR.error);
        setCaptains([]);
      } else {
        setCaptains(capR.data);
      }
    } catch {
      setError('网络错误');
      setRows([]);
      setCaptains([]);
      setLeaveDates([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const submitLeave = useCallback(async (date: string, onLeave: boolean): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/hosting-leave', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todoDate: date, onLeave }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error || '请假状态保存失败');
        return false;
      }
      await load({ silent: true });
      setToast(onLeave ? `已标记 ${date} 请假，主页「搜打撤预案」该日红框展示。` : `已取消 ${date} 的请假。`);
      return true;
    } catch {
      setError('网络错误');
      return false;
    } finally {
      setBusy(false);
    }
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const clear = () => setHoverDate(null);
    window.addEventListener('dragend', clear);
    return () => window.removeEventListener('dragend', clear);
  }, []);

  useEffect(() => {
    if (leaveDialogDate === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLeaveDialogDate(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leaveDialogDate]);

  const byDate = useMemo(() => {
    const m = new Map<string, HostingTodoDto[]>();
    for (const r of rows) {
      const k = r.todoDate;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    }
    return m;
  }, [rows]);

  /** 仅展示「今天」所在自然周（周一至周日） */
  const displayDates = useMemo(() => isoDatesCurrentWeek(todayIsoDate()), [rows]);

  const leaveSet = useMemo(() => new Set(leaveDates), [leaveDates]);

  const filteredCaptains = useMemo(() => {
    const q = captainFilter.trim().toLowerCase();
    if (!q) return captains;
    return captains.filter(c => {
      const label = captainScheduleName(c).toLowerCase();
      const uid = (c.uid ?? '').toLowerCase();
      const rn = (c.remarkName ?? '').toLowerCase();
      const inn = (c.idName ?? '').toLowerCase();
      const note = (c.note ?? '').toLowerCase();
      const wx = (c.wechatRemark ?? '').toLowerCase();
      const gid = (c.gameIdRemark ?? '').toLowerCase();
      return (
        label.includes(q) ||
        uid.includes(q) ||
        rn.includes(q) ||
        inn.includes(q) ||
        note.includes(q) ||
        wx.includes(q) ||
        gid.includes(q) ||
        String(c.id).includes(q)
      );
    });
  }, [captains, captainFilter]);

  const captainsByT9 = useMemo(() => {
    const map = new Map<number, CaptainApiDto[]>();
    for (const k of T9_GROUP_KEYS) map.set(k, []);
    for (const c of filteredCaptains) {
      const label = captainScheduleName(c);
      const g = t9GroupKeyForDisplayName(label);
      map.get(g)!.push(c);
    }
    for (const list of map.values()) {
      list.sort((a, b) => captainScheduleName(a).localeCompare(captainScheduleName(b), 'zh-Hans-CN'));
    }
    return map;
  }, [filteredCaptains]);

  async function persistReorder(todoDate: string, orderedIds: number[]) {
    const res = await fetch('/api/admin/hosting-todos/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ todoDate, orderedIds }),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(body.error || '排序失败');
  }

  async function executePost(body: { todoDate: string; roleName: string; hostType: string; stuckTask: boolean; confirmWeekOverlap?: boolean }) {
    const res = await fetch('/api/admin/hosting-todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as ApiErrJson;
    if (!res.ok) {
      if (res.status === 409 && j.code === 'SAME_DAY_ROLE') {
        setError(j.error || '当日已有该角色/舰长安排，不可重复添加');
        return false;
      }
      if (res.status === 409 && j.code === 'WEEK_ROLE_OVERLAP') {
        setPendingWeek({
          kind: 'post',
          body: { todoDate: body.todoDate, roleName: body.roleName, hostType: body.hostType, stuckTask: body.stuckTask },
        });
        return false;
      }
      throw new Error(j.error || '添加失败');
    }
    return true;
  }

  async function executePut(id: number, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/hosting-todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as ApiErrJson;
    if (!res.ok) {
      if (res.status === 409 && j.code === 'SAME_DAY_ROLE') {
        setError(j.error || '当日已有该角色/舰长安排，不可重复添加');
        return false;
      }
      if (res.status === 409 && j.code === 'WEEK_ROLE_OVERLAP') {
        setPendingWeek({ kind: 'put', id, body: { ...body } });
        return false;
      }
      throw new Error(j.error || '操作失败');
    }
    return true;
  }

  /** 新建托管条目（右侧舰长拖入等）；冲突时 setError / setPendingWeek */
  async function submitNewHostingEntry(input: { todoDate: string; roleName: string; hostType: HostType; stuckTask: boolean }) {
    const role = input.roleName.trim();
    if (!role) {
      setError('角色名不能为空');
      return;
    }
    const payload = { todoDate: input.todoDate, roleName: role, hostType: input.hostType, stuckTask: input.stuckTask };
    const c = analyzeRoleScheduleConflict(toSchedulingRows(rows), {
      targetDate: input.todoDate,
      roleName: role,
      excludeId: undefined,
    });
    if (c.sameDayBlocked) {
      setError('当日已有该角色/舰长安排，不可重复添加');
      return;
    }
    if (c.weekNeedsAck) {
      setPendingWeek({ kind: 'post', body: payload });
      return;
    }
    const ok = await executePost({ ...payload, confirmWeekOverlap: false });
    if (!ok) return;
    setToast('已添加至任务板');
    await load({ silent: true });
  }

  async function patchItem(id: number, patch: Partial<{ hostType: string; stuckTask: boolean; roleName: string }>) {
    setBusy(true);
    setError(null);
    try {
      if (patch.roleName !== undefined) {
        const item = rows.find(r => r.id === id);
        if (!item) {
          setError('条目不存在');
          return;
        }
        const nextRole = patch.roleName.trim();
        if (!nextRole) {
          setError('角色名不能为空');
          return;
        }
        const c = analyzeRoleScheduleConflict(toSchedulingRows(rows), {
          targetDate: item.todoDate,
          roleName: nextRole,
          excludeId: id,
        });
        if (c.sameDayBlocked) {
          setError('当日已有该角色/舰长安排，不可重复添加');
          return;
        }
        if (c.weekNeedsAck) {
          setPendingWeek({ kind: 'put', id, body: { ...patch } });
          return;
        }
      }

      const ok = await executePut(id, patch);
      if (!ok) return;
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失败');
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id: number) {
    if (!window.confirm('从任务板移除此条目？')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/hosting-todos/${id}`, { method: 'DELETE' });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || '删除失败');
      setToast('已移除');
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    } finally {
      setBusy(false);
    }
  }

  async function moveToDate(id: number, newDate: string) {
    const item = rows.find(r => r.id === id);
    if (!item) {
      setError('条目不存在');
      return;
    }
    if (item.todoDate === newDate) return;

    const c = analyzeRoleScheduleConflict(toSchedulingRows(rows), {
      targetDate: newDate,
      roleName: item.roleName,
      excludeId: id,
    });
    if (c.sameDayBlocked) {
      setError('当日已有该角色/舰长安排，不可重复添加');
      return;
    }
    if (c.weekNeedsAck) {
      setPendingWeek({ kind: 'put', id, body: { todoDate: newDate } });
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const ok = await executePut(id, { todoDate: newDate });
      if (!ok) return;
      setToast('已调度至目标日期');
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : '移动失败');
    } finally {
      setBusy(false);
    }
  }

  async function confirmWeekOverlapAction() {
    if (!pendingWeek) return;
    const p = pendingWeek;
    setPendingWeek(null);
    setBusy(true);
    setError(null);
    try {
      if (p.kind === 'post') {
        const ok = await executePost({ ...p.body, confirmWeekOverlap: true });
        if (!ok) return;
        setToast('已添加至任务板');
      } else {
        const ok = await executePut(p.id, { ...p.body, confirmWeekOverlap: true });
        if (!ok) return;
        setToast('已保存');
      }
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  function onDragStartHosting(e: React.DragEvent, item: HostingTodoDto) {
    e.dataTransfer.setData(MIME_HOSTING, JSON.stringify({ id: item.id, fromDate: item.todoDate }));
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragStartCaptain(e: React.DragEvent, c: CaptainApiDto) {
    const roleName = captainScheduleName(c);
    e.dataTransfer.setData(MIME_CAPTAIN, JSON.stringify({ roleName }));
    e.dataTransfer.setData('text/plain', roleName);
    e.dataTransfer.effectAllowed = 'copy';
  }

  function pickDropEffect(e: React.DragEvent): 'copy' | 'move' {
    const types = [...e.dataTransfer.types];
    if (types.includes(MIME_CAPTAIN)) return 'copy';
    return 'move';
  }

  async function onDropCaptainOnDate(targetDate: string, capRaw: string) {
    let roleName = '';
    try {
      roleName = (JSON.parse(capRaw) as { roleName?: string }).roleName ?? '';
    } catch {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitNewHostingEntry({
        todoDate: targetDate,
        roleName,
        hostType: DRAG_IN_HOST_TYPE,
        stuckTask: DRAG_IN_STUCK,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败');
    } finally {
      setBusy(false);
    }
  }

  async function onDropOnDayZone(e: React.DragEvent, targetDate: string) {
    e.preventDefault();
    setHoverDate(null);
    setCollapsedDayQueues(prev => {
      if (!prev.has(targetDate)) return prev;
      const n = new Set(prev);
      n.delete(targetDate);
      return n;
    });
    const capRaw = e.dataTransfer.getData(MIME_CAPTAIN);
    if (capRaw) {
      await onDropCaptainOnDate(targetDate, capRaw);
      return;
    }
    const raw = e.dataTransfer.getData(MIME_HOSTING);
    if (!raw) return;
    let parsed: { id: number; fromDate: string };
    try {
      parsed = JSON.parse(raw) as { id: number; fromDate: string };
    } catch {
      return;
    }
    if (parsed.fromDate === targetDate) return;
    await moveToDate(parsed.id, targetDate);
  }

  async function onDropOnCard(e: React.DragEvent, date: string, target: HostingTodoDto, dragId: number) {
    e.preventDefault();
    e.stopPropagation();
    setHoverDate(null);
    const capRaw = e.dataTransfer.getData(MIME_CAPTAIN);
    if (capRaw) {
      await onDropCaptainOnDate(date, capRaw);
      return;
    }
    if (dragId === target.id) return;
    const list = byDate.get(date) ?? [];
    const ids = list.map(x => x.id);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const place = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    const next = reorderIds(ids, dragId, target.id, place);
    try {
      setBusy(true);
      await persistReorder(date, next);
      await load({ silent: true });
      setToast('顺序已更新');
    } catch (err) {
      setError(err instanceof Error ? err.message : '排序失败');
    } finally {
      setBusy(false);
    }
  }

  function onDragOverZone(e: React.DragEvent, date: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = pickDropEffect(e);
    setHoverDate(date);
  }

  function renderMissionCard(item: HostingTodoDto, date: string) {
    const ht = isHostType(item.hostType) ? item.hostType : DEFAULT_HOST_TYPE;
    return (
      <li
        key={item.id}
        draggable
        onDragStart={e => onDragStartHosting(e, item)}
        onDragOver={e => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = pickDropEffect(e);
        }}
        onDrop={e => {
          e.preventDefault();
          e.stopPropagation();
          const capRaw = e.dataTransfer.getData(MIME_CAPTAIN);
          if (capRaw) {
            void onDropCaptainOnDate(date, capRaw);
            return;
          }
          const raw = e.dataTransfer.getData(MIME_HOSTING);
          if (!raw) return;
          try {
            const { id: dragId, fromDate } = JSON.parse(raw) as { id: number; fromDate: string };
            if (fromDate !== date) {
              void moveToDate(dragId, date);
              return;
            }
            void onDropOnCard(e, date, item, dragId);
          } catch {
            /* ignore */
          }
        }}
        className={`${th.card} ${th.cardAccent} rounded-r-md px-3.5 py-3 pl-3.5 sm:px-4 ${busy ? 'opacity-50' : ''}`}>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 font-mono text-base font-semibold leading-snug tracking-tight text-[#ece8df] sm:text-lg">{item.roleName}</p>
            <div className="flex shrink-0 items-center gap-2.5">
              {item.stuckTask ? (
                <span
                  className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded border border-amber-700/60 bg-amber-950/80 px-2 font-mono text-base font-bold text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                  title="卡任务">
                  !
                </span>
              ) : null}
              <button
                type="button"
                className="whitespace-nowrap text-sm text-[#b87a7a] transition hover:text-[#e8a0a0]"
                onClick={() => void removeItem(item.id)}
                disabled={busy}>
                移除
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              className="max-w-[140px] cursor-pointer rounded border border-[#2a3344] bg-[#0a0d12] px-2.5 py-1.5 text-sm text-[#b8c0cc] outline-none focus:border-[#c8aa6e]/50"
              value={ht}
              onChange={e => void patchItem(item.id, { hostType: e.target.value })}
              disabled={busy}>
              {HOST_TYPES.map(t => (
                <option key={t} value={t}>
                  {HOST_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[#9aa5b4]">
              <input
                type="checkbox"
                className="accent-[#c8aa6e]"
                checked={item.stuckTask}
                onChange={e => void patchItem(item.id, { stuckTask: e.target.checked })}
                disabled={busy}
              />
              卡任务
            </label>
          </div>
        </div>
      </li>
    );
  }

  return (
    <div className={`relative flex h-full min-h-0 flex-1 flex-col overflow-hidden ${th.page}`}>
      {leaveDialogDate !== null ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[100] cursor-default bg-black/55 backdrop-blur-[1px]"
            aria-label="关闭请假确认"
            onClick={() => setLeaveDialogDate(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="hosting-leave-dialog-title"
            className={`fixed left-1/2 top-[42%] z-[101] w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border p-5 shadow-2xl ${th.panel}`}>
            <h2 id="hosting-leave-dialog-title" className={`text-center text-base font-semibold ${th.gold}`}>
              真的要请假吗？
            </h2>
            <p className={`mt-2 text-center font-mono text-xs ${th.muted}`}>
              {leaveDialogDate} · {weekdayLabel(leaveDialogDate)}
            </p>
            <p className={`mt-3 text-center text-sm leading-relaxed ${th.muted}`}>确认是否抛弃该日老板们？</p>
            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row-reverse sm:justify-center sm:gap-3">
              <button
                type="button"
                disabled={busy}
                className="w-full rounded border border-rose-900/55 bg-rose-950/35 px-4 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-950/55 disabled:opacity-40 sm:w-auto sm:min-w-[120px]"
                onClick={async () => {
                  const d = leaveDialogDate;
                  if (!d) return;
                  const ok = await submitLeave(d, true);
                  if (ok) setLeaveDialogDate(null);
                }}>
                确认抛弃
              </button>
              <button
                type="button"
                className={`w-full sm:w-auto sm:min-w-[120px] ${th.btn}`}
                onClick={() => setLeaveDialogDate(null)}>
                我要上班
              </button>
            </div>
          </div>
        </>
      ) : null}

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6">
        {toast ? <p className={`mb-3 shrink-0 rounded px-3 py-2 text-sm ${th.toastOk}`}>{toast}</p> : null}
        {error ? <p className={`mb-3 shrink-0 rounded px-3 py-2 text-sm ${th.toastErr}`}>{error}</p> : null}

        {loading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <p className={`py-16 text-center font-mono text-sm ${th.muted}`}>同步任务数据…</p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row lg:gap-0">
            {/* 任务列表：本周排期 + 当日队列 */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:pr-4">
              <button
                type="button"
                className={`mb-1 flex shrink-0 items-center justify-between gap-2 rounded-md border border-[#c8aa6e]/25 px-3 py-2.5 text-left transition hover:border-[#c8aa6e]/45 ${th.panel}`}
                onClick={() => setScheduleOpen(o => !o)}
                aria-expanded={scheduleOpen}>
                <span className={`font-mono text-xs font-semibold uppercase tracking-[0.14em] ${th.gold}`}>任务列表 · 本周排期</span>
                <CollapseChevron open={scheduleOpen} />
              </button>
              {scheduleOpen ? (
                <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0">
                  <div className="w-full max-w-5xl xl:max-w-6xl">
                    <p className={`mb-3 font-mono text-xs uppercase tracking-[0.12em] ${th.muted}`}>
                      本周排期（周一至周日）· 红框为本周最后一天 · 左侧每日下方可标记请假，主页预案该日红框显示已请假
                    </p>
                    {displayDates.map((date: string, idx: number) => {
                      const list = byDate.get(date) ?? [];
                      const { dayNum, ym, wd } = parseMissionDate(date);
                      const isHover = hoverDate === date;
                      const isWeekLastDay = idx === displayDates.length - 1;
                      return (
                        <section
                          key={date}
                          title={isWeekLastDay ? '本周最后一天（周日）' : undefined}
                          className={`relative flex min-h-[1px] rounded-md ${isWeekLastDay ? 'ring-2 ring-inset ring-[#b91c1c]/85' : ''}`}>
                          {idx < displayDates.length - 1 ? (
                            <div
                              className="pointer-events-none absolute bottom-0 left-[100px] top-[7.25rem] w-px bg-gradient-to-b from-[#c8aa6e]/35 via-[#2a3344] to-transparent sm:left-[120px] sm:top-[7.75rem]"
                              aria-hidden
                            />
                          ) : null}

                          <div
                            className={`relative flex w-[100px] shrink-0 flex-col items-end border-r ${th.line} ${th.rail} py-5 pr-3 sm:w-[120px] sm:pr-4 ${
                              leaveSet.has(date) ? 'bg-rose-950/20 ring-1 ring-inset ring-rose-900/35' : ''
                            }`}>
                            <span className="font-mono text-4xl font-bold leading-none tracking-tight text-[#c8aa6e] sm:text-5xl">{dayNum}</span>
                            <span className="mt-1.5 font-mono text-xs tracking-widest text-[#5c6574]">{ym}</span>
                            <span className="mt-1 text-sm text-[#8a9199]">{wd}</span>
                            <div className="mt-3 flex w-full flex-col items-end gap-1.5">
                              {leaveSet.has(date) ? (
                                <>
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-400/95">已请假</span>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void submitLeave(date, false)}
                                    className={`${th.btnGhost} max-w-full whitespace-normal px-2 py-1 text-center text-[10px] leading-tight sm:text-[11px]`}>
                                    取消请假
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setLeaveDialogDate(date)}
                                  className={`${th.btnGhost} border-amber-900/40 px-2 py-1 text-[10px] font-semibold text-amber-200/90 hover:border-amber-700/50 sm:text-[11px]`}>
                                  请假
                                </button>
                              )}
                            </div>
                          </div>

                          <div
                            className={`min-h-[104px] flex-1 border-b ${th.line} py-4 pl-3 pr-2 transition sm:pl-5 sm:pr-3 ${
                              isHover ? 'bg-[rgba(200,170,110,0.07)] ring-1 ring-inset ring-[#c8aa6e]/35' : 'bg-[#0a0c10]/50'
                            }`}
                            onDragOver={e => onDragOverZone(e, date)}
                            onDragLeave={e => {
                              if (!e.currentTarget.contains(e.relatedTarget as Node)) setHoverDate(null);
                            }}
                            onDrop={e => void onDropOnDayZone(e, date)}>
                            <div className="mb-2 flex items-center justify-between gap-2 pr-1">
                              <button
                                type="button"
                                className="group flex min-w-0 items-center gap-1.5 rounded border border-transparent px-1 py-0.5 text-left transition hover:border-[#c8aa6e]/35 hover:bg-[#c8aa6e]/8"
                                onClick={e => {
                                  e.stopPropagation();
                                  setCollapsedDayQueues(prev => {
                                    const n = new Set(prev);
                                    if (n.has(date)) n.delete(date);
                                    else n.add(date);
                                    return n;
                                  });
                                }}
                                aria-expanded={!collapsedDayQueues.has(date)}
                                title={collapsedDayQueues.has(date) ? '展开当日队列' : '收起当日队列'}>
                                <CollapseChevron open={!collapsedDayQueues.has(date)} size="sm" className="text-[#c8aa6e]" />
                                <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#c8aa6e] group-hover:text-[#dfc48a]">
                                  当日队列
                                </span>
                              </button>
                              <span className={`shrink-0 text-xs ${th.muted}`}>{list.length} 项</span>
                            </div>

                            {!collapsedDayQueues.has(date) ? (
                              list.length === 0 ? (
                                <div
                                  className={`flex min-h-[76px] items-center justify-center rounded-md border border-dashed px-3 py-6 text-center font-mono text-sm leading-relaxed transition ${
                                    isHover ? 'border-[#c8aa6e]/50 bg-[rgba(200,170,110,0.05)] text-[#d4c4a0]' : 'border-[#2a3344] text-[#6d7684]'
                                  }`}>
                                  从右侧「舰长池」拖入此处；或拖至本周其他日
                                </div>
                              ) : (
                                <ul className="flex flex-col gap-2.5 pr-1">{list.map(item => renderMissionCard(item, date))}</ul>
                              )
                            ) : (
                              <div
                                className={`flex min-h-[76px] items-center justify-center rounded-md border border-dashed px-3 py-5 text-center text-xs leading-relaxed transition ${
                                  isHover ? 'border-[#c8aa6e]/50 bg-[rgba(200,170,110,0.05)] text-[#b8a880]' : 'border-[#2a3344] text-[#6d7684]'
                                }`}>
                                已收起 · 仍可拖入舰长 · 点击「当日队列」展开查看
                              </div>
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            {/* 舰长池（拖出为 copy，不减少列表） */}
            <aside
              className={`flex shrink-0 flex-col overflow-hidden border-t ${th.line} bg-[#0a0c10] transition-[width,max-height] duration-200 ease-out lg:min-h-0 lg:border-l lg:border-t-0 lg:bg-[#0c0f14] ${
                poolOpen
                  ? 'max-h-[min(44vh,400px)] min-h-0 w-full lg:max-h-none lg:w-80 xl:w-96'
                  : 'max-h-[3.5rem] min-h-0 w-full lg:max-h-none lg:w-11'
              }`}>
              <div className={`flex shrink-0 items-center gap-2 border-b ${th.line} px-2 py-2 sm:px-3`}>
                <button
                  type="button"
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left ${!poolOpen ? 'lg:flex-col lg:justify-center lg:gap-1.5 lg:py-3' : ''}`}
                  onClick={() => setPoolOpen(o => !o)}
                  aria-expanded={poolOpen}
                  title={poolOpen ? '收起舰长池' : '展开舰长池'}>
                  <CollapseChevron open={poolOpen} className="shrink-0" />
                  {poolOpen ? (
                    <span className="truncate font-mono text-sm font-semibold uppercase tracking-[0.12em] text-[#c8aa6e]">舰长池</span>
                  ) : (
                    <>
                      <span className="truncate font-mono text-sm font-semibold uppercase tracking-[0.12em] text-[#c8aa6e] lg:hidden">舰长池</span>
                      <span className="hidden select-none font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8aa6e] lg:block lg:[writing-mode:vertical-rl]">
                        舰长池
                      </span>
                    </>
                  )}
                </button>
                {poolOpen ? (
                  <button
                    type="button"
                    onClick={() => void load({ silent: true })}
                    disabled={loading || busy}
                    className={`${th.btnGhost} shrink-0 whitespace-nowrap px-2 py-1 text-[11px]`}>
                    刷新
                  </button>
                ) : null}
              </div>
              {poolOpen ? (
                <>
                  <div className={`shrink-0 border-b ${th.line} px-3 py-2`}>
                    <label className={`mb-1 block font-mono text-[10px] uppercase tracking-wider ${th.muted}`}>关键字筛选</label>
                    <input
                      type="search"
                      className={`${th.input} w-full text-sm`}
                      value={captainFilter}
                      onChange={e => setCaptainFilter(e.target.value)}
                      placeholder="姓名、UID、备注…"
                      disabled={busy}
                      autoComplete="off"
                    />
                  </div>
                  <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
                    {captains.length === 0 ? (
                      <p className={`px-1 py-6 text-center text-xs leading-relaxed ${th.muted}`}>
                        暂无舰长档案。请先在「舰长管理」中添加后再从此处拖入。
                      </p>
                    ) : filteredCaptains.length === 0 ? (
                      <p className={`px-1 py-6 text-center text-sm leading-relaxed ${th.muted}`}>无匹配舰长，请调整筛选关键字。</p>
                    ) : (
                      <div className="flex flex-col">
                        {T9_GROUP_KEYS.map(key => {
                          const groupList = captainsByT9.get(key) ?? [];
                          if (groupList.length === 0) return null;
                          return (
                            <div key={key} className="mb-5 last:mb-0">
                              <div
                                className={`sticky top-0 z-[1] -mx-1 mb-2 flex items-center justify-between gap-2 border-b ${th.line} bg-[#0c0f14] px-1 py-2`}>
                                <span className="min-w-0 truncate font-mono text-xs font-semibold tracking-wide text-[#c8aa6e]">
                                  {T9_GROUP_LABEL[key]}
                                </span>
                                <button
                                  type="button"
                                  className="flex shrink-0 items-center gap-1 rounded border border-[#2a3344] bg-[#12161f] px-1.5 py-1 text-[10px] font-medium text-[#c8aa6e] transition hover:border-[#c8aa6e]/40 hover:bg-[#c8aa6e]/10"
                                  onClick={() =>
                                    setCollapsedCaptainGroups(prev => {
                                      const n = new Set(prev);
                                      if (n.has(key)) n.delete(key);
                                      else n.add(key);
                                      return n;
                                    })
                                  }
                                  aria-expanded={!collapsedCaptainGroups.has(key)}
                                  title={collapsedCaptainGroups.has(key) ? '展开分组' : '收起分组'}>
                                  <CollapseChevron open={!collapsedCaptainGroups.has(key)} size="sm" />
                                  <span className="hidden sm:inline">{collapsedCaptainGroups.has(key) ? '展开' : '收起'}</span>
                                </button>
                              </div>
                              {!collapsedCaptainGroups.has(key) ? (
                              <ul className="flex flex-col gap-2">
                                {groupList.map(c => {
                                  const scheduleLabel = captainScheduleName(c);
                                  const poolLine = captainPoolDisplayLine(c);
                                  return (
                                    <li key={c.id}>
                                      <div
                                        draggable
                                        onDragStart={e => onDragStartCaptain(e, c)}
                                        className={`flex cursor-grab items-center gap-3 rounded-md border ${th.line} bg-gradient-to-r from-[#12161f] to-[#0e1118] px-3 py-2.5 transition active:cursor-grabbing hover:border-[#c8aa6e]/30 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
                                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[#2a3344] bg-[#0a0d12]">
                                          {c.avatarUrl ? (
                                            <img
                                              src={captainAvatarImgSrc(c.avatarUrl, c.updatedAt)}
                                              alt=""
                                              referrerPolicy={captainAvatarImgReferrerPolicy(c.avatarUrl)}
                                              className="h-full w-full object-cover"
                                            />
                                          ) : (
                                            <div className="flex h-full w-full items-center justify-center font-mono text-xs text-[#6d7684]">
                                              {scheduleLabel.slice(0, 2)}
                                            </div>
                                          )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate font-mono text-base font-medium text-[#ece8df]">{poolLine}</p>
                                          {c.shipTierLabel ? (
                                            <p className={`mt-0.5 truncate text-xs ${th.muted}`}>{c.shipTierLabel}</p>
                                          ) : null}
                                        </div>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                              ) : (
                                <p></p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </aside>
          </div>
        )}
      </main>

      {pendingWeek ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true">
          <div className={`max-w-md rounded-lg border ${th.line} ${th.panel} p-6 shadow-2xl`}>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#c8aa6e]">调度确认</p>
            <h2 className="mt-2 text-lg font-semibold text-[#ece8df]">最近一周已有该老板的宠幸计划</h2>
            <p className={`mt-3 text-sm leading-relaxed ${th.muted}`}>
              在目标日期前后各 3 天内，已存在同名角色/舰长条目。是否仍要继续添加或移动到此日期？
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className={th.btnGhost}
                disabled={busy}
                onClick={() => {
                  setPendingWeek(null);
                }}>
                取消
              </button>
              <button type="button" className={th.btn} disabled={busy} onClick={() => void confirmWeekOverlapAction()}>
                仍要继续
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
