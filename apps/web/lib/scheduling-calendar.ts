/**
 * 智能排班日历生成器
 *
 * 给定当前舰长队列和配置，生成未来 N 天的推荐排班表。
 * 每天推荐 dailySlots 个舰长，同时实时更新每位舰长的状态（本周已排、债务抵扣等）。
 */

import type { CaptainRow, HostingTodoRow } from './db';
import type { SchedulingRotationConfig, CaptainRotationStatus } from './scheduling-rotation';
import { calculateCaptainRotationStatus, getRotationQueue } from './scheduling-rotation';
import { addDaysIso } from './hosting-todo-schedule';
import { todayIsoDate, mondayIsoOfWeekContaining, isoDatesCurrentWeek } from './hosting-week-utils';

/** 单日推荐结果 */
export type DaySchedule = {
  date: string;
  dayOfWeek: string; // 周一～周日
  recommendations: CaptainRotationStatus[];
};

/** 生成未来 N 天的推荐排班表 */
export function generateScheduleCalendar(
  captains: CaptainRow[],
  existingTodos: HostingTodoRow[],
  config: SchedulingRotationConfig,
  startDate: string = todayIsoDate(),
  days: number = 14,
): DaySchedule[] {
  if (!config.enabled || days <= 0) return [];

  const calendar: DaySchedule[] = [];
  // 拷贝一份 todos，后续会模拟追加新排班
  const virtualTodos = [...existingTodos];

  for (let i = 0; i < days; i++) {
    const date = addDaysIso(startDate, i);
    const dayOfWeek = getDayOfWeekLabel(date);

    // 重新计算当前队列（基于已有 + 已模拟的排班）
    const queue = getRotationQueue(captains, virtualTodos, config);
    const eligible = queue.filter((c) => !c.excluded);

    // 取前 dailySlots 个
    const picked = eligible.slice(0, config.dailySlots);

    // 模拟追加到虚拟 todos（下一天计算时会看到这些排班）
    picked.forEach((cap) => {
      virtualTodos.push({
        id: -1, // 虚拟 id
        todo_date: date,
        role_name: cap.displayName,
        host_type: 'daily',
        stuck_task: 0,
        sort_order: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    });

    calendar.push({ date, dayOfWeek, recommendations: picked });
  }

  return calendar;
}

function getDayOfWeekLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay(); // 0=周日
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return labels[dow];
}
