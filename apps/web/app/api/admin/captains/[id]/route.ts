import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { captainRowToDto } from '@/lib/captain-dto';
import { parseShippedAtMs, parseShipTierField, validateContactRemark, validateNoteLength } from '@/lib/captain-parse';
import { deleteCaptainAvatarFile } from '@/lib/captain-uploads';
import { deleteCaptainRow, getCaptainById, updateCaptain } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getAdminFromRequest(req);
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '无效 id' }, { status: 400 });
  const row = await getCaptainById(id);
  if (!row) return NextResponse.json({ error: '不存在' }, { status: 404 });
  return NextResponse.json({ data: captainRowToDto(row) });
}

export async function PUT(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getAdminFromRequest(req);
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '无效 id' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const patch: Parameters<typeof updateCaptain>[1] = {};
  if (o.clearAvatar === true) {
    const cur = await getCaptainById(id);
    if (!cur) return NextResponse.json({ error: '不存在' }, { status: 404 });
    deleteCaptainAvatarFile(cur.avatar_filename);
    patch.avatar_filename = null;
  }
  if ('uid' in o) {
    const uid = String(o.uid ?? '').trim();
    if (!uid) return NextResponse.json({ error: 'uid 不能为空' }, { status: 400 });
    patch.uid = uid;
  }
  if ('idName' in o) {
    const v = o.idName;
    patch.id_name = v == null || String(v).trim() === '' ? null : String(v).trim();
  }
  if ('remarkName' in o) {
    const v = o.remarkName;
    patch.remark_name = v == null || String(v).trim() === '' ? null : String(v).trim();
  }
  if ('note' in o) {
    const noteRes = validateNoteLength(o.note);
    if (!noteRes.ok) return NextResponse.json({ error: noteRes.error }, { status: 400 });
    patch.note = noteRes.value;
  }
  if ('wechatRemark' in o) {
    const wxRes = validateContactRemark(o.wechatRemark, '微信备注');
    if (!wxRes.ok) return NextResponse.json({ error: wxRes.error }, { status: 400 });
    patch.wechat_remark = wxRes.value;
  }
  if ('gameIdRemark' in o) {
    const gidRes = validateContactRemark(o.gameIdRemark, '游戏 ID 备注');
    if (!gidRes.ok) return NextResponse.json({ error: gidRes.error }, { status: 400 });
    patch.game_id_remark = gidRes.value;
  }
  if ('shipTier' in o) {
    const raw = o.shipTier;
    if (raw == null || raw === '') {
      patch.ship_tier = null;
      if (!('shippedAt' in o)) patch.shipped_at = null;
    } else {
      const t = parseShipTierField(raw);
      if (t == null) return NextResponse.json({ error: '无效的上舰类型' }, { status: 400 });
      patch.ship_tier = t;
    }
  }
  if ('shippedAt' in o) {
    patch.shipped_at = parseShippedAtMs(o.shippedAt);
  }

  const mergedForCheck = await getCaptainById(id);
  if (!mergedForCheck) return NextResponse.json({ error: '不存在' }, { status: 404 });
  const nextShipped =
    patch.shipped_at !== undefined ? patch.shipped_at : mergedForCheck.shipped_at != null && Number.isFinite(mergedForCheck.shipped_at)
      ? mergedForCheck.shipped_at
      : null;
  const nextTierRaw = patch.ship_tier !== undefined ? patch.ship_tier : mergedForCheck.ship_tier;
  const nextTier = parseShipTierField(nextTierRaw);
  if (nextShipped != null && nextTier == null) {
    return NextResponse.json({ error: '存在上舰时间时必须选择上舰类型' }, { status: 400 });
  }

  try {
    const ok = await updateCaptain(id, patch);
    if (!ok) return NextResponse.json({ error: '不存在' }, { status: 404 });
    const row = await getCaptainById(id);
    return NextResponse.json({ ok: true, data: row ? captainRowToDto(row) : null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/UNIQUE|unique/i.test(msg)) {
      return NextResponse.json({ error: '该 uid 已被占用' }, { status: 409 });
    }
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getAdminFromRequest(req);
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '无效 id' }, { status: 400 });

  const removed = await deleteCaptainRow(id);
  if (!removed) return NextResponse.json({ error: '不存在' }, { status: 404 });
  deleteCaptainAvatarFile(removed.avatar_filename);
  return NextResponse.json({ ok: true });
}
