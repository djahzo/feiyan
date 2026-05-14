import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, adminSessionCookieSecure } from '@/lib/admin-session';

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: adminSessionCookieSecure(req),
    path: '/',
    maxAge: 0,
  });
  return res;
}
