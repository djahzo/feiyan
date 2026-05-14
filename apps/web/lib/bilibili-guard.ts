import axios from 'axios';

const LIVE_BASE = 'https://api.live.bilibili.com';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Referer: 'https://live.bilibili.com/',
  Accept: 'application/json',
};

export type BiliGuardMember = { uid: string; name: string; guardLevel: number; faceUrl: string | null };

function parseGuardRow(row: unknown): BiliGuardMember | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const uinfo = r.uinfo as Record<string, unknown> | undefined;
  if (!uinfo) return null;
  const uidNum = Number(uinfo.uid);
  if (!Number.isFinite(uidNum) || uidNum <= 0) return null;
  const uid = String(Math.trunc(uidNum));
  const base = uinfo.base as Record<string, unknown> | undefined;
  const rawName = base?.name != null ? String(base.name).trim() : '';
  const name = rawName || uid;
  const rawFace = base?.face != null ? String(base.face).trim() : '';
  let faceUrl: string | null = null;
  if (rawFace) {
    if (/^https?:\/\//i.test(rawFace)) faceUrl = rawFace;
    else if (rawFace.startsWith('//')) faceUrl = `https:${rawFace}`;
  }
  const medal = uinfo.medal as Record<string, unknown> | undefined;
  const guard = uinfo.guard as Record<string, unknown> | undefined;
  let gl = Number(medal?.guard_level ?? guard?.level ?? 0);
  if (!Number.isFinite(gl)) gl = 0;
  return { uid, name, guardLevel: gl, faceUrl };
}

/** 拉取直播间大航海总榜（typ=5），合并 top3 + list 并翻页；请求间带短延迟降低风控概率 */
export async function fetchGuardTabTotalMembers(roomId: number, ruid: string): Promise<BiliGuardMember[]> {
  if (!Number.isFinite(roomId) || roomId <= 0) throw new Error('无效的直播间 room_id');
  const r = ruid.trim();
  if (!r) throw new Error('无效的 ruid');

  const pageSize = 30;
  const collected = new Map<string, BiliGuardMember>();
  let totalPages = 1;

  for (let page = 1; page <= totalPages; page++) {
    const { data } = await axios.get(`${LIVE_BASE}/xlive/app-room/v2/guardTab/topListNew`, {
      params: { roomid: roomId, ruid: r, page, page_size: pageSize, typ: 5 },
      headers,
      timeout: 20000,
    });

    if (data?.code !== 0) {
      const msg = typeof data?.message === 'string' ? data.message : `B站接口 code=${data?.code ?? '?'}`;
      throw new Error(msg);
    }

    const d = data.data ?? {};
    if (page === 1) {
      const info = d.info as Record<string, unknown> | undefined;
      const tp = Number(info?.page ?? info?.PAGE ?? 1);
      totalPages = Math.min(Math.max(Number.isFinite(tp) ? Math.trunc(tp) : 1, 1), 500);
    }

    const top3 = Array.isArray(d.top3) ? d.top3 : [];
    const list = Array.isArray(d.list) ? d.list : [];
    const rows = page === 1 ? [...top3, ...list] : list;

    for (const row of rows) {
      const m = parseGuardRow(row);
      if (m) collected.set(m.uid, m);
    }

    if (page > 1 && list.length === 0) break;
    if (page < totalPages) await new Promise(res => setTimeout(res, 400));
  }

  return [...collected.values()];
}
