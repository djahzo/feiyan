import { NextResponse } from 'next/server';
import axios from 'axios';

export const runtime = 'nodejs';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://www.bilibili.com/',
  'Accept': 'application/json',
  'Cookie': 'buvid3=placeholder',
};

export async function GET(request: Request) {
  const uid = process.env.BILIBILI_UID;
  const keyword = process.env.BILIBILI_KEYWORD || '斐延';
  if (!uid) return NextResponse.json({ success: false, message: 'BILIBILI_UID not set' }, { status: 500 });
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '9');

  try {
    const { data } = await axios.get('https://api.bilibili.com/x/web-interface/search/type', {
      params: { search_type: 'video', keyword, order: 'pubdate', page, pagesize: pageSize },
      headers, timeout: 10000,
    });
    if (data.code === 0 && data.data?.result) {
      const videos = data.data.result
        .filter((v: { mid: number }) => String(v.mid) === uid)
        .map((v: { aid: number; bvid: string; title: string; pic: string; description: string; pubdate: number; duration: string; play: number; review: number }) => ({
          aid: v.aid,
          bvid: v.bvid,
          title: v.title.replace(/<[^>]+>/g, ''),
          pic: v.pic.startsWith('//') ? `https:${v.pic}` : v.pic,
          description: v.description,
          created: v.pubdate,
          length: v.duration,
          play: v.play,
          video_review: v.review,
        }));
      return NextResponse.json({ success: true, data: { videos, total: data.data.numResults || videos.length } });
    }
    return NextResponse.json({ success: true, data: { videos: [], total: 0 } });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
