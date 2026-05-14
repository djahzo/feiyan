import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { deleteCooperationCase, getCooperationCaseById, updateCooperationCase } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TITLE_MAX = 200;
const BRAND_MAX = 120;
const SUMMARY_MAX = 2000;
const URL_MAX = 500;

function mapRow(r: NonNullable<Awaited<ReturnType<typeof getCooperationCaseById>>>) {
  return {
    id: r.id,
    title: r.title,
    brandName: r.brand_name,
    summary: r.summary,
    detailUrl: r.detail_url,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getAdminFromRequest(_req);
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '无效 id' }, { status: 400 });
  const row = await getCooperationCaseById(id);
  if (!row) return NextResponse.json({ error: '不存在' }, { status: 404 });
  return NextResponse.json({ data: mapRow(row) });
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
  const patch: Parameters<typeof updateCooperationCase>[1] = {};

  if ('title' in o) {
    const title = String(o.title ?? '').trim();
    if (!title) return NextResponse.json({ error: '标题不能为空' }, { status: 400 });
    if (title.length > TITLE_MAX) return NextResponse.json({ error: `标题不能超过 ${TITLE_MAX} 字` }, { status: 400 });
    patch.title = title;
  }
  if ('brandName' in o) {
    const v = o.brandName;
    patch.brand_name = v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, BRAND_MAX);
  }
  if ('summary' in o) {
    const v = o.summary;
    patch.summary = v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, SUMMARY_MAX);
  }
  if ('detailUrl' in o) {
    const v = o.detailUrl;
    if (v == null || String(v).trim() === '') {
      patch.detail_url = null;
    } else {
      const u = String(v).trim().slice(0, URL_MAX);
      if (!/^https?:\/\//i.test(u)) {
        return NextResponse.json({ error: '详情链接需以 http:// 或 https:// 开头' }, { status: 400 });
      }
      patch.detail_url = u;
    }
  }
  if ('sortOrder' in o) {
    const n = Number(o.sortOrder);
    if (!Number.isFinite(n)) return NextResponse.json({ error: '排序号必须是数字' }, { status: 400 });
    patch.sort_order = Math.trunc(n);
  }

  const ok = await updateCooperationCase(id, patch);
  if (!ok) return NextResponse.json({ error: '不存在' }, { status: 404 });
  const row = await getCooperationCaseById(id);
  return NextResponse.json({ ok: true, data: row ? mapRow(row) : null });
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getAdminFromRequest(_req);
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '无效 id' }, { status: 400 });
  const removed = await deleteCooperationCase(id);
  if (!removed) return NextResponse.json({ error: '不存在' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
