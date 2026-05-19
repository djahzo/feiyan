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
