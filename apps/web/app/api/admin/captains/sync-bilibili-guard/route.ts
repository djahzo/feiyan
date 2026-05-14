import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { syncCaptainsFromBilibiliGuardTab } from '@/lib/captain-guard-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  const session = await getAdminFromRequest(_req);
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  try {
    const data = await syncCaptainsFromBilibiliGuardTab();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '同步失败';
    const isCfg = /未配置|BILIBILI_UID|room_id/.test(msg);
    return NextResponse.json({ error: msg }, { status: isCfg ? 400 : 502 });
  }
}
