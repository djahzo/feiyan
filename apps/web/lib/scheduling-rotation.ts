/**
 * 托管排期轮值系统
 *
 * 核心原则：
 *   这不是"推荐算法"，是"轮值队列" — 每位舰长付了同样的钱，系统欠他们的是公平轮到的机会。
 *
 * 设计：
 *   1. 主排序：需求债务 = (每日名额/舰长总数) × 加入天数 - 已托管次数
 *      → 正值 = 系统欠这个舰长的轮值次数
 *      → 负值 = 这个舰长已超额托管
 *      → 债务最高的排最前
 *
 *   2. Tiebreaker：当债务相等时，距上次托管天数长的优先
 *
 *   3. 硬过滤：不参与打分，直接剔除
 *      - 过期舰长（可选）
 *      - 本周已排过（可选）
 *      - 本月已排过（可选）
 *
 *   4. 其他因子（舰长等级、头像、数据完整性、卡任务历史）不影响排序
 *      → 这些是"质量标签"，不是"轮值资格"
 */

import type { CaptainRow, HostingTodoRow } from './db';
import { todayIsoDate, mondayIsoOfWeekContaining, isoDatesCurrentWeek } from './hosting-week-utils';

/** 轮值策略配置（只保留硬约束） */
export type SchedulingRotationConfig = {
  /** 是否启用智能排期（false 则完全手动） */
  enabled: boolean;

  /** 每日排班名额 */
  dailySlots: number;

  /** 每周期天数（用于「下一周期」按钮） */
  periodDays: number;

  // ===== 硬过滤规则（直接剔除，不参与排序） =====
  /** 排除本周已排过的 */
  excludeScheduledThisWeek: boolean;
  /** 排除本月已排过的 */
  excludeScheduledThisMonth: boolean;
  /** 排除已过期舰长 */
  excludeExpired: boolean;
};

/** 默认配置 */
export const DEFAULT_ROTATION_CONFIG: SchedulingRotationConfig = {
  enabled: true,
  dailySlots: 2,
  periodDays: 7,
  excludeScheduledThisWeek: false,
  excludeScheduledThisMonth: false,
  excludeExpired: false,
};

/** 单个舰长的轮值状态 */
export type CaptainRotationStatus = {
  captainId: number;
  uid: string;
  displayName: string;

  /** 需求债务 = (每日名额/舰长总数) × 加入天数 - 已托管次数 */
  demandDebt: number;

  /** 距上次托管天数（null = 从未托管） */
  daysSinceLastHosting: number | null;

  /** 是否被过滤器排除 */
  excluded: boolean;
  excludeReason: string | null;

  // ===== 透明化数据（供展示 / 审计） =====
  daysSinceJoin: number;
  totalHostingCount: number;
  weekHostingCount: number;
  monthHostingCount: number;
  lastHostingDate: string | null;
  firstHostingDate: string | null;
  expireStatus: 'active' | 'expired' | 'none';

  // ===== 质量标签（仅供展示，不参与排序） =====
  shipTier: string | null;
  hasAvatar: boolean;
  dataCompleteness: number; // 0-4 (备注/ID/微信/游戏ID)
  hasStuckTaskHistory: boolean;
};

// ==================== 工具函数 ====================

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function daysSinceTimestamp(ts: number | null | undefined): number {
  if (!ts || !Number.isFinite(ts)) return 0;
  const diffMs = Date.now() - ts;
  return diffMs < 0 ? 0 : Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getCaptainDisplayName(captain: CaptainRow): string {
  return captain.remark_name || captain.id_name || `UID-${captain.uid}`;
}

function getCaptainExpireStatus(captain: CaptainRow): 'active' | 'expired' | 'none' {
  const expiresAt = (captain as unknown as Record<string, unknown>).expires_at;
  if (expiresAt && Number.isFinite(Number(expiresAt))) {
    return Number(expiresAt) > Date.now() ? 'active' : 'expired';
  }
  return 'none';
}

function getDataCompletenessScore(captain: CaptainRow): number {
  let s = 0;
  if (captain.remark_name) s++;
  if (captain.id_name) s++;
  if (captain.wechat_remark) s++;
  if (captain.game_id_remark) s++;
  return s;
}

function findCaptainTodos(captain: CaptainRow, todos: HostingTodoRow[]): HostingTodoRow[] {
  const displayName = getCaptainDisplayName(captain);
  return todos.filter(
    (t) =>
      t.role_name === displayName ||
      (captain.remark_name && t.role_name === captain.remark_name) ||
      (captain.id_name && t.role_name === captain.id_name),
  );
}

function countWeekHosting(todos: HostingTodoRow[]): number {
  const monday = mondayIsoOfWeekContaining(todayIsoDate());
  const weekDates = new Set(isoDatesCurrentWeek(monday));
  return todos.filter((t) => weekDates.has(t.todo_date)).length;
}

function countMonthHosting(todos: HostingTodoRow[]): number {
  const month = todayIsoDate().slice(0, 7);
  return todos.filter((t) => t.todo_date.startsWith(month)).length;
}

function hasStuckHistory(todos: HostingTodoRow[]): boolean {
  return todos.some((t) => t.stuck_task === 1);
}

// ==================== 核心计算 ====================

/**
 * 计算单个舰长的轮值状态
 * @param activeCaptainCount 当前活跃舰长总数（用于债务公式）
 */
export function calculateCaptainRotationStatus(
  captain: CaptainRow,
  todos: HostingTodoRow[],
  config: SchedulingRotationConfig,
  activeCaptainCount: number,
): CaptainRotationStatus {
  const today = todayIsoDate();
  const displayName = getCaptainDisplayName(captain);
  const expireStatus = getCaptainExpireStatus(captain);

  const captainTodos = findCaptainTodos(captain, todos);
  const totalHostingCount = captainTodos.length;

  // 时间统计
  const daysSinceJoin = daysSinceTimestamp(captain.created_at);
  const sortedDates = captainTodos.map((t) => t.todo_date).sort();
  const lastHostingDate = sortedDates.length ? sortedDates[sortedDates.length - 1] : null;
  const firstHostingDate = sortedDates.length ? sortedDates[0] : null;
  const daysSinceLastHosting = lastHostingDate ? daysBetween(lastHostingDate, today) : null;
  const weekHostingCount = countWeekHosting(captainTodos);
  const monthHostingCount = countMonthHosting(captainTodos);

  // 质量标签（仅供展示）
  const hasAvatar = !!(captain.avatar_filename || captain.bilibili_face_url);
  const hasStuckTaskHistory = hasStuckHistory(captainTodos);
  const dataCompleteness = getDataCompletenessScore(captain);

  // **核心债务计算：(每日名额 / 舰长总数) × 加入天数 - 已托管次数**
  const dailyRate = config.dailySlots / Math.max(activeCaptainCount, 1);
  const demandDebt = dailyRate * daysSinceJoin - totalHostingCount;

  // 硬过滤
  let excluded = false;
  let excludeReason: string | null = null;

  if (config.excludeExpired && expireStatus === 'expired') {
    excluded = true;
    excludeReason = '已过期';
  } else if (config.excludeScheduledThisWeek && weekHostingCount > 0) {
    excluded = true;
    excludeReason = '本周已排过';
  } else if (config.excludeScheduledThisMonth && monthHostingCount > 0) {
    excluded = true;
    excludeReason = '本月已排过';
  }

  return {
    captainId: captain.id,
    uid: captain.uid,
    displayName,
    demandDebt,
    daysSinceLastHosting,
    excluded,
    excludeReason,
    daysSinceJoin,
    totalHostingCount,
    weekHostingCount,
    monthHostingCount,
    lastHostingDate,
    firstHostingDate,
    expireStatus,
    shipTier: captain.ship_tier,
    hasAvatar,
    dataCompleteness,
    hasStuckTaskHistory,
  };
}

// ==================== 排序入口 ====================

/**
 * 获取按轮值优先级排序的舰长列表
 *
 * 排序规则：
 *   1. 未排除的在前，已排除的在后
 *   2. 未排除的按：债务降序 → 距上次托管天数降序
 */
export function getRotationQueue(
  captains: CaptainRow[],
  todos: HostingTodoRow[],
  config: SchedulingRotationConfig = DEFAULT_ROTATION_CONFIG,
): CaptainRotationStatus[] {
  if (!config.enabled) return [];

  const activeCaptainCount = captains.length;
  const statuses = captains.map((cap) =>
    calculateCaptainRotationStatus(cap, todos, config, activeCaptainCount),
  );

  return statuses.sort((a, b) => {
    // 未排除的排在前面
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;

    // 主键：债务降序（欠得越多越优先）
    if (Math.abs(b.demandDebt - a.demandDebt) > 0.001) {
      return b.demandDebt - a.demandDebt;
    }

    // Tiebreaker：距上次托管天数降序（null 视为无穷大，即从未托管优先）
    const aDays = a.daysSinceLastHosting ?? Infinity;
    const bDays = b.daysSinceLastHosting ?? Infinity;
    return bDays - aDays;
  });
}

/**
 * 获取前 N 个推荐舰长
 */
export function getTopRecommendations(
  captains: CaptainRow[],
  todos: HostingTodoRow[],
  topN: number = 10,
  config: SchedulingRotationConfig = DEFAULT_ROTATION_CONFIG,
  includeExcluded: boolean = false,
): CaptainRotationStatus[] {
  const queue = getRotationQueue(captains, todos, config);
  const filtered = includeExcluded ? queue : queue.filter((r) => !r.excluded);
  return filtered.slice(0, topN);
}

// ==================== 配置校验 ====================

/**
 * 校验并规范化配置（宽松：缺失字段回退默认值，兼容旧数据）
 * 同时兼容旧版 SchedulingWeightsConfig 结构
 */
export function validateRotationConfig(config: unknown): SchedulingRotationConfig | null {
  if (!config || typeof config !== 'object') return null;
  const c = config as Record<string, unknown>;

  try {
    const dailySlots = Number(c.dailySlots ?? DEFAULT_ROTATION_CONFIG.dailySlots);
    const periodDays = Number(c.periodDays ?? DEFAULT_ROTATION_CONFIG.periodDays);

    // 兼容旧版 filterXxx 字段名
    const excludeScheduledThisWeek = Boolean(
      c.excludeScheduledThisWeek ?? c.filterWeekScheduled ?? DEFAULT_ROTATION_CONFIG.excludeScheduledThisWeek,
    );
    const excludeScheduledThisMonth = Boolean(
      c.excludeScheduledThisMonth ?? c.filterMonthScheduled ?? DEFAULT_ROTATION_CONFIG.excludeScheduledThisMonth,
    );
    const excludeExpired = Boolean(
      c.excludeExpired ?? c.filterExpired ?? DEFAULT_ROTATION_CONFIG.excludeExpired,
    );

    return {
      enabled: Boolean(c.enabled ?? true),
      dailySlots: Number.isFinite(dailySlots) && dailySlots >= 1 && dailySlots <= 10
        ? dailySlots
        : DEFAULT_ROTATION_CONFIG.dailySlots,
      periodDays: Number.isFinite(periodDays) && periodDays >= 1 && periodDays <= 30
        ? periodDays
        : DEFAULT_ROTATION_CONFIG.periodDays,
      excludeScheduledThisWeek,
      excludeScheduledThisMonth,
      excludeExpired,
    };
  } catch {
    return null;
  }
}
