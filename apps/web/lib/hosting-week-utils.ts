import { addDaysIso } from '@/lib/hosting-todo-schedule';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** 业务日历统一用上海时区，避免服务端 UTC 与本地时区不一致 */
export const BUSINESS_TIME_ZONE = 'Asia/Shanghai';

export function todayIsoDate(timeZone: string = BUSINESS_TIME_ZONE) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}

export function weekdayLabel(iso: string) {
  try {
    const [y, m, day] = iso.split('-').map(Number);
    const d = new Date(y, (m || 1) - 1, day || 1);
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()] ?? '';
  } catch {
    return '';
  }
}

/** 含 iso 所在自然周的周一（本地日历，周一至周日为一周期） */
export function mondayIsoOfWeekContaining(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const daysSinceMonday = (dt.getDay() + 6) % 7;
  return addDaysIso(iso, -daysSinceMonday);
}

/** 当周 7 天：周一 → 周日 */
export function isoDatesCurrentWeek(fromIso: string): string[] {
  const mon = mondayIsoOfWeekContaining(fromIso);
  return Array.from({ length: 7 }, (_, i) => addDaysIso(mon, i));
}

/** ISO 日期校验：YYYY-MM-DD（不严格校验日历合法性） */
export function isValidIsoDate(s: string): boolean {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** 解析 ISO 日期得到 {year, month(1-12), day} */
export function parseIsoDateParts(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y || 0, month: m || 0, day: d || 0 };
}

/** 拼出 ISO 日期 */
export function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** 某月 1 日的 ISO（year/month 都按 1-based 月份） */
export function firstIsoOfMonth(year: number, month: number): string {
  return formatIsoDate(year, month, 1);
}

/** 某月共多少天 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * 月日历网格（周一 → 周日）
 * 总是按整周补齐：返回 7 列 × N 行（N 通常 5 或 6）
 * 每个单元格是 ISO 日期；当月外的日子也包含
 */
export function monthCalendarGrid(year: number, month: number): string[][] {
  const first = firstIsoOfMonth(year, month);
  const gridStart = mondayIsoOfWeekContaining(first);
  const lastDay = daysInMonth(year, month);
  const lastIso = formatIsoDate(year, month, lastDay);
  const gridEndExclusive = addDaysIso(mondayIsoOfWeekContaining(lastIso), 7);

  const rows: string[][] = [];
  let cur = gridStart;
  while (cur < gridEndExclusive) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cur);
      cur = addDaysIso(cur, 1);
    }
    rows.push(week);
  }
  return rows;
}

/** 当前年（业务时区）。fromIso 不传则使用今天 */
export function currentYearOfIso(iso: string): number {
  return parseIsoDateParts(iso).year;
}
