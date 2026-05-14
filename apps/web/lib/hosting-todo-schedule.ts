import type { HostingTodoRow } from '@/lib/db';

export type SchedulingRow = Pick<HostingTodoRow, 'id' | 'todo_date' | 'role_name'>;

export function normalizeRoleName(name: string): string {
  return name.trim().toLowerCase();
}

/** ISO 日期加减天数（本地日历日） */
export function addDaysIso(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + deltaDays);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

/** 含 center 在内共 before+center+after+1 天：默认前 3 + 当天 + 后 3 = 7 天 */
export function isoDateWindowInclusive(centerIso: string, daysBefore: number, daysAfter: number): Set<string> {
  const set = new Set<string>();
  for (let i = -daysBefore; i <= daysAfter; i++) {
    set.add(addDaysIso(centerIso, i));
  }
  return set;
}

export type ScheduleConflict = {
  sameDayBlocked: boolean;
  /** 在「前三天～后三天」窗口内已有同角色（当日重复已在 sameDayBlocked 处理） */
  weekNeedsAck: boolean;
};

/**
 * @param excludeId 移动/编辑时排除自身 id；新建不传
 */
export function analyzeRoleScheduleConflict(
  rows: SchedulingRow[],
  input: { targetDate: string; roleName: string; excludeId?: number },
): ScheduleConflict {
  const role = normalizeRoleName(input.roleName);
  if (!role) return { sameDayBlocked: false, weekNeedsAck: false };

  const window = isoDateWindowInclusive(input.targetDate, 3, 3);
  const ex = input.excludeId;

  const sameDayBlocked = rows.some(
    r => r.todo_date === input.targetDate && normalizeRoleName(r.role_name) === role && (ex == null || r.id !== ex),
  );
  if (sameDayBlocked) return { sameDayBlocked: true, weekNeedsAck: false };

  const weekNeedsAck = rows.some(
    r => (ex == null || r.id !== ex) && normalizeRoleName(r.role_name) === role && window.has(r.todo_date),
  );
  return { sameDayBlocked: false, weekNeedsAck };
}
