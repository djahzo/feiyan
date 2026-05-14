import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { assertSafeBasename, getCaptainUploadDir } from '@/lib/captain-uploads';
import { getCaptainById } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getAdminFromRequest(req);
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '无效 id' }, { status: 400 });

  const row = await getCaptainById(id);
  if (!row?.avatar_filename) return NextResponse.json({ error: '无头像' }, { status: 404 });

  let safe: string;
  try {
    safe = assertSafeBasename(row.avatar_filename);
  } catch {
    return NextResponse.json({ error: '无效文件' }, { status: 400 });
  }
  const full = path.join(getCaptainUploadDir(), safe);
  if (!fs.existsSync(full)) return NextResponse.json({ error: '文件不存在' }, { status: 404 });

  const ext = path.extname(safe).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  const body = fs.readFileSync(full);
  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'private, max-age=3600',
    },
  });
}
