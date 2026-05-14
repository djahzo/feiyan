import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';

export const ADMIN_SESSION_COOKIE = 'admin_session';

/**
 * 会话 Cookie 是否加 `Secure`。
 * - 生产环境若仍用 HTTP 直连，`NODE_ENV===production` + `secure:true` 会导致浏览器拒收 Cookie，登录后无法进后台。
 * - 反代终止 HTTPS 时须传 `X-Forwarded-Proto: https`。
 * - 可显式覆盖：`ADMIN_SESSION_COOKIE_SECURE=true|false`
 */
export function adminSessionCookieSecure(req: Request): boolean {
  const raw = process.env.ADMIN_SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  const xf = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (xf === 'https') return true;
  if (xf === 'http') return false;
  try {
    return new URL(req.url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function getSessionSecretKey(): Uint8Array {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('ADMIN_SESSION_SECRET 未配置或过短（至少 16 字符）');
  }
  return new TextEncoder().encode(s);
}

export async function signAdminSession(adminId: number, username: string): Promise<string> {
  return new SignJWT({ uid: adminId, name: username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(adminId))
    .setExpirationTime('7d')
    .sign(getSessionSecretKey());
}

export async function verifyAdminSessionToken(token: string) {
  const { payload } = await jwtVerify(token, getSessionSecretKey());
  return payload as { sub?: string; uid?: number; name?: string };
}

export async function getAdminFromRequest(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifyAdminSessionToken(token);
  } catch {
    return null;
  }
}
