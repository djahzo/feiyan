import { NextResponse } from 'next/server';
import { getSiteSettingsJson } from '@/lib/db';
import { mergeSiteConfig } from '@/lib/site-config-merge';
import { DEFAULT_SITE_CONFIG } from '@/lib/site-defaults';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const raw = await getSiteSettingsJson();
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    const data = mergeSiteConfig(parsed);
    return NextResponse.json({ data });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { data: DEFAULT_SITE_CONFIG, error: '使用默认配置（数据库暂不可用）' },
      { status: 200 },
    );
  }
}
