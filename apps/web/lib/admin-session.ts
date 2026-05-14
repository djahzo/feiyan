import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';

export const ADMIN_SESSION_COOKIE = 'admin_session';

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
