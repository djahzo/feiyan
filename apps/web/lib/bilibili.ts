import axios from 'axios';
import crypto from 'crypto';
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

// WBI 签名
const mixinKeyEncTab = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5,
  49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55,
  40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57,
  62, 11, 36, 20, 34, 44, 52,
];

function getMixinKey(orig: string): string {
  return mixinKeyEncTab.map(n => orig[n]).join('').slice(0, 32);
}

function encWbi(params: Record<string, string | number>, imgKey: string, subKey: string): string {
  const mixinKey = getMixinKey(imgKey + subKey);
  const wts = Math.round(Date.now() / 1000);
  const chrFilter = /[!'()*]/g;
  const allParams = { ...params, wts };
  const query = Object.keys(allParams)
    .sort()
    .map(key => {
      const value = String(allParams[key as keyof typeof allParams]).replace(chrFilter, '');
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join('&');
  const wRid = crypto.createHash('md5').update(query + mixinKey).digest('hex');
  return `${query}&w_rid=${wRid}`;
}

let wbiKeys: { imgKey: string; subKey: string; ts: number } | null = null;

async function getWbiKeys(): Promise<{ imgKey: string; subKey: string }> {
  if (wbiKeys && Date.now() - wbiKeys.ts < 30 * 60 * 1000) {
    return wbiKeys;
  }
  const { data } = await axios.get(`${BASE}/x/web-interface/nav`, { headers, timeout: 10000 });
  const imgUrl: string = data.data?.wbi_img?.img_url || '';
  const subUrl: string = data.data?.wbi_img?.sub_url || '';
  const imgKey = imgUrl.split('/').pop()?.split('.')[0] || '';
  const subKey = subUrl.split('/').pop()?.split('.')[0] || '';
  wbiKeys = { imgKey, subKey, ts: Date.now() };
  return { imgKey, subKey };
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

  const { imgKey, subKey } = await getWbiKeys();
  const params = { mid: uid, pn: page, ps: Math.min(pageSize, 50), order: 'pubdate' };
  const signedQuery = encWbi(params as Record<string, string | number>, imgKey, subKey);

  const { data } = await axios.get(`${BASE}/x/space/wbi/arc/search?${signedQuery}`, {
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
