import type { CaptainApiDto } from '@/lib/captain-dto';

/**
 * 拉取舰长管理中的全部舰长（与「舰长管理」页同源）。
 * 对应 `GET /api/admin/captains` → `listCaptains()` → SQLite `captains` 表。
 */
export async function fetchAdminCaptainsList(): Promise<
  { ok: true; data: CaptainApiDto[] } | { ok: false; error: string }
> {
  const res = await fetch('/api/admin/captains', { cache: 'no-store' });
  let body: { data?: CaptainApiDto[]; error?: string };
  try {
    body = (await res.json()) as { data?: CaptainApiDto[]; error?: string };
  } catch {
    return { ok: false, error: '响应解析失败' };
  }
  if (!res.ok) return { ok: false, error: body.error || '加载失败' };
  return { ok: true, data: body.data ?? [] };
}
