import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findAdminByUsername, getAdminCount } from '@/lib/db';
import { ADMIN_SESSION_COOKIE, signAdminSession } from '@/lib/admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { username?: string; password?: string };
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password.trim() : '';
    if (!username || !password) {
      return NextResponse.json({ error: '请输入账号和密码' }, { status: 400 });
    }

    const adminCount = await getAdminCount();
    if (adminCount === 0) {
      return NextResponse.json(
        {
          error: '尚未创建管理员。请先打开 /admin/setup 完成首次初始化后再登录。',
          code: 'SETUP_REQUIRED',
        },
        { status: 401 },
      );
    }

    const admin = await findAdminByUsername(username);
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      return NextResponse.json({ error: '账号或密码不正确' }, { status: 401 });
    }

    const token = await signAdminSession(admin.id, admin.username);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('ADMIN_SESSION_SECRET')) {
      return NextResponse.json({ error: '服务器未正确配置 ADMIN_SESSION_SECRET' }, { status: 500 });
    }
    console.error(e);
    const hint =
      process.env.NODE_ENV === 'development'
        ? `登录接口异常：${msg}`
        : '登录失败，请查看服务器日志';
    return NextResponse.json({ error: hint }, { status: 500 });
  }
}
