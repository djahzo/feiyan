import { NextResponse } from 'next/server';
import { getVideoList } from '@/lib/bilibili';

export async function GET(request: Request) {
  try {
    const uid = process.env.BILIBILI_UID;
    if (!uid) return NextResponse.json({ success: false, message: 'BILIBILI_UID not set' }, { status: 500 });
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '9');
    const data = await getVideoList(uid, page, pageSize);
    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
