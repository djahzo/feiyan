/**
 * 托管排期权重配置与智能推荐系统
 */

import type { CaptainRow, HostingTodoRow } from './db';
import { todayIsoDate } from './hosting-week-utils';

/** 权重配置 */
export type SchedulingWeightsConfig = {
  /** 距上次托管天数的权重系数（核心因子） */
  daysSinceLastWeight: number;
  /** 入库天数权重（新舰长用，距 created_at 的天数） */
  daysSinceCreatedWeight: number;
  /** 新舰长额外加分（保证新人优先排上，但不会压倒所有人） */
  newCaptainBonus: number;
  /** 历史频率惩罚的权重系数 */
  frequencyPenaltyWeight: number;
  /** 舰长等级加成的权重系数（可置 0 关闭） */
  shipTierWeight: number;
  /** 是否排除已过期的舰长（不再续费的） */
  excludeExpired: boolean;
  /** 过期舰长惩罚分（excludeExpired 为 false 时生效） */
  expiredPenaltyWeight: number;
  /** 是否启用智能推荐 */
  enabled: boolean;
};

/** 默认权重配置 */
export const DEFAULT_WEIGHTS_CONFIG: SchedulingWeightsConfig = {
  daysSinceLastWeight: 1.0,
  daysSinceCreatedWeight: 0.5,
  newCaptainBonus: 30,
  frequencyPenaltyWeight: 0.2,
  shipTierWeight: 0,
  excludeExpired: false,
  expiredPenaltyWeight: 20,
  enabled: true,
};

/** 舰长等级分数映射 */
const SHIP_TIER_SCORES: Record<string, number> = {
  '总督': 3,
  '提督': 2,
  '舰长': 1,
};

/** 舰长推荐结果 */
export type CaptainRecommendation = {
  captainId: number;
  uid: string;
  displayName: string;
  score: number;
  daysSinceLastHosting: number | null;
  lastHostingDate: string | null;
  daysSinceCreated: number | null;
  totalHostingCount: number;
  shipTier: string | null;
  shipTierScore: number;
  expireStatus: 'active' | 'expired' | 'none';
  isNewCaptain: boolean;
  scoreBreakdown: {
    timeScore: number;          // 距上次托管/入库天数的时间分
    tierScore: number;          // 等级加成
    frequencyPenalty: number;   // 频率惩罚
    expiredPenalty: number;     // 过期惩罚
    newCaptainBonus: number;    // 新舰长额外加分
    finalScore: number;
  };
};

/**
 * 计算两个日期之间的天数差（date2 - date1）
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
 * 推断舰长的过期状态
 * - 由于 expires_at 不一定可靠，这里基于 expireStatus 字段（如果有）
 */
function getCaptainExpireStatus(captain: CaptainRow): 'active' | 'expired' | 'none' {
  // 如果有 expires_at 字段，可以基于它判断
  const expiresAt = (captain as unknown as Record<string, unknown>).expires_at;
  if (expiresAt && Number.isFinite(Number(expiresAt))) {
    return Number(expiresAt) > Date.now() ? 'active' : 'expired';
  }
  // 如果没有，认为是 none（未知）
  return 'none';
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

  // 计算距入库天数（用于新舰长）
  const daysSinceCreated = daysSinceTimestamp(captain.created_at);

  // 等级分数
  const shipTierScoreVal = getShipTierScore(captain.ship_tier);
  const tierScore = shipTierScoreVal * config.shipTierWeight;

  // 过期惩罚
  let expiredPenalty = 0;
  if (expireStatus === 'expired') {
    expiredPenalty = config.expiredPenaltyWeight;
  }

  // ============== 新舰长（从未托管过） ==============
  if (isNewCaptain) {
    // 新舰长分数 = 入库天数 × 入库权重 + 新舰长加分 + 等级分 - 过期惩罚
    const timeScore = (daysSinceCreated ?? 0) * config.daysSinceCreatedWeight;
    const finalScore = timeScore + config.newCaptainBonus + tierScore - expiredPenalty;

    return {
      captainId: captain.id,
      uid: captain.uid,
      displayName,
      score: finalScore,
      daysSinceLastHosting: null,
      lastHostingDate: null,
      daysSinceCreated,
      totalHostingCount: 0,
      shipTier: captain.ship_tier,
      shipTierScore: shipTierScoreVal,
      expireStatus,
      isNewCaptain: true,
      scoreBreakdown: {
        timeScore,
        tierScore,
        frequencyPenalty: 0,
        expiredPenalty,
        newCaptainBonus: config.newCaptainBonus,
        finalScore,
      },
    };
  }

  // ============== 已有托管历史的舰长 ==============
  const sortedDates = captainTodos
    .map((t) => t.todo_date)
    .sort()
    .reverse();
  const lastHostingDate = sortedDates[0];
  const daysSinceLastHosting = daysBetween(lastHostingDate, today);

  // 计算各项分数
  const timeScore = daysSinceLastHosting * config.daysSinceLastWeight;
  const frequencyPenalty = totalHostingCount * config.frequencyPenaltyWeight;

  const finalScore = timeScore + tierScore - frequencyPenalty - expiredPenalty;

  return {
    captainId: captain.id,
    uid: captain.uid,
    displayName,
    score: finalScore,
    daysSinceLastHosting,
    lastHostingDate,
    daysSinceCreated,
    totalHostingCount,
    shipTier: captain.ship_tier,
    shipTierScore: shipTierScoreVal,
    expireStatus,
    isNewCaptain: false,
    scoreBreakdown: {
      timeScore,
      tierScore,
      frequencyPenalty,
      expiredPenalty,
      newCaptainBonus: 0,
      finalScore,
    },
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

  const daysSinceLastWeight = Number(c.daysSinceLastWeight ?? DEFAULT_WEIGHTS_CONFIG.daysSinceLastWeight);
  const daysSinceCreatedWeight = Number(c.daysSinceCreatedWeight ?? DEFAULT_WEIGHTS_CONFIG.daysSinceCreatedWeight);
  const newCaptainBonus = Number(c.newCaptainBonus ?? DEFAULT_WEIGHTS_CONFIG.newCaptainBonus);
  const frequencyPenaltyWeight = Number(c.frequencyPenaltyWeight ?? DEFAULT_WEIGHTS_CONFIG.frequencyPenaltyWeight);
  const shipTierWeight = Number(c.shipTierWeight ?? DEFAULT_WEIGHTS_CONFIG.shipTierWeight);
  const expiredPenaltyWeight = Number(c.expiredPenaltyWeight ?? DEFAULT_WEIGHTS_CONFIG.expiredPenaltyWeight);
  const excludeExpired = Boolean(c.excludeExpired);
  const enabled = Boolean(c.enabled);

  if (
    !Number.isFinite(daysSinceLastWeight) ||
    !Number.isFinite(daysSinceCreatedWeight) ||
    !Number.isFinite(newCaptainBonus) ||
    !Number.isFinite(frequencyPenaltyWeight) ||
    !Number.isFinite(shipTierWeight) ||
    !Number.isFinite(expiredPenaltyWeight)
  ) {
    return null;
  }

  return {
    daysSinceLastWeight,
    daysSinceCreatedWeight,
    newCaptainBonus,
    frequencyPenaltyWeight,
    shipTierWeight,
    excludeExpired,
    expiredPenaltyWeight,
    enabled,
  };
}
