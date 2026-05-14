import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { reorderHostingTodosForDate } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PUT(req: NextRequest) {
  const session = await getAdminFromRequest(req);
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const todoDate = String(o.todoDate ?? '').trim();
  if (!DATE_RE.test(todoDate)) return NextResponse.json({ error: '日期格式须为 YYYY-MM-DD' }, { status: 400 });
  const raw = o.orderedIds;
  if (!Array.isArray(raw) || raw.some(x => typeof x !== 'number' && typeof x !== 'string')) {
    return NextResponse.json({ error: 'orderedIds 须为 id 数组' }, { status: 400 });
  }
  const orderedIds = raw.map(x => Number(x)).filter(x => Number.isFinite(x) && x > 0);
  const ok = await reorderHostingTodosForDate(todoDate, orderedIds);
  if (!ok) return NextResponse.json({ error: '排序失败：请确认条目均属于该日期' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
