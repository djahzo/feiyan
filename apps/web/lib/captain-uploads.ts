import fs from 'node:fs';
import path from 'node:path';
import { getSqliteFilePath } from '@/lib/db';

/** 与 SQLite 库文件同盘路径树，避免 monorepo / 启动 cwd 与 `data/site.db` 不一致时找不到头像 */
export function getCaptainUploadDir(): string {
  const fromEnv = process.env.CAPTAIN_UPLOAD_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  const dbFile = getSqliteFilePath();
  return path.join(path.dirname(dbFile), 'uploads', 'captains');
}

export function ensureCaptainUploadDir(): void {
  fs.mkdirSync(getCaptainUploadDir(), { recursive: true });
}

/** 仅允许纯文件名，防止路径穿越 */
export function assertSafeBasename(name: string): string {
  const base = path.basename(name);
  if (!base || base !== name || name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new Error('非法文件名');
  }
  return base;
}

export function deleteCaptainAvatarFile(filename: string | null | undefined): void {
  if (!filename) return;
  try {
    const safe = assertSafeBasename(filename);
    const full = path.join(getCaptainUploadDir(), safe);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch {
    // 忽略清理失败
  }
}
