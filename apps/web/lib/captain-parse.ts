import { CONTACT_REMARK_MAX_LEN, NOTE_MAX_LEN, parseShipTier, type ShipTier } from '@/lib/captain-ship';

/** 校验备注长度，超长返回错误文案 */
export function validateNoteLength(v: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (v == null) return { ok: true, value: null };
  const s = String(v);
  if (s.length > NOTE_MAX_LEN) return { ok: false, error: `备注不能超过 ${NOTE_MAX_LEN} 字` };
  const t = s.trim();
  return { ok: true, value: t === '' ? null : t };
}

export function validateContactRemark(v: unknown, fieldLabel: string): { ok: true; value: string | null } | { ok: false; error: string } {
  if (v == null) return { ok: true, value: null };
  const s = String(v);
  if (s.length > CONTACT_REMARK_MAX_LEN) {
    return { ok: false, error: `${fieldLabel}不能超过 ${CONTACT_REMARK_MAX_LEN} 字` };
  }
  const t = s.trim();
  return { ok: true, value: t === '' ? null : t };
}

export function parseShippedAtMs(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
}

export function parseShipTierField(v: unknown): ShipTier | null {
  return parseShipTier(v);
}
