import axios from 'axios';
import type { BilibiliUserInfo, BilibiliLiveStatus, BilibiliVideo, BilibiliDynamicItem } from '@/types/bilibili';

const BASE = 'https://api.bilibili.com';
const LIVE_BASE = 'https://api.live.bilibili.com';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://space.bilibili.com/',
  'Accept': 'application/json',
};

const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 5 * 60 * 1000;

function getCache<T>(key: string): T | null {
  const item = cache.get(key);
  if (item && Date.now() - item.ts < TTL) return item.data as T;
  cache.delete(key);
  return null;
}
function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

export async function getUserInfo(uid: string): Promise<BilibiliUserInfo> {
  const key = `user_${uid}`;
  const cached = getCache<BilibiliUserInfo>(key);
  if (cached) return cached;
  const { data } = await axios.get(`${BASE}/x/space/acc/info`, { params: { mid: uid }, headers, timeout: 10000 });
  if (data.code !== 0) throw new Error(data.message);
  setCache(key, data.data);
  return data.data;
}

export async function getLiveStatus(uid: string): Promise<BilibiliLiveStatus> {
  const key = `live_${uid}`;
  const cached = getCache<BilibiliLiveStatus>(key);
  if (cached) return cached;
  const { data } = await axios.get(`${LIVE_BASE}/room/v1/Room/get_status_info_by_uids`, {
    params: { 'uids[]': uid }, headers, timeout: 10000,
  });
  const info = data.code === 0 ? data.data?.[uid] : null;
  const result: BilibiliLiveStatus = {
    live_status: info?.live_status || 0,
    room_id: info?.room_id || 0,
    title: info?.title || '',
    cover: info?.cover_from_user || info?.cover || '',
    url: info?.room_id ? `https://live.bilibili.com/${info.room_id}` : '',
  };
  setCache(key, result);
  return result;
}

export async function getVideoList(uid: string, page = 1, pageSize = 30): Promise<{ videos: BilibiliVideo[]; total: number }> {
  const key = `videos_${uid}_${page}_${pageSize}`;
  const cached = getCache<{ videos: BilibiliVideo[]; total: number }>(key);
  if (cached) return cached;
  const { data } = await axios.get(`${BASE}/x/space/arc/search`, {
    params: { mid: uid, pn: page, ps: Math.min(pageSize, 50), order: 'pubdate' },
    headers, timeout: 10000,
  });
  if (data.code !== 0) return { videos: [], total: 0 };
  const result = { videos: data.data.list.vlist || [], total: data.data.page?.count || 0 };
  setCache(key, result);
  return result;
}

export async function getDynamicList(uid: string): Promise<BilibiliDynamicItem[]> {
  const key = `dynamics_${uid}`;
  const cached = getCache<BilibiliDynamicItem[]>(key);
  if (cached) return cached;
  const { data } = await axios.get(`${BASE}/x/polymer/web-dynamic/v1/feed/space`, {
    params: { host_mid: uid }, headers, timeout: 10000,
  });
  const items = data.code === 0 ? (data.data?.items || []) : [];
  setCache(key, items);
  return items;
}
