import type { CaptainRow } from '@/lib/db';
import {
  computeExpiresAtMs,
  daysRemaining,
  expiresStatus,
  isShipTier,
  SHIP_TIER_LABEL,
} from '@/lib/captain-ship';

function avatarUrlFromCaptainRow(r: CaptainRow): string | null {
  if (r.avatar_filename) return `/api/admin/captain-avatar/${r.id}`;
  const raw = (r.bilibili_face_url ?? '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  return null;
}

export type CaptainApiDto = {
  id: number;
  uid: string;
  idName: string | null;
  remarkName: string | null;
  note: string | null;
  wechatRemark: string | null;
  gameIdRemark: string | null;
  shipTier: string | null;
  shipTierLabel: string | null;
  shippedAt: number | null;
  expiresAt: number | null;
  expireStatus: 'none' | 'active' | 'expired';
  daysRemaining: number | null;
  avatarUrl: string | null;
  createdAt: number;
  updatedAt: number;
};

export function captainRowToDto(r: CaptainRow): CaptainApiDto {
  const tier = isShipTier(r.ship_tier) ? r.ship_tier : null;
  const shippedAt = r.shipped_at != null && Number.isFinite(r.shipped_at) ? r.shipped_at : null;
  const expiresAt = computeExpiresAtMs(shippedAt, tier);
  const expireStatus = expiresStatus(expiresAt);
  const daysRem = daysRemaining(expiresAt);
  return {
    id: r.id,
    uid: r.uid,
    idName: r.id_name,
    remarkName: r.remark_name,
    note: r.note,
    wechatRemark: r.wechat_remark,
    gameIdRemark: r.game_id_remark,
    shipTier: tier,
    shipTierLabel: tier ? SHIP_TIER_LABEL[tier] : null,
    shippedAt,
    expiresAt,
    expireStatus: expireStatus,
    daysRemaining: daysRem,
    avatarUrl: avatarUrlFromCaptainRow(r),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * 主站公开页（如行动预案）：外链头像直出；本地上传走 `/api/site/captain-avatar/:id`（与后台同源文件、无需登录）。
 */
export function captainAvatarUrlForPublicSite(dto: CaptainApiDto): string | null {
  const u = dto.avatarUrl;
  if (!u) return null;
  const t = u.trim();
  if (/^https?:\/\//i.test(t) || t.startsWith('//')) return t.startsWith('//') ? `https:${t}` : t;
  return `/api/site/captain-avatar/${dto.id}`;
}
