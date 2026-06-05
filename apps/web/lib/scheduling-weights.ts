/**
 * 托管排期权重配置与智能推荐系统
 */

import type { CaptainRow, HostingTodoRow } from './db';
import { todayIsoDate } from './hosting-week-utils';

/** 权重配置 */
export type SchedulingWeightsConfig = {
  /** 距上次托管天数的权重系数 */
  daysSinceLastWeight: number;
  /** 舰长等级加成的权重系数 */
  shipTierWeight: number;
  /** 历史频率惩罚的权重系数 */
  frequencyPenaltyWeight: number;
  /** 新舰长默认权重分数 */
  newCaptainScore: number;
  /** 是否启用智能推荐 */
  enabled: boolean;
};

/** 默认权重配置 */
export const DEFAULT_WEIGHTS_CONFIG: SchedulingWeightsConfig = {
  daysSinceLastWeight: 1.0,
  shipTierWeight: 0.3,
  frequencyPenaltyWeight: 0.2,
  newCaptainScore: 99999,
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
  totalHostingCount: number;
  shipTier: string | null;
  shipTierScore: number;
  isNewCaptain: boolean;
  scoreBreakdown: {
    timeScore: number;
    tierScore: number;
    frequencyPenalty: number;
    finalScore: number;
  };
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
 * 计算舰长的托管推荐权重分数
 */
export function calculateCaptainScore(
  captain: CaptainRow,
  todos: HostingTodoRow[],
  config: SchedulingWeightsConfig
): CaptainRecommendation {
  const today = todayIsoDate();
  const displayName = getCaptainDisplayName(captain);

  // 找出该舰长的所有托管记录
  const captainTodos = todos.filter(
    (t) =>
      t.role_name === displayName ||
      t.role_name === captain.remark_name ||
      t.role_name === captain.id_name
  );

  const totalHostingCount = captainTodos.length;
  const isNewCaptain = totalHostingCount === 0;

  // 新舰长直接返回配置的高分
  if (isNewCaptain) {
    return {
      captainId: captain.id,
      uid: captain.uid,
      displayName,
      score: config.newCaptainScore,
      daysSinceLastHosting: null,
      lastHostingDate: null,
      totalHostingCount: 0,
      shipTier: captain.ship_tier,
      shipTierScore: getShipTierScore(captain.ship_tier),
      isNewCaptain: true,
      scoreBreakdown: {
        timeScore: 0,
        tierScore: 0,
        frequencyPenalty: 0,
        finalScore: config.newCaptainScore,
      },
    };
  }

  // 找到最近一次托管日期
  const sortedDates = captainTodos
    .map((t) => t.todo_date)
    .sort()
    .reverse();
  const lastHostingDate = sortedDates[0];
  const daysSinceLastHosting = daysBetween(lastHostingDate, today);

  // 计算各项分数
  const timeScore = daysSinceLastHosting * config.daysSinceLastWeight;
  const shipTierScore = getShipTierScore(captain.ship_tier);
  const tierScore = shipTierScore * config.shipTierWeight;
  const frequencyPenalty = totalHostingCount * config.frequencyPenaltyWeight;

  const finalScore = timeScore + tierScore - frequencyPenalty;

  return {
    captainId: captain.id,
    uid: captain.uid,
    displayName,
    score: finalScore,
    daysSinceLastHosting,
    lastHostingDate,
    totalHostingCount,
    shipTier: captain.ship_tier,
    shipTierScore,
    isNewCaptain: false,
    scoreBreakdown: {
      timeScore,
      tierScore,
      frequencyPenalty,
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

  const recommendations = captains.map((captain) =>
    calculateCaptainScore(captain, todos, config)
  );

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

  const daysSinceLastWeight = Number(c.daysSinceLastWeight);
  const shipTierWeight = Number(c.shipTierWeight);
  const frequencyPenaltyWeight = Number(c.frequencyPenaltyWeight);
  const newCaptainScore = Number(c.newCaptainScore);
  const enabled = Boolean(c.enabled);

  if (
    !Number.isFinite(daysSinceLastWeight) ||
    !Number.isFinite(shipTierWeight) ||
    !Number.isFinite(frequencyPenaltyWeight) ||
    !Number.isFinite(newCaptainScore)
  ) {
    return null;
  }

  return {
    daysSinceLastWeight,
    shipTierWeight,
    frequencyPenaltyWeight,
    newCaptainScore,
    enabled,
  };
}
