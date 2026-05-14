import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { assertSafeBasename, deleteCaptainAvatarFile, ensureCaptainUploadDir, getCaptainUploadDir } from '@/lib/captain-uploads';
import { getCaptainById, setCaptainAvatarFilename } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 4 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getAdminFromRequest(req);
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '无效 id' }, { status: 400 });

  const row = await getCaptainById(id);
  if (!row) return NextResponse.json({ error: '不存在' }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: '无法解析表单' }, { status: 400 });
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: '请上传文件字段 file' }, { status: 400 });
  }
  const blob = file as File;
  const mime = blob.type || 'application/octet-stream';
  const ext = MIME_EXT[mime];
  if (!ext) return NextResponse.json({ error: '仅支持 jpg / png / webp / gif' }, { status: 400 });

  const buf = Buffer.from(await blob.arrayBuffer());
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: '文件过大（最大 4MB）' }, { status: 400 });

  const name = `${id}-${randomBytes(8).toString('hex')}${ext}`;
  assertSafeBasename(name);
  ensureCaptainUploadDir();
  const full = path.join(getCaptainUploadDir(), name);

  if (row.avatar_filename) deleteCaptainAvatarFile(row.avatar_filename);

  fs.writeFileSync(full, buf);
  await setCaptainAvatarFilename(id, name);

  return NextResponse.json({
    ok: true,
    data: { avatarUrl: `/api/admin/captain-avatar/${id}` },
  });
}
