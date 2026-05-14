import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-session';

function getSecretBytes(): Uint8Array | null {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) return null;
  return new TextEncoder().encode(s);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/admin')) return NextResponse.next();
  if (pathname.startsWith('/admin/login') || pathname.startsWith('/admin/setup')) return NextResponse.next();

  const key = getSecretBytes();
  if (!key) {
    return new NextResponse(
      '请配置环境变量 ADMIN_SESSION_SECRET（至少 16 位字符），并重启应用进程（如 pm2 restart）。',
      { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    );
  }

  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) {
    const login = new URL('/admin/login', req.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }

  try {
    await jwtVerify(token, key);
  } catch {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
