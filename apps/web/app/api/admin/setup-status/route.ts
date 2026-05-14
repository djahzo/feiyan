import { NextResponse } from 'next/server';
import { getAdminCount } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 是否仍需「首次创建管理员」（无鉴权，仅返回布尔，供登录页/初始化页使用） */
export async function GET() {
  try {
    const n = await getAdminCount();
    return NextResponse.json({ needsSetup: n === 0 });
  } catch (e) {
    console.error('[admin/setup-status]', e);
    return NextResponse.json({ error: '无法读取状态' }, { status: 500 });
  }
}
