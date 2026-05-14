/** 与任务板「舰长池」拖入时写入的 role_name 一致，用于匹配待办条目与舰长档案 */

export type CaptainScheduleNameInput = {
  id: number;
  uid: string;
  idName: string | null;
  remarkName: string | null;
};

export function captainScheduleName(c: CaptainScheduleNameInput): string {
  const r = (c.remarkName ?? '').trim();
  if (r) return r;
  const i = (c.idName ?? '').trim();
  if (i) return i;
  const u = (c.uid ?? '').trim();
  if (u) return u;
  return `舰长#${c.id}`;
}

/** 舰长池列表展示：主名后追加「| 微信备注」（仅展示，拖入待办仍用 {@link captainScheduleName}） */
export type CaptainPoolDisplayInput = CaptainScheduleNameInput & { wechatRemark?: string | null };

export function captainPoolDisplayLine(c: CaptainPoolDisplayInput): string {
  const base = captainScheduleName(c);
  const wx = (c.wechatRemark ?? '').trim();
  if (!wx) return base;
  return `${base} | ${wx}`;
}
