/**
 * 数据分析与统计模块
 * 提供托管数据的统计分析功能
 */

import type { HostingTodoRow, CaptainRow } from './db';
import { todayIsoDate } from './hosting-week-utils';

/**
 * 舰长托管频率统计
 * 以「舰长管理」表为主表：每位舰长必定一行（0 次也列出）。
 * 托管记录通过 captain_id 优先、姓名兜底的方式挂到舰长上；
 * 挂不上的历史记录单独成行（linked=false），不丢弃。
 */
export type CaptainFrequencyStats = {
  roleName: string;
  captainId: number | null;   // 关联的舰长 id；未关联记录为 null
  uid: string | null;         // 舰长 UID；未关联记录为 null
  totalCount: number;         // 时间范围内托管次数
  allTimeCount: number;       // 历史累计托管次数（截至今天）
  scanCount: number;          // 时间范围内扫号次数
  groupCount: number;         // 时间范围内组排次数
  lastHostingDate: string | null;  // 历史最近一次托管日期
  daysSinceLastHosting: number | null; // 距离上次托管天数
  avgDaysInterval: number | null;      // 时间范围内平均间隔天数
  linked: boolean;            // 是否对应舰长管理中的舰长
  neverHosted: boolean;       // 历史累计 0 次
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
  totalCaptains: number;          // 舰长管理中的舰长总数
  participatingCaptains: number;  // 时间范围内有托管的舰长数
  neverHostedCaptains: number;    // 历史累计从未托管的舰长数
  unlinkedTodoCount: number;      // 挂不上舰长的历史记录条数
  unlinkedNames: string[];        // 挂不上舰长的历史记录名称
  captainFrequencies: CaptainFrequencyStats[];
  hostTypeDistribution: HostTypeDistribution;
  topScanFrequency: CaptainFrequencyStats[];  // 扫号频率榜单（全部舰长）
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

/** 舰长在列表中的展示名，与「舰长管理」保持一致 */
export function getCaptainDisplayName(
  captain: Pick<CaptainRow, 'uid' | 'id_name' | 'remark_name'>
): string {
  return captain.remark_name || captain.id_name || `UID-${captain.uid}`;
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

type CaptainIndex = {
  byId: Map<number, CaptainRow>;
  byName: Map<string, CaptainRow>;
};

/**
 * 建立舰长索引：id 精确匹配优先，姓名（备注名 / 昵称 / UID）兜底。
 * 重名时不参与姓名兜底，避免把记录算到错的人头上。
 */
function buildCaptainIndex(captains: CaptainRow[]): CaptainIndex {
  const byId = new Map<number, CaptainRow>();
  const byName = new Map<string, CaptainRow>();
  const ambiguous = new Set<string>();

  for (const captain of captains) {
    byId.set(captain.id, captain);
    const aliases = [
      captain.remark_name,
      captain.id_name,
      `UID-${captain.uid}`,
      captain.uid,
      getCaptainDisplayName(captain),
    ];
    for (const alias of aliases) {
      if (!alias) continue;
      const key = normalizeName(alias);
      if (!key) continue;
      const existing = byName.get(key);
      if (existing && existing.id !== captain.id) {
        ambiguous.add(key);
        continue;
      }
      byName.set(key, captain);
    }
  }

  for (const key of ambiguous) byName.delete(key);
  return { byId, byName };
}

/** 一条托管记录归属哪位舰长：captain_id 优先，姓名兜底 */
function resolveCaptain(todo: HostingTodoRow, index: CaptainIndex): CaptainRow | null {
  if (todo.captain_id != null) {
    const byId = index.byId.get(todo.captain_id);
    if (byId) return byId;
  }
  return index.byName.get(normalizeName(todo.role_name)) ?? null;
}

type StatBucket = {
  stats: CaptainFrequencyStats;
  rangeDates: string[];
};

/**
 * 以舰长表为主表统计托管频率
 * - 每位舰长固定一行，时间范围内 0 次也会返回
 * - 托管记录按 captain_id → 姓名 的顺序归到舰长
 * - 归不上的记录按原名单独成行，linked=false
 */
function buildCaptainStats(
  todos: HostingTodoRow[],
  captains: CaptainRow[],
  startDate: string,
  endDate: string
): CaptainFrequencyStats[] {
  const today = todayIsoDate();
  const start = startDate || '2000-01-01';
  // 结束日期不超过今天（防止用户选未来日期把预排算成"已托管"）
  const end = endDate && endDate <= today ? endDate : today;

  const index = buildCaptainIndex(captains);
  const buckets = new Map<string, StatBucket>();

  const createBucket = (
    key: string,
    roleName: string,
    captain: CaptainRow | null
  ): StatBucket => {
    const stats: CaptainFrequencyStats = {
      roleName,
      captainId: captain ? captain.id : null,
      uid: captain ? captain.uid : null,
      totalCount: 0,
      allTimeCount: 0,
      scanCount: 0,
      groupCount: 0,
      lastHostingDate: null,
      daysSinceLastHosting: null,
      avgDaysInterval: null,
      linked: captain != null,
      neverHosted: true,
    };
    const bucket = { stats, rangeDates: [] };
    buckets.set(key, bucket);
    return bucket;
  };

  // 主表：舰长管理里的每一位（含从未托管）
  for (const captain of captains) {
    createBucket(`c${captain.id}`, getCaptainDisplayName(captain), captain);
  }

  for (const todo of todos) {
    const captain = resolveCaptain(todo, index);
    const roleName = captain ? getCaptainDisplayName(captain) : (todo.role_name ?? '').trim();
    const key = captain ? `c${captain.id}` : `u:${normalizeName(roleName)}`;

    const bucket = buckets.get(key) ?? createBucket(key, roleName || '（未命名）', captain);
    const s = bucket.stats;

    // 历史累计：截至今天的全部记录
    if (todo.todo_date <= today) {
      s.allTimeCount++;
      s.neverHosted = false;
      if (!s.lastHostingDate || todo.todo_date > s.lastHostingDate) {
        s.lastHostingDate = todo.todo_date;
      }
    }

    // 时间范围：用于榜单与本期统计
    if (todo.todo_date >= start && todo.todo_date <= end) {
      s.totalCount++;
      bucket.rangeDates.push(todo.todo_date);
      if (todo.host_type === 'scan') s.scanCount++;
      if (todo.host_type === 'group') s.groupCount++;
    }
  }

  for (const bucket of buckets.values()) {
    const s = bucket.stats;
    if (s.lastHostingDate) {
      s.daysSinceLastHosting = daysBetween(s.lastHostingDate, today);
    }
    if (bucket.rangeDates.length > 1) {
      const dates = [...bucket.rangeDates].sort();
      const span = daysBetween(dates[0], dates[dates.length - 1]);
      s.avgDaysInterval = Math.round(span / (dates.length - 1));
    }
  }

  return Array.from(buckets.values())
    .map((b) => b.stats)
    .sort((a, b) => {
      // 真实舰长在前，未关联的历史记录排最后
      if (a.linked !== b.linked) return a.linked ? -1 : 1;
      if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
      if (b.allTimeCount !== a.allTimeCount) return b.allTimeCount - a.allTimeCount;
      return a.roleName.localeCompare(b.roleName, 'zh-CN');
    });
}

/**
 * 分析舰长托管频率（以舰长管理表为主表，0 次也列出）
 */
export function analyzeCaptainFrequency(
  todos: HostingTodoRow[],
  captains: CaptainRow[],
  startDate?: string,
  endDate?: string
): CaptainFrequencyStats[] {
  return buildCaptainStats(todos, captains, startDate || '2000-01-01', endDate || todayIsoDate());
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
 * 获取扫号频率榜单（全部舰长，含 0 次）
 * 按历史累计托管次数降序，同频率的按距今最久排序
 * 仅统计已发生的托管（todo_date <= 今天），不计入未来排期
 */
export function getTopScanFrequency(
  todos: HostingTodoRow[],
  captains: CaptainRow[],
  topN: number = Number.MAX_SAFE_INTEGER
): CaptainFrequencyStats[] {
  const today = todayIsoDate();
  // 时间范围放开到「全部历史 → 今天」，得到历史累计口径
  const all = buildCaptainStats(todos, captains, '2000-01-01', today);

  // 榜单按历史累计排序；累计次数写回 totalCount 以复用同一张表
  const sorted = all
    .map((s) => ({ ...s, totalCount: s.allTimeCount }))
    .sort((a, b) => {
      if (a.linked !== b.linked) return a.linked ? -1 : 1;
      if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
      const aDays = a.daysSinceLastHosting ?? 0;
      const bDays = b.daysSinceLastHosting ?? 0;
      if (bDays !== aDays) return bDays - aDays;
      return a.roleName.localeCompare(b.roleName, 'zh-CN');
    });

  return sorted.slice(0, topN);
}

/**
 * 获取时间范围内的完整统计
 */
export function getTimeRangeStats(
  todos: HostingTodoRow[],
  captains: CaptainRow[],
  startDate: string,
  endDate: string
): TimeRangeStats {
  const filtered = todos.filter((t) => t.todo_date >= startDate && t.todo_date <= endDate);

  const captainFrequencies = analyzeCaptainFrequency(todos, captains, startDate, endDate);
  const hostTypeDistribution = analyzeHostTypeDistribution(todos, startDate, endDate);
  const topScanFrequency = getTopScanFrequency(todos, captains);  // 返回全部舰长

  const uniqueDates = new Set(filtered.map((t) => t.todo_date));
  const totalDays = daysBetween(startDate, endDate) + 1;

  const linkedRows = captainFrequencies.filter((s) => s.linked);
  const unlinkedRows = captainFrequencies.filter((s) => !s.linked);

  return {
    startDate,
    endDate,
    totalDays,
    hostingDays: uniqueDates.size,
    totalTodos: filtered.length,
    avgTodosPerDay: uniqueDates.size > 0 ? Math.round((filtered.length / uniqueDates.size) * 10) / 10 : 0,
    totalCaptains: captains.length,
    participatingCaptains: linkedRows.filter((s) => s.totalCount > 0).length,
    neverHostedCaptains: linkedRows.filter((s) => s.neverHosted).length,
    unlinkedTodoCount: unlinkedRows.reduce((sum, s) => sum + s.allTimeCount, 0),
    unlinkedNames: unlinkedRows.map((s) => s.roleName),
    captainFrequencies,
    hostTypeDistribution,
    topScanFrequency,
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
    const headers = [
      '舰长名称', 'UID', '本期次数', '历史累计次数', '扫号次数', '组排次数',
      '最近托管日期', '距今天数', '平均间隔', '状态',
    ];
    const rows = captainData.map((d) => [
      d.roleName,
      d.uid ?? '-',
      d.totalCount,
      d.allTimeCount,
      d.scanCount,
      d.groupCount,
      d.lastHostingDate || '-',
      d.daysSinceLastHosting ?? '-',
      d.avgDaysInterval ?? '-',
      !d.linked ? '未关联舰长' : d.neverHosted ? '从未托管' : '正常',
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
