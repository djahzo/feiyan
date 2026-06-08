/**
 * 托管排期推荐系统 —— 需求分数 + 多维度归一化模型
 *
 * 设计原则：
 *   1. 需求分数提供公平性数学基础（循环排队思想）
 *   2. 多个维度因子，每个可独立开关、调权重
 *   3. 关键：所有因子先归一化到 0-100，再乘权重
 *      → 权重 1.0 = 最多贡献 100 分；权重 0.3 = 最多贡献 30 分
 *      → 不同因子的权重终于可以横向比较
 *
 * 加分因子（值越大越该优先）：贡献 = 归一化值 × 权重
 * 减分因子（值越大越该靠后）：贡献 = -归一化值 × 权重
 * 最终分数 = Σ加分 - Σ减分
 */

import type { CaptainRow, HostingTodoRow } from './db';
import { todayIsoDate, mondayIsoOfWeekContaining, isoDatesCurrentWeek } from './hosting-week-utils';

/** 单个权重因子：开关 + 权重系数 */
export type WeightFactor = {
  enabled: boolean;
  weight: number;
};

/** 完整配置 */
export type SchedulingWeightsConfig = {
  enabled: boolean;
  /** 每日排班名额 */
  dailySlots: number;

  // ===== 核心公平因子 =====
  /** 需求分数：(名额/人数)×加入天数 - 已托管次数 */
  demandScore: WeightFactor;
  /** 距上次托管天数 */
  daysSinceLastHosting: WeightFactor;
  /** 距入库天数 */
  daysSinceCreated: WeightFactor;
  /** 距首次托管天数 */
  daysSinceFirstHosting: WeightFactor;

  /** 新舰长加分（从未托管过） */
  newCaptainBonus: WeightFactor;

  // ===== 频率惩罚因子（减分） =====
  /** 历史总托管次数 */
  totalFrequencyPenalty: WeightFactor;
  /** 本周已托管次数 */
  weekFrequencyPenalty: WeightFactor;
  /** 本月已托管次数 */
  monthFrequencyPenalty: WeightFactor;
  /** 最近30天托管次数 */
  recentFrequencyPenalty: WeightFactor;

  // ===== 舰长身份因子（加分） =====
  /** 舰长等级（总督/提督/舰长） */
  shipTier: WeightFactor;
  /** 数据完整性（备注、ID、微信、游戏ID） */
  dataCompleteness: WeightFactor;
  /** 已上传头像 */
  hasAvatar: WeightFactor;

  // ===== 行为因子 =====
  /** 卡任务历史惩罚（减分） */
  stuckTaskPenalty: WeightFactor;
  /** 平均托管间隔（加分，间隔越长越优先） */
  avgIntervalBonus: WeightFactor;

  // ===== 过期处理 =====
  /** 过期舰长惩罚（减分） */
  expiredPenalty: WeightFactor;

  // ===== 过滤器（直接剔除，不计分） =====
  /** 本周已排过的不再推荐 */
  filterWeekScheduled: boolean;
  /** 本月已排过的不再推荐 */
  filterMonthScheduled: boolean;
  /** 排除已过期舰长 */
  filterExpired: boolean;
};

/** 默认配置：核心公平因子默认开，附加因子默认关 */
export const DEFAULT_WEIGHTS_CONFIG: SchedulingWeightsConfig = {
  enabled: true,
  dailySlots: 2,

  // 核心公平因子（默认开启）
  demandScore: { enabled: true, weight: 1.0 },
  daysSinceLastHosting: { enabled: true, weight: 0.6 },
  daysSinceCreated: { enabled: false, weight: 0.3 },
  daysSinceFirstHosting: { enabled: false, weight: 0.1 },
  newCaptainBonus: { enabled: true, weight: 0.8 },

  // 频率惩罚
  totalFrequencyPenalty: { enabled: false, weight: 0.3 },
  weekFrequencyPenalty: { enabled: true, weight: 0.5 },
  monthFrequencyPenalty: { enabled: false, weight: 0.3 },
  recentFrequencyPenalty: { enabled: false, weight: 0.2 },

  // 舰长身份
  shipTier: { enabled: false, weight: 0.2 },
  dataCompleteness: { enabled: false, weight: 0.1 },
  hasAvatar: { enabled: false, weight: 0.1 },

  // 行为
  stuckTaskPenalty: { enabled: false, weight: 0.3 },
  avgIntervalBonus: { enabled: false, weight: 0.2 },

  // 过期
  expiredPenalty: { enabled: false, weight: 0.5 },

  // 过滤器
  filterWeekScheduled: false,
  filterMonthScheduled: false,
  filterExpired: false,
};

/** 归一化的参考上限（原始值达到此值即视为满分 100） */
const NORM_CAPS = {
  /** 天数类因子：60 天封顶 */
  days: 60,
  /** 频率类因子：10 次封顶 */
  frequency: 10,
  /** 等级：总督=3 封顶 */
  shipTier: 3,
  /** 数据完整性：4 项封顶 */
  dataCompleteness: 4,
  /** 平均间隔：60 天封顶 */
  avgInterval: 60,
};

const SHIP_TIER_SCORES: Record<string, number> = {
  总督: 3,
  提督: 2,
  舰长: 1,
};

/** 单因子贡献明细 */
export type FactorBreakdown = {
  enabled: boolean;
  weight: number;
  rawValue: number;     // 原始值（天数 / 次数等）
  normalized: number;   // 归一化后的 0-100 分
  contribution: number; // 实际贡献（normalized × weight × 符号）
};

/** 推荐结果 */
export type CaptainRecommendation = {
  captainId: number;
  uid: string;
  displayName: string;
  score: number;

  excluded: boolean;
  excludeReason: string | null;

  // 元数据
  daysSinceJoin: number;
  daysSinceLastHosting: number | null;
  daysSinceFirstHosting: number | null;
  lastHostingDate: string | null;
  totalHostingCount: number;
  weekHostingCount: number;
  monthHostingCount: number;
  recentHostingCount: number;
  demandScoreRaw: number;
  shipTier: string | null;
  isNewCaptain: boolean;
  hasAvatar: boolean;
  hasStuckTaskHistory: boolean;
  avgIntervalDays: number | null;
  expireStatus: 'active' | 'expired' | 'none';

  // 各因子贡献（透明化）
  factors: Record<string, FactorBreakdown>;
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

function getShipTierScore(shipTier: string | null): number {
  if (!shipTier) return 1;
  return SHIP_TIER_SCORES[shipTier] ?? 1;
}

function getDataCompletenessScore(captain: CaptainRow): number {
  let s = 0;
  if (captain.remark_name) s++;
  if (captain.id_name) s++;
  if (captain.wechat_remark) s++;
  if (captain.game_id_remark) s++;
  return s;
}

function getCaptainExpireStatus(captain: CaptainRow): 'active' | 'expired' | 'none' {
  const expiresAt = (captain as unknown as Record<string, unknown>).expires_at;
  if (expiresAt && Number.isFinite(Number(expiresAt))) {
    return Number(expiresAt) > Date.now() ? 'active' : 'expired';
  }
  return 'none';
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

function countRecentHosting(todos: HostingTodoRow[], days: number): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  return todos.filter((t) => t.todo_date >= cutoffDate).length;
}

function calcAvgInterval(todos: HostingTodoRow[]): number | null {
  if (todos.length < 2) return null;
  const dates = todos.map((t) => t.todo_date).sort();
  let total = 0;
  for (let i = 1; i < dates.length; i++) total += daysBetween(dates[i - 1], dates[i]);
  return Math.round(total / (dates.length - 1));
}

function hasStuckHistory(todos: HostingTodoRow[]): boolean {
  return todos.some((t) => t.stuck_task === 1);
}

/** 归一化到 0-100，封顶 */
function normalize(value: number, cap: number): number {
  if (cap <= 0) return 0;
  const v = Math.max(0, value);
  return Math.min(100, (v / cap) * 100);
}

/**
 * 构造一个因子贡献
 * @param sign +1 加分，-1 减分
 */
function makeFactor(
  factor: WeightFactor,
  rawValue: number,
  normalized: number,
  sign: number,
): FactorBreakdown {
  const contribution = factor.enabled ? normalized * factor.weight * sign : 0;
  return { enabled: factor.enabled, weight: factor.weight, rawValue, normalized, contribution };
}

// ==================== 核心计算 ====================

/**
 * 计算单个舰长的综合分数
 * @param activeCount 当前活跃舰长总数（用于需求分数公式）
 */
export function calculateCaptainScore(
  captain: CaptainRow,
  todos: HostingTodoRow[],
  config: SchedulingWeightsConfig,
  activeCount: number,
): CaptainRecommendation {
  const today = todayIsoDate();
  const displayName = getCaptainDisplayName(captain);
  const expireStatus = getCaptainExpireStatus(captain);

  const captainTodos = findCaptainTodos(captain, todos);
  const totalHostingCount = captainTodos.length;
  const isNewCaptain = totalHostingCount === 0;

  // 元数据
  const daysSinceJoin = daysSinceTimestamp(captain.created_at);
  const sortedDates = captainTodos.map((t) => t.todo_date).sort();
  const lastHostingDate = sortedDates.length ? sortedDates[sortedDates.length - 1] : null;
  const firstHostingDate = sortedDates.length ? sortedDates[0] : null;
  const daysSinceLastHosting = lastHostingDate ? daysBetween(lastHostingDate, today) : null;
  const daysSinceFirstHosting = firstHostingDate ? daysBetween(firstHostingDate, today) : null;
  const weekHostingCount = countWeekHosting(captainTodos);
  const monthHostingCount = countMonthHosting(captainTodos);
  const recentHostingCount = countRecentHosting(captainTodos, 30);
  const hasAvatar = !!(captain.avatar_filename || captain.bilibili_face_url);
  const hasStuckTaskHistory = hasStuckHistory(captainTodos);
  const avgIntervalDays = calcAvgInterval(captainTodos);
  const shipTierScore = getShipTierScore(captain.ship_tier);
  const dataScore = getDataCompletenessScore(captain);

  // 需求分数原始值：(名额/人数)×加入天数 - 已托管次数
  const dailyRate = config.dailySlots / Math.max(activeCount, 1);
  const demandScoreRaw = dailyRate * daysSinceJoin - totalHostingCount;

  const factors: Record<string, FactorBreakdown> = {};

  // 需求分数：用「相对于每日名额的倍数」归一化 —— 落后一整轮(activeCount/dailySlots 天)记满分
  // 简化：把 demandScoreRaw 直接按 NORM_CAPS.frequency(10) 个名额封顶到 100
  factors.demandScore = makeFactor(
    config.demandScore,
    demandScoreRaw,
    normalize(demandScoreRaw, NORM_CAPS.frequency),
    +1,
  );

  // 时间因子（加分）
  factors.daysSinceLastHosting = makeFactor(
    config.daysSinceLastHosting,
    daysSinceLastHosting ?? NORM_CAPS.days,
    normalize(daysSinceLastHosting ?? NORM_CAPS.days, NORM_CAPS.days),
    +1,
  );
  factors.daysSinceCreated = makeFactor(
    config.daysSinceCreated,
    daysSinceJoin,
    normalize(daysSinceJoin, NORM_CAPS.days),
    +1,
  );
  factors.daysSinceFirstHosting = makeFactor(
    config.daysSinceFirstHosting,
    daysSinceFirstHosting ?? 0,
    normalize(daysSinceFirstHosting ?? 0, NORM_CAPS.days),
    +1,
  );

  // 新舰长加分（满分 100，开关控制）
  factors.newCaptainBonus = makeFactor(
    config.newCaptainBonus,
    isNewCaptain ? 1 : 0,
    isNewCaptain ? 100 : 0,
    +1,
  );

  // 频率惩罚（减分）
  factors.totalFrequencyPenalty = makeFactor(
    config.totalFrequencyPenalty,
    totalHostingCount,
    normalize(totalHostingCount, NORM_CAPS.frequency),
    -1,
  );
  factors.weekFrequencyPenalty = makeFactor(
    config.weekFrequencyPenalty,
    weekHostingCount,
    normalize(weekHostingCount, 3),
    -1,
  );
  factors.monthFrequencyPenalty = makeFactor(
    config.monthFrequencyPenalty,
    monthHostingCount,
    normalize(monthHostingCount, 8),
    -1,
  );
  factors.recentFrequencyPenalty = makeFactor(
    config.recentFrequencyPenalty,
    recentHostingCount,
    normalize(recentHostingCount, 8),
    -1,
  );

  // 身份因子（加分）
  factors.shipTier = makeFactor(
    config.shipTier,
    shipTierScore,
    normalize(shipTierScore, NORM_CAPS.shipTier),
    +1,
  );
  factors.dataCompleteness = makeFactor(
    config.dataCompleteness,
    dataScore,
    normalize(dataScore, NORM_CAPS.dataCompleteness),
    +1,
  );
  factors.hasAvatar = makeFactor(config.hasAvatar, hasAvatar ? 1 : 0, hasAvatar ? 100 : 0, +1);

  // 行为因子
  factors.stuckTaskPenalty = makeFactor(
    config.stuckTaskPenalty,
    hasStuckTaskHistory ? 1 : 0,
    hasStuckTaskHistory ? 100 : 0,
    -1,
  );
  factors.avgIntervalBonus = makeFactor(
    config.avgIntervalBonus,
    avgIntervalDays ?? 0,
    normalize(avgIntervalDays ?? 0, NORM_CAPS.avgInterval),
    +1,
  );

  // 过期惩罚
  factors.expiredPenalty = makeFactor(
    config.expiredPenalty,
    expireStatus === 'expired' ? 1 : 0,
    expireStatus === 'expired' ? 100 : 0,
    -1,
  );

  const score = Object.values(factors).reduce((sum, f) => sum + f.contribution, 0);

  // 过滤器
  let excluded = false;
  let excludeReason: string | null = null;
  if (config.filterExpired && expireStatus === 'expired') {
    excluded = true;
    excludeReason = '已过期';
  } else if (config.filterWeekScheduled && weekHostingCount > 0) {
    excluded = true;
    excludeReason = '本周已排过';
  } else if (config.filterMonthScheduled && monthHostingCount > 0) {
    excluded = true;
    excludeReason = '本月已排过';
  }

  return {
    captainId: captain.id,
    uid: captain.uid,
    displayName,
    score,
    excluded,
    excludeReason,
    daysSinceJoin,
    daysSinceLastHosting,
    daysSinceFirstHosting,
    lastHostingDate,
    totalHostingCount,
    weekHostingCount,
    monthHostingCount,
    recentHostingCount,
    demandScoreRaw,
    shipTier: captain.ship_tier,
    isNewCaptain,
    hasAvatar,
    hasStuckTaskHistory,
    avgIntervalDays,
    expireStatus,
    factors,
  };
}

// ==================== 推荐入口 ====================

export function getRecommendedCaptains(
  captains: CaptainRow[],
  todos: HostingTodoRow[],
  config: SchedulingWeightsConfig = DEFAULT_WEIGHTS_CONFIG,
): CaptainRecommendation[] {
  if (!config.enabled) return [];
  const activeCount = captains.length;
  const recs = captains.map((cap) => calculateCaptainScore(cap, todos, config, activeCount));
  // 未排除的按分数降序在前，被排除的在后
  return recs.sort((a, b) => {
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
    return b.score - a.score;
  });
}

export function getTopRecommendations(
  captains: CaptainRow[],
  todos: HostingTodoRow[],
  topN: number = 10,
  config: SchedulingWeightsConfig = DEFAULT_WEIGHTS_CONFIG,
  includeExcluded: boolean = false,
): CaptainRecommendation[] {
  const all = getRecommendedCaptains(captains, todos, config);
  const filtered = includeExcluded ? all : all.filter((r) => !r.excluded);
  return filtered.slice(0, topN);
}

// ==================== 配置校验 ====================

/** 校验并规范化配置（宽松：缺失字段回退默认值，兼容旧数据） */
export function validateWeightsConfig(config: unknown): SchedulingWeightsConfig | null {
  if (!config || typeof config !== 'object') return null;
  const c = config as Record<string, unknown>;

  const parseFactor = (key: string, def: WeightFactor): WeightFactor => {
    const v = c[key];
    if (!v || typeof v !== 'object') return def;
    const o = v as Record<string, unknown>;
    const weight = Number(o.weight);
    return {
      enabled: Boolean(o.enabled),
      weight: Number.isFinite(weight) && weight >= 0 ? weight : def.weight,
    };
  };

  try {
    const dailySlots = Number(c.dailySlots ?? DEFAULT_WEIGHTS_CONFIG.dailySlots);
    const D = DEFAULT_WEIGHTS_CONFIG;

    return {
      enabled: Boolean(c.enabled ?? true),
      dailySlots: Number.isFinite(dailySlots) && dailySlots >= 1 && dailySlots <= 10 ? dailySlots : D.dailySlots,

      demandScore: parseFactor('demandScore', D.demandScore),
      daysSinceLastHosting: parseFactor('daysSinceLastHosting', D.daysSinceLastHosting),
      daysSinceCreated: parseFactor('daysSinceCreated', D.daysSinceCreated),
      daysSinceFirstHosting: parseFactor('daysSinceFirstHosting', D.daysSinceFirstHosting),
      newCaptainBonus: parseFactor('newCaptainBonus', D.newCaptainBonus),

      totalFrequencyPenalty: parseFactor('totalFrequencyPenalty', D.totalFrequencyPenalty),
      weekFrequencyPenalty: parseFactor('weekFrequencyPenalty', D.weekFrequencyPenalty),
      monthFrequencyPenalty: parseFactor('monthFrequencyPenalty', D.monthFrequencyPenalty),
      recentFrequencyPenalty: parseFactor('recentFrequencyPenalty', D.recentFrequencyPenalty),

      shipTier: parseFactor('shipTier', D.shipTier),
      dataCompleteness: parseFactor('dataCompleteness', D.dataCompleteness),
      hasAvatar: parseFactor('hasAvatar', D.hasAvatar),

      stuckTaskPenalty: parseFactor('stuckTaskPenalty', D.stuckTaskPenalty),
      avgIntervalBonus: parseFactor('avgIntervalBonus', D.avgIntervalBonus),

      expiredPenalty: parseFactor('expiredPenalty', D.expiredPenalty),

      filterWeekScheduled: Boolean(c.filterWeekScheduled ?? D.filterWeekScheduled),
      filterMonthScheduled: Boolean(c.filterMonthScheduled ?? D.filterMonthScheduled),
      filterExpired: Boolean(c.filterExpired ?? D.filterExpired),
    };
  } catch {
    return null;
  }
}

