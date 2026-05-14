import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { setHostingLeaveDate } from '@/lib/db';

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
  const todoDate = String(o.todoDate ?? o.date ?? '').trim();
  if (!DATE_RE.test(todoDate)) {
    return NextResponse.json({ error: '日期格式须为 YYYY-MM-DD' }, { status: 400 });
  }
  const onLeave = Boolean(o.onLeave);

  try {
    await setHostingLeaveDate(todoDate, onLeave);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[hosting-leave PUT]', e);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}
