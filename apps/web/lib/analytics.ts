/**
 * 数据分析与统计模块
 * 提供托管数据的统计分析功能
 */

import type { HostingTodoRow, CaptainRow } from './db';
import { todayIsoDate } from './hosting-week-utils';

/** 舰长托管频率统计 */
export type CaptainFrequencyStats = {
  roleName: string;
  totalCount: number;        // 总托管次数
  scanCount: number;         // 扫号次数
  groupCount: number;        // 组排次数
  lastHostingDate: string | null;  // 最近一次托管日期
  daysSinceLastHosting: number | null; // 距离上次托管天数
  avgDaysInterval: number | null;      // 平均间隔天数
};

/** 日期托管统计 */
export type DateHostingStats = {
  date: string;
  totalCount: number;
  scanCount: number;
  groupCount: number;
  roleNames: string[];
};

/** 托管类型分布统计 */
export type HostTypeDistribution = {
  scan: number;
  group: number;
  total: number;
  scanPercentage: number;
  groupPercentage: number;
};

/** 时间范围统计 */
export type TimeRangeStats = {
  startDate: string;
  endDate: string;
  totalDays: number;
  hostingDays: number;        // 有托管安排的天数
  totalTodos: number;
  avgTodosPerDay: number;
  captainFrequencies: CaptainFrequencyStats[];
  hostTypeDistribution: HostTypeDistribution;
  busiestDates: DateHostingStats[];  // 最忙的日期（Top 10）
};

/**
 * 计算两个日期之间的天数差
 */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 分析舰长托管频率
 */
export function analyzeCaptainFrequency(
  todos: HostingTodoRow[],
  startDate?: string,
  endDate?: string
): CaptainFrequencyStats[] {
  const today = todayIsoDate();
  const start = startDate || '2000-01-01';
  const end = endDate || '2099-12-31';

  // 过滤时间范围
  const filtered = todos.filter((t) => t.todo_date >= start && t.todo_date <= end);

  // 按舰长分组统计
  const statsMap = new Map<string, CaptainFrequencyStats>();

  for (const todo of filtered) {
    const name = todo.role_name;
    let stats = statsMap.get(name);

    if (!stats) {
      stats = {
        roleName: name,
        totalCount: 0,
        scanCount: 0,
        groupCount: 0,
        lastHostingDate: null,
        daysSinceLastHosting: null,
        avgDaysInterval: null,
      };
      statsMap.set(name, stats);
    }

    stats.totalCount++;
    if (todo.host_type === 'scan') stats.scanCount++;
    if (todo.host_type === 'group') stats.groupCount++;

    // 更新最近托管日期
    if (!stats.lastHostingDate || todo.todo_date > stats.lastHostingDate) {
      stats.lastHostingDate = todo.todo_date;
    }
  }

  // 计算天数和平均间隔
  for (const stats of statsMap.values()) {
    if (stats.lastHostingDate) {
      stats.daysSinceLastHosting = daysBetween(stats.lastHostingDate, today);
    }

    // 计算平均间隔（简化：总天数 / 总次数）
    if (stats.totalCount > 1 && stats.lastHostingDate) {
      const allDates = filtered
        .filter((t) => t.role_name === stats.roleName)
        .map((t) => t.todo_date)
        .sort();

      if (allDates.length > 1) {
        const totalSpan = daysBetween(allDates[0], allDates[allDates.length - 1]);
        stats.avgDaysInterval = Math.round(totalSpan / (allDates.length - 1));
      }
    }
  }

  return Array.from(statsMap.values()).sort((a, b) => b.totalCount - a.totalCount);
}

/**
 * 分析日期托管统计
 */
export function analyzeDateHosting(
  todos: HostingTodoRow[],
  startDate?: string,
  endDate?: string
): DateHostingStats[] {
  const start = startDate || '2000-01-01';
  const end = endDate || '2099-12-31';

  const filtered = todos.filter((t) => t.todo_date >= start && t.todo_date <= end);

  const dateMap = new Map<string, DateHostingStats>();

  for (const todo of filtered) {
    const date = todo.todo_date;
    let stats = dateMap.get(date);

    if (!stats) {
      stats = {
        date,
        totalCount: 0,
        scanCount: 0,
        groupCount: 0,
        roleNames: [],
      };
      dateMap.set(date, stats);
    }

    stats.totalCount++;
    if (todo.host_type === 'scan') stats.scanCount++;
    if (todo.host_type === 'group') stats.groupCount++;
    if (!stats.roleNames.includes(todo.role_name)) {
      stats.roleNames.push(todo.role_name);
    }
  }

  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 分析托管类型分布
 */
export function analyzeHostTypeDistribution(
  todos: HostingTodoRow[],
  startDate?: string,
  endDate?: string
): HostTypeDistribution {
  const start = startDate || '2000-01-01';
  const end = endDate || '2099-12-31';

  const filtered = todos.filter((t) => t.todo_date >= start && t.todo_date <= end);

  const scan = filtered.filter((t) => t.host_type === 'scan').length;
  const group = filtered.filter((t) => t.host_type === 'group').length;
  const total = filtered.length;

  return {
    scan,
    group,
    total,
    scanPercentage: total > 0 ? Math.round((scan / total) * 100) : 0,
    groupPercentage: total > 0 ? Math.round((group / total) * 100) : 0,
  };
}

/**
 * 获取时间范围内的完整统计
 */
export function getTimeRangeStats(
  todos: HostingTodoRow[],
  startDate: string,
  endDate: string
): TimeRangeStats {
  const filtered = todos.filter((t) => t.todo_date >= startDate && t.todo_date <= endDate);

  const captainFrequencies = analyzeCaptainFrequency(todos, startDate, endDate);
  const dateStats = analyzeDateHosting(todos, startDate, endDate);
  const hostTypeDistribution = analyzeHostTypeDistribution(todos, startDate, endDate);

  const uniqueDates = new Set(filtered.map((t) => t.todo_date));
  const totalDays = daysBetween(startDate, endDate) + 1;

  const busiestDates = dateStats
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 10);

  return {
    startDate,
    endDate,
    totalDays,
    hostingDays: uniqueDates.size,
    totalTodos: filtered.length,
    avgTodosPerDay: uniqueDates.size > 0 ? Math.round((filtered.length / uniqueDates.size) * 10) / 10 : 0,
    captainFrequencies,
    hostTypeDistribution,
    busiestDates,
  };
}

/**
 * 导出数据为 CSV 格式
 */
export function exportToCsv(data: CaptainFrequencyStats[] | DateHostingStats[]): string {
  if (data.length === 0) return '';

  // 判断数据类型
  const isCaptainStats = 'roleName' in data[0];

  if (isCaptainStats) {
    const captainData = data as CaptainFrequencyStats[];
    const headers = ['舰长名称', '总次数', '扫号次数', '组排次数', '最近托管日期', '距今天数', '平均间隔'];
    const rows = captainData.map((d) => [
      d.roleName,
      d.totalCount,
      d.scanCount,
      d.groupCount,
      d.lastHostingDate || '-',
      d.daysSinceLastHosting ?? '-',
      d.avgDaysInterval ?? '-',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  } else {
    const dateData = data as DateHostingStats[];
    const headers = ['日期', '总次数', '扫号次数', '组排次数', '舰长列表'];
    const rows = dateData.map((d) => [
      d.date,
      d.totalCount,
      d.scanCount,
      d.groupCount,
      d.roleNames.join(';'),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
