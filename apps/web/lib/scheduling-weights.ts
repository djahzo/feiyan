/**
 * 托管排期权重配置与智能推荐系统
 * 支持多维度权重因子，每个因子可独立开关
 */

import type { CaptainRow, HostingTodoRow } from './db';
import { todayIsoDate, mondayIsoOfWeekContaining, isoDatesCurrentWeek } from './hosting-week-utils';

/** 单个权重因子的配置 */
export type WeightFactor = {
  /** 是否启用此因子 */
  enabled: boolean;
  /** 权重系数 */
  weight: number;
};

/** 完整的权重配置 */
export type SchedulingWeightsConfig = {
  /** 是否启用智能推荐系统 */
  enabled: boolean;

  // ==================== 时间因子 ====================
  /** 距上次托管天数（核心公平性因子） */
  daysSinceLastHosting: WeightFactor;
  /** 距入库天数（系统中存在的天数） */
  daysSinceCreated: WeightFactor;
  /** 距首次托管天数 */
  daysSinceFirstHosting: WeightFactor;

  // ==================== 新舰长加分 ====================
  /** 从未托管过的新舰长加分 */
  newCaptainBonus: WeightFactor;

  // ==================== 频率惩罚 ====================
  /** 历史总托管次数惩罚 */
  totalFrequencyPenalty: WeightFactor;
  /** 本周已安排惩罚 */
  weekFrequencyPenalty: WeightFactor;
  /** 本月已安排惩罚 */
  monthFrequencyPenalty: WeightFactor;
  /** 最近30天频率惩罚 */
  recentFrequencyPenalty: WeightFactor;

  // ==================== 舰长身份因子 ====================
  /** 舰长等级加成（总督/提督/舰长） */
  shipTier: WeightFactor;
  /** 数据完整性加成（备注、游戏ID、微信等） */
  dataCompleteness: WeightFactor;
  /** 已上传头像加成 */
  hasAvatar: WeightFactor;

  // ==================== 行为偏好因子 ====================
  /** 上次卡任务惩罚 */
  stuckTaskPenalty: WeightFactor;
  /** 平均间隔加成（间隔越长权重越高） */
  avgIntervalBonus: WeightFactor;

  // ==================== 过期处理 ====================
  /** 排除已过期舰长（不参与推荐） */
  excludeExpired: boolean;
  /** 过期舰长惩罚分（excludeExpired 关闭时生效） */
  expiredPenalty: WeightFactor;
};

/** 默认权重配置 */
export const DEFAULT_WEIGHTS_CONFIG: SchedulingWeightsConfig = {
  enabled: true,

  // 时间因子
  daysSinceLastHosting: { enabled: true, weight: 1.0 },
  daysSinceCreated: { enabled: true, weight: 0.5 },
  daysSinceFirstHosting: { enabled: false, weight: 0.1 },

  // 新舰长
  newCaptainBonus: { enabled: true, weight: 30 },

  // 频率惩罚
  totalFrequencyPenalty: { enabled: true, weight: 0.2 },
  weekFrequencyPenalty: { enabled: true, weight: 10 },
  monthFrequencyPenalty: { enabled: false, weight: 3 },
  recentFrequencyPenalty: { enabled: false, weight: 1 },

  // 舰长身份
  shipTier: { enabled: false, weight: 0.3 },
  dataCompleteness: { enabled: false, weight: 2 },
  hasAvatar: { enabled: false, weight: 1 },

  // 行为偏好
  stuckTaskPenalty: { enabled: false, weight: 5 },
  avgIntervalBonus: { enabled: false, weight: 0.1 },

  // 过期处理
  excludeExpired: false,
  expiredPenalty: { enabled: false, weight: 20 },
};

/** 舰长等级分数映射 */
const SHIP_TIER_SCORES: Record<string, number> = {
  '总督': 3,
  '提督': 2,
  '舰长': 1,
};

/** 单个因子的得分明细 */
export type FactorBreakdown = {
  enabled: boolean;
  weight: number;
  rawValue: number;       // 原始值（如天数、次数）
  contribution: number;   // 对最终分数的贡献
};

/** 舰长推荐结果 */
export type CaptainRecommendation = {
  captainId: number;
  uid: string;
  displayName: string;
  score: number;
  // 元数据
  daysSinceLastHosting: number | null;
  lastHostingDate: string | null;
  daysSinceCreated: number | null;
  daysSinceFirstHosting: number | null;
  totalHostingCount: number;
  weekHostingCount: number;
  monthHostingCount: number;
  recentHostingCount: number;
  shipTier: string | null;
  expireStatus: 'active' | 'expired' | 'none';
  isNewCaptain: boolean;
  hasAvatar: boolean;
  hasStuckTaskHistory: boolean;
  avgIntervalDays: number | null;
  // 详细的各因子贡献
  factors: Record<string, FactorBreakdown>;
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
 * 计算从时间戳到今天的天数
 */
function daysSinceTimestamp(ts: number | null | undefined): number | null {
  if (!ts || !Number.isFinite(ts)) return null;
  const now = Date.now();
  const diffMs = now - ts;
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 获取舰长的显示名称
 */
function getCaptainDisplayName(captain: CaptainRow): string {
  return captain.remark_name || captain.id_name || `UID-${captain.uid}`;
}

/**
 * 获取舰长等级分数
 */
function getShipTierScore(shipTier: string | null): number {
  if (!shipTier) return 1;
  return SHIP_TIER_SCORES[shipTier] ?? 1;
}

/**
 * 计算数据完整性分数（0-4分）
 */
function getDataCompletenessScore(captain: CaptainRow): number {
  let score = 0;
  if (captain.remark_name) score++;
  if (captain.id_name) score++;
  if (captain.wechat_remark) score++;
  if (captain.game_id_remark) score++;
  return score;
}

/**
 * 推断舰长的过期状态
 */
function getCaptainExpireStatus(captain: CaptainRow): 'active' | 'expired' | 'none' {
  const expiresAt = (captain as unknown as Record<string, unknown>).expires_at;
  if (expiresAt && Number.isFinite(Number(expiresAt))) {
    return Number(expiresAt) > Date.now() ? 'active' : 'expired';
  }
  return 'none';
}

/**
 * 统计本周托管次数
 */
function countWeekHosting(todos: HostingTodoRow[]): number {
  const today = todayIsoDate();
  const monday = mondayIsoOfWeekContaining(today);
  const weekDates = isoDatesCurrentWeek(monday);
  return todos.filter(t => weekDates.includes(t.todo_date)).length;
}

/**
 * 统计本月托管次数
 */
function countMonthHosting(todos: HostingTodoRow[]): number {
  const today = todayIsoDate();
  const currentMonth = today.slice(0, 7); // YYYY-MM
  return todos.filter(t => t.todo_date.startsWith(currentMonth)).length;
}

/**
 * 统计最近N天托管次数
 */
function countRecentHosting(todos: HostingTodoRow[], days: number): number {
  const today = todayIsoDate();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  return todos.filter(t => t.todo_date >= cutoffDate).length;
}

/**
 * 计算平均托管间隔天数
 */
function calculateAvgInterval(todos: HostingTodoRow[]): number | null {
  if (todos.length < 2) return null;
  const dates = todos.map(t => t.todo_date).sort();
  let totalDays = 0;
  for (let i = 1; i < dates.length; i++) {
    totalDays += daysBetween(dates[i - 1], dates[i]);
  }
  return Math.round(totalDays / (dates.length - 1));
}

/**
 * 检查是否有卡任务历史
 */
function hasStuckHistory(todos: HostingTodoRow[]): boolean {
  return todos.some(t => t.stuck_task === 1);
}

/**
 * 计算单个因子的贡献
 */
function calculateFactor(
  factor: WeightFactor,
  rawValue: number
): FactorBreakdown {
  return {
    enabled: factor.enabled,
    weight: factor.weight,
    rawValue,
    contribution: factor.enabled ? rawValue * factor.weight : 0,
  };
}

/**
 * 计算舰长的托管推荐权重分数
 */
export function calculateCaptainScore(
  captain: CaptainRow,
  todos: HostingTodoRow[],
  config: SchedulingWeightsConfig
): CaptainRecommendation {
  const today = todayIsoDate();
  const displayName = getCaptainDisplayName(captain);
  const expireStatus = getCaptainExpireStatus(captain);

  // 找出该舰长的所有托管记录
  const captainTodos = todos.filter(
    (t) =>
      t.role_name === displayName ||
      t.role_name === captain.remark_name ||
      t.role_name === captain.id_name
  );

  const totalHostingCount = captainTodos.length;
  const isNewCaptain = totalHostingCount === 0;

  // 基础统计
  const daysSinceCreated = daysSinceTimestamp(captain.created_at);
  const weekHostingCount = countWeekHosting(captainTodos);
  const monthHostingCount = countMonthHosting(captainTodos);
  const recentHostingCount = countRecentHosting(captainTodos, 30);
  const hasAvatar = !!(captain.avatar_filename || captain.bilibili_face_url);
  const hasStuckTaskHistory = hasStuckHistory(captainTodos);
  const avgIntervalDays = calculateAvgInterval(captainTodos);

  const factors: Record<string, FactorBreakdown> = {};

  // ============== 新舰长（从未托管过） ==============
  if (isNewCaptain) {
    factors.daysSinceCreated = calculateFactor(config.daysSinceCreated, daysSinceCreated ?? 0);
    factors.newCaptainBonus = calculateFactor(config.newCaptainBonus, 1);
    factors.shipTier = calculateFactor(config.shipTier, getShipTierScore(captain.ship_tier));
    factors.dataCompleteness = calculateFactor(config.dataCompleteness, getDataCompletenessScore(captain));
    factors.hasAvatar = calculateFactor(config.hasAvatar, hasAvatar ? 1 : 0);
    factors.expiredPenalty = calculateFactor(
      config.expiredPenalty,
      expireStatus === 'expired' ? -1 : 0
    );

    const finalScore = Object.values(factors).reduce((sum, f) => sum + f.contribution, 0);

    return {
      captainId: captain.id,
      uid: captain.uid,
      displayName,
      score: finalScore,
      daysSinceLastHosting: null,
      lastHostingDate: null,
      daysSinceCreated,
      daysSinceFirstHosting: null,
      totalHostingCount: 0,
      weekHostingCount: 0,
      monthHostingCount: 0,
      recentHostingCount: 0,
      shipTier: captain.ship_tier,
      expireStatus,
      isNewCaptain: true,
      hasAvatar,
      hasStuckTaskHistory: false,
      avgIntervalDays: null,
      factors,
    };
  }

  // ============== 已有托管历史的舰长 ==============
  const sortedDates = captainTodos.map(t => t.todo_date).sort();
  const lastHostingDate = sortedDates[sortedDates.length - 1];
  const firstHostingDate = sortedDates[0];
  const daysSinceLastHosting = daysBetween(lastHostingDate, today);
  const daysSinceFirstHosting = daysBetween(firstHostingDate, today);

  // 计算各个因子
  factors.daysSinceLastHosting = calculateFactor(config.daysSinceLastHosting, daysSinceLastHosting);
  factors.daysSinceCreated = calculateFactor(config.daysSinceCreated, daysSinceCreated ?? 0);
  factors.daysSinceFirstHosting = calculateFactor(config.daysSinceFirstHosting, daysSinceFirstHosting);

  factors.totalFrequencyPenalty = calculateFactor(config.totalFrequencyPenalty, -totalHostingCount);
  factors.weekFrequencyPenalty = calculateFactor(config.weekFrequencyPenalty, -weekHostingCount);
  factors.monthFrequencyPenalty = calculateFactor(config.monthFrequencyPenalty, -monthHostingCount);
  factors.recentFrequencyPenalty = calculateFactor(config.recentFrequencyPenalty, -recentHostingCount);

  factors.shipTier = calculateFactor(config.shipTier, getShipTierScore(captain.ship_tier));
  factors.dataCompleteness = calculateFactor(config.dataCompleteness, getDataCompletenessScore(captain));
  factors.hasAvatar = calculateFactor(config.hasAvatar, hasAvatar ? 1 : 0);

  factors.stuckTaskPenalty = calculateFactor(config.stuckTaskPenalty, hasStuckTaskHistory ? -1 : 0);
  factors.avgIntervalBonus = calculateFactor(config.avgIntervalBonus, avgIntervalDays ?? 0);

  factors.expiredPenalty = calculateFactor(
    config.expiredPenalty,
    expireStatus === 'expired' ? -1 : 0
  );

  const finalScore = Object.values(factors).reduce((sum, f) => sum + f.contribution, 0);

  return {
    captainId: captain.id,
    uid: captain.uid,
    displayName,
    score: finalScore,
    daysSinceLastHosting,
    lastHostingDate,
    daysSinceCreated,
    daysSinceFirstHosting,
    totalHostingCount,
    weekHostingCount,
    monthHostingCount,
    recentHostingCount,
    shipTier: captain.ship_tier,
    expireStatus,
    isNewCaptain: false,
    hasAvatar,
    hasStuckTaskHistory,
    avgIntervalDays,
    factors,
  };
}

/**
 * 获取所有舰长的推荐排序列表
 */
export function getRecommendedCaptains(
  captains: CaptainRow[],
  todos: HostingTodoRow[],
  config: SchedulingWeightsConfig = DEFAULT_WEIGHTS_CONFIG
): CaptainRecommendation[] {
  if (!config.enabled) {
    return [];
  }

  let recommendations = captains.map((captain) =>
    calculateCaptainScore(captain, todos, config)
  );

  // 排除已过期舰长（如果配置）
  if (config.excludeExpired) {
    recommendations = recommendations.filter((r) => r.expireStatus !== 'expired');
  }

  // 按分数降序排序
  return recommendations.sort((a, b) => b.score - a.score);
}

/**
 * 获取推荐的前 N 名舰长
 */
export function getTopRecommendations(
  captains: CaptainRow[],
  todos: HostingTodoRow[],
  topN: number = 10,
  config: SchedulingWeightsConfig = DEFAULT_WEIGHTS_CONFIG
): CaptainRecommendation[] {
  const all = getRecommendedCaptains(captains, todos, config);
  return all.slice(0, topN);
}

/**
 * 验证权重配置的有效性
 */
export function validateWeightsConfig(config: unknown): SchedulingWeightsConfig | null {
  if (!config || typeof config !== 'object') return null;

  const c = config as Record<string, unknown>;

  const parseFactor = (key: string, defaultVal: WeightFactor): WeightFactor => {
    const val = c[key];
    if (!val || typeof val !== 'object') return defaultVal;
    const obj = val as Record<string, unknown>;
    return {
      enabled: Boolean(obj.enabled),
      weight: Number.isFinite(obj.weight) ? Number(obj.weight) : defaultVal.weight,
    };
  };

  try {
    return {
      enabled: Boolean(c.enabled ?? true),

      daysSinceLastHosting: parseFactor('daysSinceLastHosting', DEFAULT_WEIGHTS_CONFIG.daysSinceLastHosting),
      daysSinceCreated: parseFactor('daysSinceCreated', DEFAULT_WEIGHTS_CONFIG.daysSinceCreated),
      daysSinceFirstHosting: parseFactor('daysSinceFirstHosting', DEFAULT_WEIGHTS_CONFIG.daysSinceFirstHosting),

      newCaptainBonus: parseFactor('newCaptainBonus', DEFAULT_WEIGHTS_CONFIG.newCaptainBonus),

      totalFrequencyPenalty: parseFactor('totalFrequencyPenalty', DEFAULT_WEIGHTS_CONFIG.totalFrequencyPenalty),
      weekFrequencyPenalty: parseFactor('weekFrequencyPenalty', DEFAULT_WEIGHTS_CONFIG.weekFrequencyPenalty),
      monthFrequencyPenalty: parseFactor('monthFrequencyPenalty', DEFAULT_WEIGHTS_CONFIG.monthFrequencyPenalty),
      recentFrequencyPenalty: parseFactor('recentFrequencyPenalty', DEFAULT_WEIGHTS_CONFIG.recentFrequencyPenalty),

      shipTier: parseFactor('shipTier', DEFAULT_WEIGHTS_CONFIG.shipTier),
      dataCompleteness: parseFactor('dataCompleteness', DEFAULT_WEIGHTS_CONFIG.dataCompleteness),
      hasAvatar: parseFactor('hasAvatar', DEFAULT_WEIGHTS_CONFIG.hasAvatar),

      stuckTaskPenalty: parseFactor('stuckTaskPenalty', DEFAULT_WEIGHTS_CONFIG.stuckTaskPenalty),
      avgIntervalBonus: parseFactor('avgIntervalBonus', DEFAULT_WEIGHTS_CONFIG.avgIntervalBonus),

      excludeExpired: Boolean(c.excludeExpired),
      expiredPenalty: parseFactor('expiredPenalty', DEFAULT_WEIGHTS_CONFIG.expiredPenalty),
    };
  } catch {
    return null;
  }
}
