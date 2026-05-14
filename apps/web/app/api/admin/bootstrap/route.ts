import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findAdminByUsername, getAdminCount, insertFirstAdminIfEmpty } from '@/lib/db';
import { ADMIN_SESSION_COOKIE, adminSessionCookieSecure, signAdminSession } from '@/lib/admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t || t.length > 64) return null;
  if (/[\u0000-\u001f\u007f]/.test(t)) return null;
  return t;
}

/**
 * 首次部署：在库中尚无管理员时，用请求体中的账号与密码创建唯一管理员并下发会话 Cookie。
 * 若已有管理员则 403。仍需环境变量 ADMIN_SESSION_SECRET（≥16 字符）用于签发 JWT。
 */
export async function POST(req: Request) {
  try {
    if ((await getAdminCount()) > 0) {
      return NextResponse.json({ error: '管理员已存在，请直接登录。' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: '请求体须为 JSON' }, { status: 400 });
    }
    const o = body as Record<string, unknown>;
    const username = normalizeUsername(o.username);
    const password = typeof o.password === 'string' ? o.password : '';
    const confirm = typeof o.passwordConfirm === 'string' ? o.passwordConfirm : '';

    if (!username) {
      return NextResponse.json({ error: '账号为 1～64 个字符，且不能含控制字符' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '密码至少 6 位' }, { status: 400 });
    }
    if (password.length > 256) {
      return NextResponse.json({ error: '密码过长' }, { status: 400 });
    }
    if (password !== confirm) {
      return NextResponse.json({ error: '两次输入的密码不一致' }, { status: 400 });
    }

    const hash = bcrypt.hashSync(password, 10);
    const insertedId = await insertFirstAdminIfEmpty(username, hash);
    if (insertedId == null) {
      return NextResponse.json(
        { error: '初始化未完成：可能已有其他请求创建了管理员。请刷新页面后尝试登录。' },
        { status: 409 },
      );
    }

    const admin = await findAdminByUsername(username);
    if (!admin) {
      return NextResponse.json({ error: '创建后读取失败，请联系运维检查数据库' }, { status: 500 });
    }

    const token = await signAdminSession(admin.id, admin.username);
    const res = NextResponse.json({ ok: true, username: admin.username });
    res.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: adminSessionCookieSecure(req),
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('ADMIN_SESSION_SECRET')) {
      return NextResponse.json({ error: '服务器未配置 ADMIN_SESSION_SECRET（至少 16 字符），无法签发登录态' }, { status: 500 });
    }
    console.error('[admin/bootstrap]', e);
    return NextResponse.json({ error: '初始化失败' }, { status: 500 });
  }
}
