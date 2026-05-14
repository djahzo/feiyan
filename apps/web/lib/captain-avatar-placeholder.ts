/**
 * 无头像时：用备注生成占位文案。
 * - 若以英文字母开头：取连续英文字母组成的首个「单词」（最多 4 字以免圆圈挤爆）
 * - 否则：取备注前两个 Unicode 字符（适合中文）
 */
export function avatarLabelFromNote(note: string | null | undefined): string | null {
  const raw = (note ?? '').trim();
  if (!raw) return null;
  const chars = Array.from(raw);
  if (chars.length === 0) return null;
  if (/[a-zA-Z]/.test(chars[0])) {
    const m = raw.match(/^[A-Za-z]+/);
    if (m && m[0].length > 0) {
      const w = m[0];
      return w.length <= 4 ? w : w.slice(0, 4);
    }
  }
  return chars.slice(0, 2).join('');
}

/** 本地上传走 `/api/...` 可带版本；外链（B 站 CDN）不追加参数，避免破坏已有 query */
export function captainAvatarImgSrc(avatarUrl: string, updatedAt: number): string {
  const u = avatarUrl.trim();
  if (/^https?:\/\//i.test(u) || u.startsWith('//')) return u.startsWith('//') ? `https:${u}` : u;
  return `${u}?v=${updatedAt}`;
}

/** B 站头像 CDN 常校验 Referer；站外页面用 no-referrer 更稳 */
export function captainAvatarImgReferrerPolicy(avatarUrl: string): 'no-referrer' | undefined {
  const u = avatarUrl.trim();
  return /^https?:\/\//i.test(u) || u.startsWith('//') ? 'no-referrer' : undefined;
}
