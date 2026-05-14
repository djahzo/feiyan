/** 上号托管类型：扫号粉、组排蓝 */
export const HOST_TYPES = ['scan', 'group'] as const;
export type HostType = (typeof HOST_TYPES)[number];

/** 新建条目、API 缺省、旧数据 normal 迁移目标 */
export const DEFAULT_HOST_TYPE: HostType = 'scan';

export const HOST_TYPE_LABEL: Record<HostType, string> = {
  scan: '扫号',
  group: '组排',
};

export function isHostType(v: string | null | undefined): v is HostType {
  return v === 'scan' || v === 'group';
}

export function parseHostType(v: unknown): HostType | null {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (s === 'normal') return DEFAULT_HOST_TYPE;
  return isHostType(s) ? s : null;
}

export function hostTypeBadgeClass(t: HostType): string {
  if (t === 'scan') return 'border border-pink-200 bg-pink-50 text-pink-700';
  return 'border border-blue-200 bg-blue-50 text-blue-700';
}
