import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { createCooperationCase, listCooperationCases } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TITLE_MAX = 200;
const BRAND_MAX = 120;
const SUMMARY_MAX = 2000;
const URL_MAX = 500;

function mapRow(r: Awaited<ReturnType<typeof listCooperationCases>>[number]) {
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

function parseBody(o: Record<string, unknown>): { error: string } | { data: Parameters<typeof createCooperationCase>[0] } {
  const title = String(o.title ?? '').trim();
  if (!title) return { error: '标题不能为空' };
  if (title.length > TITLE_MAX) return { error: `标题不能超过 ${TITLE_MAX} 字` };

  const brandRaw = o.brandName;
  const brand_name =
    brandRaw == null || String(brandRaw).trim() === '' ? null : String(brandRaw).trim().slice(0, BRAND_MAX);

  const sumRaw = o.summary;
  const summary =
    sumRaw == null || String(sumRaw).trim() === '' ? null : String(sumRaw).trim().slice(0, SUMMARY_MAX);

  const urlRaw = o.detailUrl;
  let detail_url: string | null = null;
  if (urlRaw != null && String(urlRaw).trim() !== '') {
    const u = String(urlRaw).trim().slice(0, URL_MAX);
    if (!/^https?:\/\//i.test(u)) return { error: '详情链接需以 http:// 或 https:// 开头' };
    detail_url = u;
  }

  let sort_order: number | undefined;
  if ('sortOrder' in o && o.sortOrder != null && o.sortOrder !== '') {
    const n = Number(o.sortOrder);
    if (!Number.isFinite(n)) return { error: '排序号必须是数字' };
    sort_order = Math.trunc(n);
  }

  return { data: { title, brand_name, summary, detail_url, sort_order } };
}

export async function GET(_req: NextRequest) {
  const session = await getAdminFromRequest(_req);
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const rows = await listCooperationCases();
  return NextResponse.json({ data: rows.map(mapRow) });
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
  const parsed = parseBody(body as Record<string, unknown>);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const id = await createCooperationCase(parsed.data);
    return NextResponse.json({ ok: true, data: { id } });
  } catch {
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
