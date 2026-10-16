import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { fetchGuardTabTotalMembers } from '@/lib/bilibili-guard';
import { getLiveStatus } from '@/lib/bilibili';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 获取当前B站大航海榜单的UID列表（不写入数据库）
 * 用于前端判断哪些舰长已过期
 */
export async function GET(_req: NextRequest) {
  const session = await getAdminFromRequest(_req);
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  try {
    const uid = (process.env.BILIBILI_UID || '').trim();
    if (!uid) {
      return NextResponse.json({ error: '未配置 BILIBILI_UID' }, { status: 400 });
    }

    const status = await getLiveStatus(uid);
    const roomId = status.room_id;
    if (!roomId) {
      return NextResponse.json({ error: '未找到直播间' }, { status: 400 });
    }

    const members = await fetchGuardTabTotalMembers(roomId, uid);
    const guardUids = members.map(m => m.uid);
    const guardNames = members.map(m => m.name);

    return NextResponse.json({
      ok: true,
      data: {
        guardUids,
        guardNames,
        count: guardUids.length
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '获取失败';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
