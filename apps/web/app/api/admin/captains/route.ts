import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { captainRowToDto } from '@/lib/captain-dto';
import { parseShippedAtMs, parseShipTierField, validateContactRemark, validateNoteLength } from '@/lib/captain-parse';
import { createCaptain, listCaptains } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getAdminFromRequest(req);
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  // 舰长管理、任务板「舰长池」等共用此列表（SQLite captains）
  const rows = await listCaptains();
  return NextResponse.json({ data: rows.map(captainRowToDto) });
}

export async function POST(req: NextRequest) {
  const session = await getAdminFromRequest(req);
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const uid = String(o.uid ?? '').trim();
  if (!uid) return NextResponse.json({ error: 'uid 不能为空' }, { status: 400 });

  const idNameRaw = o.idName;
  const remarkRaw = o.remarkName;
  const id_name = idNameRaw == null || String(idNameRaw).trim() === '' ? null : String(idNameRaw).trim();
  const remark_name = remarkRaw == null || String(remarkRaw).trim() === '' ? null : String(remarkRaw).trim();

  const noteRes = validateNoteLength(o.note);
  if (!noteRes.ok) return NextResponse.json({ error: noteRes.error }, { status: 400 });
  const note = noteRes.value;

  const wxRes = validateContactRemark(o.wechatRemark, '微信备注');
  if (!wxRes.ok) return NextResponse.json({ error: wxRes.error }, { status: 400 });
  const gidRes = validateContactRemark(o.gameIdRemark, '游戏 ID 备注');
  if (!gidRes.ok) return NextResponse.json({ error: gidRes.error }, { status: 400 });

  const shipTier = parseShipTierField(o.shipTier);
  const shipped_at = parseShippedAtMs(o.shippedAt);
  if (shipped_at != null && shipTier == null) {
    return NextResponse.json({ error: '填写了上舰时间时必须选择上舰类型（舰长 / 提督 / 总督）' }, { status: 400 });
  }

  try {
    const id = await createCaptain({
      uid,
      id_name,
      remark_name,
      note,
      wechat_remark: wxRes.value,
      game_id_remark: gidRes.value,
      ship_tier: shipTier,
      shipped_at,
    });
    return NextResponse.json({ ok: true, data: { id } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/UNIQUE|unique/i.test(msg)) {
      return NextResponse.json({ error: '该 uid 已存在' }, { status: 409 });
    }
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
