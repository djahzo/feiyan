import { NextResponse } from 'next/server';
import axios from 'axios';

const BASE = 'https://api.bilibili.com';
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://www.bilibili.com/',
  'Accept': 'application/json',
  'Cookie': "buvid3=placeholder",
};

export async function GET() {
  const uid = process.env.BILIBILI_UID || '14636839';
  const results: Record<string, unknown> = {};

  // Test 1: search/type (keyword search for user's videos)
  try {
    const r = await axios.get(`${BASE}/x/web-interface/search/type`, {
      params: { search_type: 'video', keyword: `斐延`, order: 'pubdate', page: 1 },
      headers, timeout: 10000,
    });
    results.search_code = r.data.code;
    results.search_count = r.data.data?.result?.length;
  } catch (e: unknown) {
    results.search_error = axios.isAxiosError(e) ? `${e.response?.status}: ${JSON.stringify(e.response?.data)}` : String(e);
  }

  // Test 2: x/space/arc/search (old endpoint without wbi)
  try {
    const r = await axios.get(`${BASE}/x/space/arc/search`, {
      params: { mid: uid, pn: 1, ps: 9, order: 'pubdate' },
      headers, timeout: 10000,
    });
    results.old_arc_code = r.data.code;
    results.old_arc_count = r.data.data?.list?.vlist?.length;
  } catch (e: unknown) {
    results.old_arc_error = axios.isAxiosError(e) ? `${e.response?.status}` : String(e);
  }

  // Test 3: member/getSubmitVideos (app API)
  try {
    const r = await axios.get(`${BASE}/x/member/web/arc/search`, {
      params: { mid: uid, pn: 1, ps: 9, order: 'pubdate' },
      headers, timeout: 10000,
    });
    results.member_code = r.data.code;
    results.member_count = r.data.data?.list?.vlist?.length;
  } catch (e: unknown) {
    results.member_error = axios.isAxiosError(e) ? `${e.response?.status}` : String(e);
  }

  // Test 4: grpc-like endpoint
  try {
    const r = await axios.get(`https://app.bilibili.com/x/v2/space/archive`, {
      params: { vmid: uid, pn: 1, ps: 9 },
      headers: { ...headers, Referer: 'https://app.bilibili.com/' },
      timeout: 10000,
    });
    results.app_code = r.data.code;
    results.app_count = r.data.data?.item?.length;
    if (r.data.data?.item?.[0]) results.app_sample = r.data.data.item[0];
  } catch (e: unknown) {
    results.app_error = axios.isAxiosError(e) ? `${e.response?.status}` : String(e);
  }

  return NextResponse.json(results);
}
