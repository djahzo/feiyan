/**
 * 排期演算日历生成器（支持累积周期滚动）
 *
 * 设计：
 *   - 每次生成一个周期（N 天，N = config.periodDays）
 *   - 支持「下一周期」：基于已演算的前序周期 + 真实历史待办，更新债务后继续生成
 *   - 累积显示多个周期，每个周期可单独导入
 */

import type { CaptainRow, HostingTodoRow } from './db';
import type { SchedulingRotationConfig, CaptainRotationStatus } from './scheduling-rotation';
import { getRotationQueue } from './scheduling-rotation';
import { addDaysIso } from './hosting-todo-schedule';
import { todayIsoDate } from './hosting-week-utils';

/** 单日推荐结果 */
export type DaySchedule = {
  date: string;
  dayOfWeek: string;
  recommendations: CaptainRotationStatus[];
};

/** 单个周期（一段连续的排班） */
export type PeriodSchedule = {
  periodIndex: number; // 第几个周期（0-based）
  startDate: string;
  endDate: string;
  days: DaySchedule[];
};

function getDayOfWeekLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return labels[dow];
}

/**
 * 生成单个周期的排班日历
 *
 * @param captains 舰长列表
 * @param existingTodos 真实历史待办
 * @param accumulatedTodos 之前周期累积的虚拟待办（用于更新债务）
 * @param config 配置
 * @param startDate 本周期起始日
 * @returns 本周期的排班结果 + 新增的虚拟待办（供下一周期使用）
 */
export function generateSinglePeriod(
  captains: CaptainRow[],
  existingTodos: HostingTodoRow[],
  accumulatedTodos: HostingTodoRow[],
  config: SchedulingRotationConfig,
  startDate: string,
): { days: DaySchedule[]; newVirtualTodos: HostingTodoRow[] } {
  if (!config.enabled || config.periodDays <= 0) {
    return { days: [], newVirtualTodos: [] };
  }

  const days: DaySchedule[] = [];
  const newVirtualTodos: HostingTodoRow[] = [];
  // 合并真实历史 + 累积虚拟待办（用于债务计算）
  const allTodos = [...existingTodos, ...accumulatedTodos];

  for (let i = 0; i < config.periodDays; i++) {
    const date = addDaysIso(startDate, i);
    const dayOfWeek = getDayOfWeekLabel(date);

    // 重新计算队列（基于 allTodos + 本周期已模拟的新待办）
    const currentTodos = [...allTodos, ...newVirtualTodos];

    // 调试：打印累积待办数和前5个人的债务
    if (i === 0 || i === 4) {
      console.log(`[${date}] 累积待办数: ${accumulatedTodos.length}, 本周期已排: ${newVirtualTodos.length}`);
    }

    const queue = getRotationQueue(captains, currentTodos, config);
    const eligible = queue.filter((c) => !c.excluded);

    // 取前 dailySlots 个
    const picked = eligible.slice(0, config.dailySlots);

    // 模拟追加到虚拟待办
    picked.forEach((cap) => {
      newVirtualTodos.push({
        id: -1,
        todo_date: date,
        role_name: cap.displayName,
        host_type: 'daily',
        stuck_task: 0,
        sort_order: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    });

    days.push({ date, dayOfWeek, recommendations: picked });
  }

  return { days, newVirtualTodos };
}

/**
 * 生成多个累积周期的排班日历
 *
 * @param captains 舰长列表
 * @param existingTodos 真实历史待办
 * @param config 配置
 * @param periodsCount 生成几个周期
 * @param startDate 第一个周期的起始日（默认今天）
 * @returns 多个周期的排班结果
 */
export function generateMultiplePeriods(
  captains: CaptainRow[],
  existingTodos: HostingTodoRow[],
  config: SchedulingRotationConfig,
  periodsCount: number,
  startDate: string = todayIsoDate(),
): PeriodSchedule[] {
  if (!config.enabled || periodsCount <= 0) return [];

  const periods: PeriodSchedule[] = [];
  let accumulatedTodos: HostingTodoRow[] = [];
  let currentStartDate = startDate;

  for (let p = 0; p < periodsCount; p++) {
    const { days, newVirtualTodos } = generateSinglePeriod(
      captains,
      existingTodos,
      accumulatedTodos,
      config,
      currentStartDate,
    );

    const endDate = days.length > 0 ? days[days.length - 1].date : currentStartDate;

    periods.push({
      periodIndex: p,
      startDate: currentStartDate,
      endDate,
      days,
    });

    // 累积虚拟待办供下一周期使用
    accumulatedTodos = [...accumulatedTodos, ...newVirtualTodos];
    // 下一周期起始日 = 本周期结束日 + 1 天
    currentStartDate = addDaysIso(endDate, 1);
  }

  return periods;
}
