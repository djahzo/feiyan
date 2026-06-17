/**
 * 托管排期轮值系统
 *
 * 核心原则：
 *   这不是"推荐算法"，是"轮值队列" — 每位舰长付了同样的钱，系统欠他们的是公平轮到的机会。
 *
 * 设计：
 *   1. 主排序：需求债务 = 全体平均托管次数 - 本人已托管次数
 *      → 正值 = 系统欠这个舰长的轮值次数（低于平均）
 *      → 负值 = 这个舰长已超额托管（高于平均）
 *      → 债务最高的排最前
 *      （放弃"加入天数"维度——该数据不可靠/获取不到）
 *
 *   2. Tiebreaker：
 *      a. 债务相等 → 距上次托管天数长的优先（从未托管视为最久）
 *      b. 仍相等 → captain.id 升序（稳定排序，避免随机抖动）
 *
 *   3. 匹配：托管记录通过 captain_id 关联舰长（唯一 id），不再用 role_name 简称
 *
 *   4. 硬过滤：不参与打分，直接剔除
 *      - 过期舰长 / 本周已排 / 本月已排（均可选）
 *
 *   5. 其他因子（等级、头像、数据完整性、卡任务）不影响排序，仅作展示标签
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

  /** 需求债务 = 全体平均托管次数 - 本人已托管次数 */
  demandDebt: number;

  /** 距上次托管天数（null = 从未托管） */
  daysSinceLastHosting: number | null;

  /** 是否被过滤器排除 */
  excluded: boolean;
  excludeReason: string | null;

  // ===== 透明化数据（供展示 / 审计） =====
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

/** 通过 captain_id 关联托管记录（唯一 id 匹配，不再用 role_name 简称） */
function findCaptainTodos(captain: CaptainRow, todos: HostingTodoRow[]): HostingTodoRow[] {
  return todos.filter((t) => t.captain_id === captain.id);
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
 * @param avgHostingCount 全体舰长的平均托管次数（债务基线）
 */
export function calculateCaptainRotationStatus(
  captain: CaptainRow,
  todos: HostingTodoRow[],
  config: SchedulingRotationConfig,
  avgHostingCount: number,
): CaptainRotationStatus {
  const today = todayIsoDate();
  const displayName = getCaptainDisplayName(captain);
  const expireStatus = getCaptainExpireStatus(captain);

  const captainTodos = findCaptainTodos(captain, todos);
  const totalHostingCount = captainTodos.length;

  // 时间统计
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

  // **核心债务计算：全体平均托管次数 - 本人已托管次数**
  // 正值 = 低于平均（系统欠他轮值），负值 = 超额托管
  const demandDebt = avgHostingCount - totalHostingCount;

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
 *   2. 主键：债务降序（欠得越多越优先）
 *   3. Tiebreaker a：距上次托管天数降序（从未托管视为最久 = Infinity）
 *   4. Tiebreaker b：captain.id 升序（稳定，避免随机抖动）
 */
export function getRotationQueue(
  captains: CaptainRow[],
  todos: HostingTodoRow[],
  config: SchedulingRotationConfig = DEFAULT_ROTATION_CONFIG,
): CaptainRotationStatus[] {
  if (!config.enabled) return [];

  // 债务基线：全体平均托管次数 = 关联到任一舰长的托管记录数 / 舰长总数
  const activeCaptainCount = Math.max(captains.length, 1);
  const captainIds = new Set(captains.map((c) => c.id));
  const matchedTodoCount = todos.filter((t) => t.captain_id != null && captainIds.has(t.captain_id)).length;
  const avgHostingCount = matchedTodoCount / activeCaptainCount;

  const statuses = captains.map((cap) =>
    calculateCaptainRotationStatus(cap, todos, config, avgHostingCount),
  );

  return statuses.sort((a, b) => {
    // 未排除的排在前面
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;

    // 主键：债务降序（欠得越多越优先）
    if (Math.abs(b.demandDebt - a.demandDebt) > 0.001) {
      return b.demandDebt - a.demandDebt;
    }

    // Tiebreaker a：距上次托管天数降序（null 视为无穷大，即从未托管优先）
    const aDays = a.daysSinceLastHosting ?? Infinity;
    const bDays = b.daysSinceLastHosting ?? Infinity;
    if (aDays !== bDays) return bDays - aDays;

    // Tiebreaker b：captain.id 升序（稳定排序，消除随机抖动）
    return a.captainId - b.captainId;
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
