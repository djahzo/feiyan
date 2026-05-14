/** B 站直播间「大航海」档位（与常见单月周期对应，可按运营规则调整天数） */
export const SHIP_TIERS = ['captain', 'governor', 'vice'] as const;
export type ShipTier = (typeof SHIP_TIERS)[number];

export const SHIP_TIER_LABEL: Record<ShipTier, string> = {
  captain: '舰长',
  governor: '提督',
  vice: '总督',
};

/** 单次开通/续费对应的有效天数（B 站大航海多为按月 31 天周期，三档默认同周期，可分别改） */
export const SHIP_TIER_DURATION_DAYS: Record<ShipTier, number> = {
  captain: 31,
  governor: 31,
  vice: 31,
};

export const NOTE_MAX_LEN = 200;

/** 微信 / 游戏 ID 等短备注上限 */
export const CONTACT_REMARK_MAX_LEN = 120;

export function isShipTier(v: string | null | undefined): v is ShipTier {
  return v === 'captain' || v === 'governor' || v === 'vice';
}

export function parseShipTier(v: unknown): ShipTier | null {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  return isShipTier(s) ? s : null;
}

/** B 站接口 `guard_level`：1 总督、2 提督、3 舰长 → 与库内 `ship_tier` 一致 */
export function bilibiliGuardLevelToShipTier(level: number): ShipTier | null {
  if (level === 1) return 'vice';
  if (level === 2) return 'governor';
  if (level === 3) return 'captain';
  return null;
}

export function computeExpiresAtMs(shippedAtMs: number | null | undefined, tier: ShipTier | null | undefined): number | null {
  if (shippedAtMs == null || !Number.isFinite(shippedAtMs) || shippedAtMs <= 0) return null;
  if (!tier || !isShipTier(tier)) return null;
  const days = SHIP_TIER_DURATION_DAYS[tier] ?? 31;
  return shippedAtMs + days * 86400000;
}

export function expiresStatus(expiresAtMs: number | null, nowMs = Date.now()): 'none' | 'active' | 'expired' {
  if (expiresAtMs == null) return 'none';
  return expiresAtMs >= nowMs ? 'active' : 'expired';
}

export function daysRemaining(expiresAtMs: number | null, nowMs = Date.now()): number | null {
  if (expiresAtMs == null) return null;
  return Math.ceil((expiresAtMs - nowMs) / 86400000);
}
