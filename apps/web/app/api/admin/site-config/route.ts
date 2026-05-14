import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { getSiteSettingsJson, saveSiteSettingsJson } from '@/lib/db';
import { mergeSiteConfig } from '@/lib/site-config-merge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getAdminFromRequest(req);
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const raw = await getSiteSettingsJson();
  let parsed: unknown = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }
  return NextResponse.json({ data: mergeSiteConfig(parsed) });
}

export async function PUT(req: NextRequest) {
  const session = await getAdminFromRequest(req);
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const merged = mergeSiteConfig(body);
  await saveSiteSettingsJson(JSON.stringify(merged));
  return NextResponse.json({ ok: true, data: merged });
}
